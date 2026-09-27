#!/usr/bin/env bash
#
# 一键部署 AI CORS 代理到 AWS Lambda（含 Function URL 公网入口）
#
# 前置：在 AWS CloudShell 里跑，aws cli 已登录，无需额外配置
# 用法：./deploy.sh [函数名] [代理口令]
#   ./deploy.sh                                    # 全默认：ai-cors-proxy + 口令自动生成
#   ./deploy.sh my-proxy                           # 自定义函数名
#   ./deploy.sh my-proxy mySecretToken             # 自定义函数名 + 口令
#   KEY_AGNES=sk-xxx KEY_CHECK=ms-xxx ./deploy.sh  # 环境变量预置 Key，跳过交互
#   PROMPT=never ./deploy.sh                       # 完全不提问，Key 只认环境变量
#   PROMPT=always ./deploy.sh                      # 强制提问（从 stdin 读，脚本化用）
#
# 说明：
#   - 脚本可重复运行。已存在的角色 / 函数 / URL 走更新分支，不会重复创建。
#   - 重跑会沿用已部署的口令和已配的 Key：不重填也不会被抹掉，也不会换口令。
#   - Key 只写进 Lambda 环境变量，不进代码、不进日志、不进 git。
#   - 区域取 CloudShell 当前区域（AWS_REGION），先确认控制台右上角选对了再跑。
#   - 首次跑完必须把输出的 Function URL 和口令填进应用后台，或配到 GitHub Variables。
#
set -euo pipefail

# ── 可调参数 ────────────────────────────────────────────
FN_NAME="${1:-ai-cors-proxy}"
PROXY_TOKEN="${2:-${PROXY_TOKEN:-}}"
ROLE_NAME="${ROLE_NAME:-ai-cors-proxy-lambda-role}"
# nodejs20.x 已于 2026-04-30 停止支持，AWS 会拒绝创建。24.x 支持到 2028，用新不用旧
RUNTIME="${RUNTIME:-nodejs24.x}"
ARCH="${ARCH:-arm64}"
TIMEOUT="${TIMEOUT:-60}"      # 生图要等 30~60 秒，默认 3 秒必挂
MEMORY="${MEMORY:-256}"
PROMPT="${PROMPT:-auto}"      # auto / always / never，见 want_prompt

# ── 前置检查 ────────────────────────────────────────────
command -v aws >/dev/null 2>&1 || { echo "× 找不到 aws cli。请在本脚本的目标环境（CloudShell）里运行"; exit 1; }

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || true)}}"
if [ -z "$REGION" ]; then
  echo "× 拿不到区域。先 export AWS_REGION=ap-northeast-1，或把控制台右上角区域切好再跑"
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
[ -n "$ACCOUNT_ID" ] || { echo "× 身份获取失败，aws cli 可能没登录"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/lambda/index.js"
[ -f "$SRC" ] || { echo "× 找不到 $SRC，请在仓库的 cors-proxy/ 目录下运行本脚本"; exit 1; }

# ── 探测已有函数 ────────────────────────────────────────
# 重跑时要用旧配置做基底：口令沿用旧的，已配的 Key 继承下来，否则整体替换会全被抹掉
FN_EXISTS=0
EXISTING_ENV="{}"
EXISTING_KEYS=""
if aws lambda get-function --function-name "$FN_NAME" >/dev/null 2>&1; then
  FN_EXISTS=1
  # 从没配过环境变量时拿到的是 null，交给 python 统一兜成空对象
  EXISTING_ENV="$(aws lambda get-function-configuration \
    --function-name "$FN_NAME" \
    --query 'Environment.Variables' --output json 2>/dev/null || echo '{}')"
  EXISTING_KEYS="$(printf '%s' "$EXISTING_ENV" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin) or {}
except Exception:
    d = {}
print(" ".join(sorted(d.keys())))
')"
fi

# 该变量在已部署配置里是否已有值（重跑时用它提示「回车沿用」）
has_existing() {
  case " $EXISTING_KEYS " in *" $1 "*) return 0 ;; *) return 1 ;; esac
}

# 是否提问填 Key。auto = stdin 是终端才问（默认）；never = 从不问，只认环境变量；
# always = 强制问（从 stdin 读，脚本化部署 / 测试用）
want_prompt() {
  case "$PROMPT" in
    always) return 0 ;;
    never)  return 1 ;;
  esac
  [ -t 0 ]
}

