#!/usr/bin/env bash
# deploy.sh 的本地验证驱动：用假 aws + 真 python3 跑完整流程
HERE="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HERE/bin:$PATH"
export AWS_STUB_LOG="$HERE/aws-calls.log"
export AWS_STUB_STATE="$HERE/state"
export AWS_REGION="ap-northeast-1"
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

cd "$HERE/.." || exit 1
FAIL=0

chk() { # chk <描述> <条件命令...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  [PASS] $desc"
  else
    echo "  [FAIL] $desc"
    FAIL=1
  fi
}

# 只截取某次运行新增的 aws 调用，避免把上一次的日志算进断言
slice_since() { # slice_since <起始行数> <输出文件>
  sed -n "$(( $1 + 1 )),\$p" "$AWS_STUB_LOG" > "$2"
}

echo "############ 第 1 次运行：全新部署（预置 3 个 Key）############"
rm -rf "$AWS_STUB_STATE" "$AWS_STUB_LOG"
mkdir -p "$AWS_STUB_STATE"
PROXY_TOKEN="tok-first-run" \
KEY_AGNES="sk-agnes-test" \
KEY_CHECK="ms-check-test" \
KEY_SENSENOVA="sk-sen-test" \
bash deploy.sh < /dev/null > "$HERE/out-1.txt" 2>&1
RC1=$?
echo "退出码=$RC1"
cat "$HERE/out-1.txt"

echo
echo "=== 第 1 次运行的 aws 调用序列 ==="
cat "$AWS_STUB_LOG"

echo
echo "=== 第 1 次运行断言 ==="
chk "退出码为 0"                 test "$RC1" -eq 0
chk "创建了 IAM 角色"            grep -q "iam create-role" "$AWS_STUB_LOG"
chk "绑定了基础执行策略"          grep -q "iam attach-role-policy" "$AWS_STUB_LOG"
chk "创建了函数（不是更新）"      grep -q "lambda create-function " "$AWS_STUB_LOG"
chk "create-function 带 arm64"   grep -q "architectures arm64" "$AWS_STUB_LOG"
chk "运行时是 nodejs24.x"        grep -q "runtime nodejs24.x" "$AWS_STUB_LOG"
chk "create-function 带 60 秒"   grep -q "timeout 60" "$AWS_STUB_LOG"
chk "Function URL 用 NONE"       grep -q "lambda create-function-url-config .*auth-type NONE" "$AWS_STUB_LOG"
chk "Function URL 未传 --cors"   bash -c "! grep -q 'create-function-url-config.*--cors' '$AWS_STUB_LOG'"
chk "补了公网访问策略"            grep -q "lambda add-permission" "$AWS_STUB_LOG"
chk "add-permission 用 NONE"     grep -q "function-url-auth-type NONE" "$AWS_STUB_LOG"
chk "补了 InvokeFunctionUrl 语句" grep -q "statement-id FunctionURLAllowPublicAccess" "$AWS_STUB_LOG"
chk "补了 InvokeFunction 语句"    grep -q "statement-id FunctionURLAllowInvokeViaUrl" "$AWS_STUB_LOG"
chk "InvokeFunction 带 URL 条件"  grep -q "invoked-via-function-url" "$AWS_STUB_LOG"
# 2025-10 起 AuthType=NONE 必须两条策略并存，只加一条就是 403。数量卡死防漏
chk "两条策略都加了（共 2 次）"    test "$(grep -c 'lambda add-permission' "$AWS_STUB_LOG")" -eq 2
chk "输出了两条策略已添加"         test "$(grep -c '策略已添加' "$HERE/out-1.txt")" -eq 2
chk "注入了 3 个 Key + 口令"      grep -q "已注入：KEY_AGNES, KEY_CHECK, KEY_SENSENOVA, PROXY_TOKEN" "$HERE/out-1.txt"
chk "输出含 Function URL"         grep -q "stub123456.lambda-url" "$HERE/out-1.txt"
chk "输出含生成端点"              grep -q "https/api.agnes-ai.cn/v1" "$HERE/out-1.txt"
chk "输出含质检端点"              grep -q "https/api-inference.modelscope.cn/v1" "$HERE/out-1.txt"
chk "输出含 SenseNova 端点"       grep -q "https/token.sensenova.cn/v1" "$HERE/out-1.txt"
chk "输出含 DashScope 端点"       grep -q "https/dashscope.aliyuncs.com" "$HERE/out-1.txt"
chk "URL 没出现双斜杠 https//"    bash -c "! grep -qE 'https//[^/]' '$HERE/out-1.txt'"

# 端点 + 口令这几类变量必须逐个打印，漏一个就会有人照着配漏项
for v in VITE_TEXT_BASE_URL VITE_CHECK_BASE_URL VITE_DASH_BASE_URL VITE_SENSENOVA_BASE_URL VITE_PROXY_TOKEN; do
  chk "输出含 $v" grep -q "$v" "$HERE/out-1.txt"
done