# 问一个 Key：环境变量已经给了就不打扰；回车 = 沿用已部署的值（没有则跳过）
ask_key() { # ask_key <变量名> <提示语>
  local name="$1" prompt="$2"
  if [ -n "${!name}" ]; then return 0; fi
  local hint="" got=""
  if has_existing "$name"; then hint="（已配置，回车沿用）"; fi
  read -r -p "  $prompt$hint: " got || true
  if [ -n "$got" ]; then printf -v "$name" '%s' "$got"; fi
  return 0
}

echo "── 部署信息 ──────────────────────────────"
echo "  账号      $ACCOUNT_ID"
echo "  区域      $REGION"
echo "  函数名    $FN_NAME"
if [ "$FN_EXISTS" -eq 1 ]; then
  echo "  函数状态  已存在，本次走更新"
else
  echo "  函数状态  不存在，本次新建"
fi
echo "  运行时    $RUNTIME / $ARCH"
echo "  超时/内存 ${TIMEOUT}s / ${MEMORY}MB"
echo

# ── 口令 ────────────────────────────────────────────────
if [ -z "$PROXY_TOKEN" ]; then
  # 已部署过就沿用旧口令。换口令会让已发布的前端（GitHub Variables / 后台配置）全部 401
  PROXY_TOKEN="$(printf '%s' "$EXISTING_ENV" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin) or {}
except Exception:
    d = {}
print(d.get("PROXY_TOKEN", ""))
')"
  if [ -n "$PROXY_TOKEN" ]; then
    echo "  沿用已部署的口令（重跑不换，避免打挂已发布的前端）"
  fi
fi
if [ -z "$PROXY_TOKEN" ]; then
  # 48 位 URL 安全随机串，避免特殊字符在 shell / 环境变量里出问题
  PROXY_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(36))')"
  echo "  代理口令未指定，已自动生成"
fi

# ── API Key（可选，留空则该项不注入，透传浏览器自带的 Authorization）──
KEY_AGNES="${KEY_AGNES:-}"
KEY_CHECK="${KEY_CHECK:-}"
KEY_SENSENOVA="${KEY_SENSENOVA:-}"
KEY_DASHSCOPE="${KEY_DASHSCOPE:-}"
KEY_NVIDIA="${KEY_NVIDIA:-}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"

if want_prompt; then
  if [ -n "$EXISTING_KEYS" ]; then
    echo "── 已部署的变量：$EXISTING_KEYS（回车即沿用，重填则覆盖）──"
  fi
  echo "── 填 Key（回车跳过，之后也能在 Lambda 控制台补）──"
  ask_key KEY_AGNES       "KEY_AGNES     agnes 文本 Key      "
  ask_key KEY_CHECK       "KEY_CHECK     ModelScope 质检 Key "
  ask_key KEY_SENSENOVA   "KEY_SENSENOVA SenseNova 生图 Key  "
  ask_key KEY_DASHSCOPE   "KEY_DASHSCOPE DashScope 生图 Key  "
  ask_key KEY_NVIDIA      "KEY_NVIDIA    NVIDIA 文本 Key     "
  ask_key ALLOWED_ORIGINS "ALLOWED_ORIGINS 来源白名单，逗号分隔，留空=不限"
  echo
else
  echo "  不提问（PROMPT=$PROMPT），Key 只从环境变量读取"
fi

# 用 python3 拼 JSON，避免 Key 里的特殊字符破坏 shell 引号。
# 以已部署的环境变量为基底：这次显式给的值覆盖，没给的保留，绝不整体清空
ENV_JSON="$(python3 - "$EXISTING_ENV" "$PROXY_TOKEN" "$ALLOWED_ORIGINS" \
  "$KEY_AGNES" "$KEY_CHECK" "$KEY_SENSENOVA" "$KEY_DASHSCOPE" "$KEY_NVIDIA" <<'PY'
import json, sys
existing_raw, token, origins, agnes, check, sen, dash, nv = sys.argv[1:9]
try:
    env = json.loads(existing_raw) or {}
except Exception:
    env = {}
env = dict(env)
env["PROXY_TOKEN"] = token
if origins.strip():
    env["ALLOWED_ORIGINS"] = origins.strip()
for name, val in (("KEY_AGNES", agnes), ("KEY_CHECK", check),
                  ("KEY_SENSENOVA", sen), ("KEY_DASHSCOPE", dash),
                  ("KEY_NVIDIA", nv)):
    if val.strip():
        env[name] = val.strip()
print(json.dumps({"Variables": env}))
PY
)"

# ── 1. IAM 角色 ─────────────────────────────────────────
echo "[1/5] IAM 执行角色"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || true)"
if [ -n "$ROLE_ARN" ] && [ "$ROLE_ARN" != "None" ]; then
  echo "  已存在：$ROLE_ARN"
else
  ROLE_ARN="$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --query 'Role.Arn' --output text)"
  echo "  已创建：$ROLE_ARN"
  echo "  等待角色传播…"
  sleep 8
fi

# 重复 attach 同一条策略不会报错，所以每次都补一遍：
# 防的是「角色已存在但没绑基础执行策略」——那种函数能建起来却写不了日志
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# ── 2. 打包 ─────────────────────────────────────────────
echo "[2/5] 打包代码"
PKG_DIR="$(mktemp -d)"
trap 'rm -rf "$PKG_DIR"' EXIT
PKG="$PKG_DIR/function.zip"
python3 - "$SRC" "$PKG" <<'PY'
import sys, zipfile
src, pkg = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(pkg, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(src, 'index.js')
PY
echo "  $(du -h "$PKG" | cut -f1) → index.js"

# ── 3. 创建或更新函数 ───────────────────────────────────
echo "[3/5] Lambda 函数"
if [ "$FN_EXISTS" -eq 1 ]; then
  # 上次更新可能还没落定（部署中断后重跑很常见），这时直接改代码会撞 ResourceConflictException
  aws lambda wait function-updated --function-name "$FN_NAME"
  aws lambda update-function-code --function-name "$FN_NAME" --zip-file "fileb://$PKG" >/dev/null
  aws lambda wait function-updated --function-name "$FN_NAME"
  echo "  已更新代码"
else
  # 角色刚建好时可能还没传播开，重试几次
  create_fn() {
    aws lambda create-function \
      --function-name "$FN_NAME" \
      --runtime "$RUNTIME" \
      --architectures "$ARCH" \
      --handler index.handler \
      --role "$ROLE_ARN" \
      --zip-file "fileb://$PKG" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY"
  }
  n=0
  until create_fn >/dev/null 2>&1; do
    n=$((n + 1))
    if [ "$n" -ge 10 ]; then
      # 临时 zip 退出时会被清掉，所以不能让人照抄命令，直接把原始报错打出来
      echo "× 创建函数失败，重试 10 次仍不通。以下是原始报错："
      create_fn || true
      exit 1
    fi
    echo "  …创建失败，第 $n 次重试"
    sleep 3
  done
  aws lambda wait function-active --function-name "$FN_NAME"
  echo "  已创建"
fi

# ── 4. 环境变量 + 超时内存 ──────────────────────────────
echo "[4/5] 环境变量与运行参数"
# 带上 --runtime：已存在的函数若还停在 nodejs20.x 这类过期运行时，重跑就顺手升上来
aws lambda update-function-configuration \
  --function-name "$FN_NAME" \
  --runtime "$RUNTIME" \
  --environment "$ENV_JSON" \
  --timeout "$TIMEOUT" \
  --memory-size "$MEMORY" >/dev/null
aws lambda wait function-updated --function-name "$FN_NAME"
INJECTED="$(printf '%s' "$ENV_JSON" | python3 -c 'import json,sys;print(", ".join(sorted(json.load(sys.stdin)["Variables"].keys())))')"
echo "  已注入：$INJECTED"

# ── 5. Function URL + 公网访问策略 ──────────────────────
echo "[5/5] Function URL"
if aws lambda get-function-url-config --function-name "$FN_NAME" >/dev/null 2>&1; then
  # 控制台手建过的 URL 默认是 AWS_IAM，不改回 NONE 公网一律 403。
  # 所以重跑时不能只看「存在」就放过，每次都把它拉回 NONE
  aws lambda update-function-url-config \
    --function-name "$FN_NAME" --auth-type NONE >/dev/null
  FN_URL="$(aws lambda get-function-url-config --function-name "$FN_NAME" --query FunctionUrl --output text)"
  echo "  已存在（已确保 AuthType=NONE）"
else
  # 这里刻意不传 --cors，让本函数自己返回 CORS 头，避免 AWS 注入造成重复头
  FN_URL="$(aws lambda create-function-url-config \
    --function-name "$FN_NAME" \
    --auth-type NONE \
    --query FunctionUrl --output text)"
  echo "  已创建"
fi

# AuthType=NONE 下资源策略必须两条并存，缺一条就是 403，而且报错完全指不到这里：
#   1) lambda:InvokeFunctionUrl + 条件 FunctionUrlAuthType=NONE —— 允许经 URL 调用
#   2) lambda:InvokeFunction    + 条件 InvokedViaFunctionUrl     —— 2025-10 起新增的硬要求
# 见 https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html
# 逐条查存在性再补，不能无脑重加：add-permission 撞上同名 statement-id 会报
# ResourceConflictException，那样重跑就挂了
POLICY_JSON="$(aws lambda get-policy --function-name "$FN_NAME" --query Policy --output text 2>/dev/null || true)"
add_stmt() { # add_stmt <语句ID> <动作> [附加参数...]
  local sid="$1" action="$2"
  shift 2
  if printf '%s' "$POLICY_JSON" | grep -q "\"$sid\""; then
    echo "  策略已存在：$sid"
    return 0
  fi
  aws lambda add-permission \
    --function-name "$FN_NAME" \
    --statement-id "$sid" \
    --action "$action" \
    --principal '*' "$@" >/dev/null
  echo "  策略已添加：$sid"
}
add_stmt FunctionURLAllowPublicAccess lambda:InvokeFunctionUrl --function-url-auth-type NONE
add_stmt FunctionURLAllowInvokeViaUrl lambda:InvokeFunction --invoked-via-function-url

# 策略齐了但 AuthType 被改回 AWS_IAM 一样是 403，跑完必须眼见为实
AUTH_TYPE="$(aws lambda get-function-url-config --function-name "$FN_NAME" --query AuthType --output text)"
if [ "$AUTH_TYPE" != "NONE" ]; then
  echo "× Function URL 的 AuthType 是 $AUTH_TYPE（应为 NONE），浏览器访问会 403。请检查后重跑"
  exit 1
fi

BASE="${FN_URL%/}"

# ── 输出 ────────────────────────────────────────────────
cat <<EOF

══════════════════════════════════════════════
  部署完成
══════════════════════════════════════════════

Function URL
  $BASE

代理口令
  $PROXY_TOKEN

填进应用后台（#/admin）的端点
  生成端点          $BASE/https/api.agnes-ai.cn/v1
  质检端点          $BASE/https/api-inference.modelscope.cn/v1
  生图端点 SenseNova $BASE/https/token.sensenova.cn/v1
  生图端点 DashScope $BASE/https/dashscope.aliyuncs.com

  各 API Key 全部留空，只填「代理口令」。
  注意 https 后面是一个斜杠，不是两个。

自测（返回 JSON 即链路通）
  curl -sS "$BASE/https/api.agnes-ai.cn/v1/chat/completions" \\
    -H "X-Proxy-Token: $PROXY_TOKEN" \\
    -H 'Content-Type: application/json' \\
    -d '{"model":"agnes-3.0-flash","messages":[{"role":"user","content":"ping"}],"max_tokens":1}'

让手机也生效（GitHub 仓库 → Settings → Secrets and variables → Actions → Variables）
  VITE_TEXT_BASE_URL        $BASE/https/api.agnes-ai.cn/v1
  VITE_CHECK_BASE_URL       $BASE/https/api-inference.modelscope.cn/v1
  VITE_DASH_BASE_URL        $BASE/https/dashscope.aliyuncs.com
  VITE_SENSENOVA_BASE_URL   $BASE/https/token.sensenova.cn/v1
  VITE_PROXY_TOKEN          $PROXY_TOKEN

加完去 Actions → Deploy Pages → Run workflow 手动跑一次。

改代码后重跑本脚本即可更新，角色/URL/口令都会沿用，不用重填。
EOF