echo
echo "############ 第 2 次运行：重跑，什么都不传 ############"
MARK=$(wc -l < "$AWS_STUB_LOG")
bash deploy.sh < /dev/null > "$HERE/out-2.txt" 2>&1
RC2=$?
slice_since "$MARK" "$HERE/run2.log"
echo "退出码=$RC2"
echo "=== 第 2 次运行新增的 aws 调用 ==="
cat "$HERE/run2.log"

echo
echo "=== 第 2 次运行断言 ==="
chk "退出码为 0"                 test "$RC2" -eq 0
chk "复用角色（没再 create-role）" bash -c "! grep -q 'iam create-role' '$HERE/run2.log'"
chk "改走 update-function-code"   grep -q "lambda update-function-code" "$HERE/run2.log"
chk "没再 create-function"        bash -c "! grep -q 'lambda create-function ' '$HERE/run2.log'"
chk "没再 create-function-url"    bash -c "! grep -q 'lambda create-function-url-config' '$HERE/run2.log'"
chk "没再 add-permission"         bash -c "! grep -q 'lambda add-permission' '$HERE/run2.log'"
chk "重跑仍核验 AuthType=NONE"    grep -q "update-function-url-config.*auth-type NONE" "$HERE/run2.log"
chk "识别出两条策略都在"          test "$(grep -c '策略已存在' "$HERE/out-2.txt")" -eq 2
chk "update-config 带 --runtime"  grep -q "update-function-configuration.*--runtime nodejs24.x" "$HERE/run2.log"
chk "识别出函数已存在"            grep -q "函数状态  已存在" "$HERE/out-2.txt"
chk "口令沿用旧值"                grep -q "沿用已部署的口令" "$HERE/out-2.txt"
chk "输出口令仍是 tok-first-run"  grep -q "tok-first-run" "$HERE/out-2.txt"
chk "Key 没被抹掉"                grep -q "已注入：KEY_AGNES, KEY_CHECK, KEY_SENSENOVA, PROXY_TOKEN" "$HERE/out-2.txt"
chk "URL 沿用同一个"              grep -q "stub123456.lambda-url" "$HERE/out-2.txt"

echo
echo "############ 第 3 次运行：重跑，只换 KEY_CHECK ############"
MARK=$(wc -l < "$AWS_STUB_LOG")
KEY_CHECK="ms-new-value" bash deploy.sh < /dev/null > "$HERE/out-3.txt" 2>&1
RC3=$?
slice_since "$MARK" "$HERE/run3.log"
echo "退出码=$RC3"
echo "=== 注入的变量清单 ==="
grep "已注入" "$HERE/out-3.txt"
chk "退出码为 0"                 test "$RC3" -eq 0
chk "KEY_CHECK 换成了新值"        grep -q "ms-new-value" "$HERE/run3.log"
chk "其余 Key 仍在（没被清空）"    grep -q "已注入：KEY_AGNES, KEY_CHECK, KEY_SENSENOVA, PROXY_TOKEN" "$HERE/out-3.txt"
chk "旧 KEY_CHECK 值已不在"       bash -c "! grep -q 'ms-check-test' '$HERE/run3.log'"

echo
echo "############ 第 4 次运行：交互填 Key（重填一个，其余回车沿用）############"
MARK=$(wc -l < "$AWS_STUB_LOG")
# 6 行输入对应 6 个提问：第 1 行重填 KEY_AGNES，其余空行 = 回车沿用
printf 'sk-typed-agnes\n\n\n\n\n\n' | PROMPT=always bash deploy.sh > "$HERE/out-4.txt" 2>&1
RC4=$?
slice_since "$MARK" "$HERE/run4.log"
echo "退出码=$RC4"
echo "=== 注入的变量清单 ==="
grep "已注入" "$HERE/out-4.txt"
chk "退出码为 0"                 test "$RC4" -eq 0
chk "走了交互分支"                grep -q "已部署的变量：" "$HERE/out-4.txt"
chk "重填的 KEY_AGNES 生效"       grep -q "sk-typed-agnes" "$HERE/run4.log"
chk "回车沿用的 KEY_CHECK 还在"   grep -q "ms-new-value" "$HERE/run4.log"
chk "回车沿用的 SENSENOVA 还在"   grep -q "sk-sen-test" "$HERE/run4.log"
chk "仍是 4 个变量"               grep -q "已注入：KEY_AGNES, KEY_CHECK, KEY_SENSENOVA, PROXY_TOKEN" "$HERE/out-4.txt"

echo
echo "############ 第 5 次运行：全新函数，不给口令也不给 Key ############"
rm -rf "$AWS_STUB_STATE" "$AWS_STUB_LOG"
mkdir -p "$AWS_STUB_STATE"
bash deploy.sh < /dev/null > "$HERE/out-5.txt" 2>&1
RC5=$?
echo "退出码=$RC5"
chk "退出码为 0"                 test "$RC5" -eq 0
chk "提示口令已自动生成"          grep -q "已自动生成" "$HERE/out-5.txt"
chk "只注入了 PROXY_TOKEN"        grep -q "已注入：PROXY_TOKEN$" "$HERE/out-5.txt"

echo
echo "############ 第 6 次运行：非法区域（应报错退出）############"
AWS_REGION="" AWS_DEFAULT_REGION="" bash deploy.sh < /dev/null > "$HERE/out-6.txt" 2>&1
RC6=$?
echo "退出码=$RC6"
chk "退出码非 0"                 test "$RC6" -ne 0
chk "给出区域缺失提示"            grep -q "拿不到区域" "$HERE/out-6.txt"

echo
echo "############ 第 7 次运行：创建函数前两次失败，第三次成功 ############"
rm -rf "$AWS_STUB_STATE" "$AWS_STUB_LOG"
mkdir -p "$AWS_STUB_STATE"
AWS_STUB_FAIL_CREATE=2 PROXY_TOKEN="tok-retry" \
  bash deploy.sh < /dev/null > "$HERE/out-7.txt" 2>&1
RC7=$?
echo "退出码=$RC7"
chk "退出码为 0"                 test "$RC7" -eq 0
chk "打印了重试提示"              grep -q "第 1 次重试" "$HERE/out-7.txt"
chk "最终创建成功"                grep -q "已创建" "$HERE/out-7.txt"

echo
echo "############ 第 8 次运行：创建一直失败（应打原始报错再退出）############"
rm -rf "$AWS_STUB_STATE" "$AWS_STUB_LOG"
mkdir -p "$AWS_STUB_STATE"
echo "（重试 10 次，约 30 秒）"
AWS_STUB_FAIL_CREATE=always PROXY_TOKEN="tok-fail" \
  bash deploy.sh < /dev/null > "$HERE/out-8.txt" 2>&1
RC8=$?
echo "退出码=$RC8"
chk "退出码非 0"                 test "$RC8" -ne 0
chk "点明下面是原始报错"          grep -q "以下是原始报错" "$HERE/out-8.txt"
chk "原始报错真的打出来了"         grep -q "STUB_CREATE_FAILED" "$HERE/out-8.txt"

echo
echo "############ 第 9 次运行：老部署遗留（策略只有一条 + AuthType 是 AWS_IAM）############"
# 模拟 2025-10 之前建出来、或用旧版脚本部署出来的状态：
#   URL 停在控制台默认的 AWS_IAM，策略里只有 InvokeFunctionUrl 一条。
# AuthType 不拉回 NONE 一定 403；缺的那条 InvokeFunction 在新要求下也必须补上。
rm -rf "$AWS_STUB_STATE" "$AWS_STUB_LOG"
mkdir -p "$AWS_STUB_STATE"
touch "$AWS_STUB_STATE/fn" "$AWS_STUB_STATE/url"
printf 'FunctionURLAllowPublicAccess\n' > "$AWS_STUB_STATE/perms"
printf 'AWS_IAM' > "$AWS_STUB_STATE/auth_type"
bash deploy.sh < /dev/null > "$HERE/out-9.txt" 2>&1
RC9=$?
echo "退出码=$RC9"
echo "=== 第 9 次运行新增的 aws 调用 ==="
cat "$AWS_STUB_LOG"
chk "退出码为 0"                  test "$RC9" -eq 0
chk "把 AuthType 拉回 NONE"       grep -q "update-function-url-config.*auth-type NONE" "$AWS_STUB_LOG"
chk "补上了缺的 InvokeFunction"    grep -q "statement-id FunctionURLAllowInvokeViaUrl" "$AWS_STUB_LOG"
chk "没重复加已有的那条"           test "$(grep -c 'statement-id FunctionURLAllowPublicAccess' "$AWS_STUB_LOG")" -eq 0
chk "收尾核验没误报"              bash -c "! grep -q 'AuthType 是' '$HERE/out-9.txt'"

echo
echo "############ 第 10 次运行：AuthType 怎么都改不回 NONE（应收尾拦下）############"
# 策略齐了但授权类型不对，一样是 403。这里验证收尾核验不是摆设
rm -rf "$AWS_STUB_STATE" "$AWS_STUB_LOG"
mkdir -p "$AWS_STUB_STATE"
touch "$AWS_STUB_STATE/fn" "$AWS_STUB_STATE/url"
printf 'AWS_IAM' > "$AWS_STUB_STATE/auth_type"
AWS_STUB_AUTH_STUCK=1 bash deploy.sh < /dev/null > "$HERE/out-10.txt" 2>&1
RC10=$?
echo "退出码=$RC10"
chk "退出码非 0"                  test "$RC10" -ne 0
chk "点明 AuthType 不是 NONE"      grep -q "AuthType 是 AWS_IAM" "$HERE/out-10.txt"
chk "给出了 403 的后果"            grep -q "403" "$HERE/out-10.txt"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "════════ 全部断言通过 ════════"
else
  echo "════════ 有断言失败，见上面 [FAIL] ════════"
fi
exit "$FAIL"