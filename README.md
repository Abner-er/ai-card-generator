# 提示词工坊 · Knowledge Card Prompt Workshop

把一段知识变成一套能直接发布的图文卡片。

AI 只负责画底图，文字交给 HTML 排版，最后用浏览器截图合成成品。这么做是因为国内大模型直接渲染中文时文字经常崩坏——让 AI 管画面，让代码管写字，两边各自做擅长的事。

## 它做什么

输入主题、粘贴文本、上传文件或网页 URL → AI 拆解成结构化知识模块 → 为每张卡片生成视觉提示词 → 出底图 → 套排版 → 导出 PNG。

主流程之外还有几个可选环节：

- **自检**：用另一个模型复核内容，给出可一键采纳的修正建议
- **复习**：按间隔重复算法把知识点做成闪卡，带到期队列
- **测验**：按知识模块自动出题
- **学习**：把知识点扩写成延伸阅读
- **概念图谱**：可视化模块之间的关联

示例产出（守株待兔系列 6 张）：[_archive/examples/real-shouzhu](_archive/examples/real-shouzhu)

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
```

没有任何 API Key 也能跑通全流程：把 `VITE_USE_MOCK` 设为 `true`，出图会退化成 SVG 占位图。

## 部署自己的实例

这个项目按「谁用谁部署」设计：仓库公开，你 fork 一份，部署到自己的 GitHub Pages，配自己的模型通道和额度。不依赖任何中心服务。

### 1. 配置构建期变量

复制 `.env.example` 里的变量名，在 GitHub 仓库的 **Settings → Secrets and variables → Actions → Variables** 里添加（注意是 Variables 不是 Secrets，见下方安全说明）。CI 会在构建时注入。

常用变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_APP_NAME` | `提示词工坊` | 应用名，影响导航栏与浏览器标题 |
| `VITE_APP_SUBTITLE` | `Knowledge Card Prompt Workshop` | 副标题 |
| `VITE_TEXT_BASE_URL` | `https://api.agnes-ai.cn/v1` | 文本模型端点 |
| `VITE_CHECK_BASE_URL` | 空 | 质检模型端点，留空回退到文本端点 |
| `VITE_DASH_BASE_URL` | `https://dashscope.aliyuncs.com` | 通义万相生图端点 |
| `VITE_SENSENOVA_BASE_URL` | `https://token.sensenova.cn/v1` | 商汤生图端点 |
| `VITE_PROXY_TOKEN` | 空 | 代理口令，填了就走「代理托管」模式 |
| `VITE_TEXT_MODEL` | `agnes-2.5-flash` | 文本模型名 |
| `VITE_QWEN_MODEL` | `qwen-image-3.0` | 生图模型名 |
| `VITE_USE_MOCK` | `false` | `true` = 完全离线跑通 |

推送 `main` 触发 `.github/workflows/deploy-pages.yml` 自动构建部署。

### 2. 选一条模型通道

**A. 代理托管（推荐给要分享出去的部署）**

API Key 放在自建 CORS 代理上，由代理在服务端注入。访客打开就能用，浏览器里从头到尾没有 Key。你随时能改 Key 或换口令，客户端不用重新部署。

配置方式：`VITE_TEXT_BASE_URL` 指向代理地址，`VITE_PROXY_TOKEN` 填代理口令。详见「自建 CORS 代理」。

**B. 浏览器自带 Key**

访客在后台自己填 Key，存在自己浏览器的 localStorage 里。适合每个人都用自己的额度。此时 `VITE_PROXY_TOKEN` 留空。

### 3. 后台入口

导航栏里没有后台按钮。在地址栏敲 `#/admin` 进入。

> ⚠️ 这只是把入口藏起来，不是权限控制。任何人敲这个地址都能进，也能通过 devtools 直接改 localStorage。「隐藏」解决的是界面干净，防不住有心人。

后台里可以改模型参数、端点、Key，以及导出/导入配置（换浏览器或换设备时搬运设置用）。

## 自建 CORS 代理

纯静态部署下，浏览器直连 AI API 会被 CORS 拦截——多数服务商不返回 `Access-Control-Allow-Origin` 头。代理在服务端转发请求，再把 CORS 头补上。

`cors-proxy/` 下有两份实现，挑一个：

| 文件 | 平台 | 说明 |
|------|------|------|
| [`cors-proxy/lambda/index.js`](cors-proxy/lambda/index.js) | AWS Lambda Function URL | 文件头有完整部署步骤 |
| [`cors-proxy/worker.js`](cors-proxy/worker.js) | Cloudflare Worker | 免费、五分钟搭好 |

端点写法是把真实地址拼在代理地址后面：

```
https://你的代理地址/https/api.agnes-ai.cn/v1
```

注意 `https` 后面是**一个**斜杠，不是两个。这是为了绕开 Function URL 前置 CloudFront 对 `//` 的路径规范化——写成两个斜杠会被吃掉，目标地址就废了。代理代码里两种写法都兼容。

**为什么用 Function URL 而不是 API Gateway**：API Gateway HTTP API 的集成超时上限是 30 秒，而生图请求经常要 30~60 秒，必然超时。Function URL 的上限是 15 分钟。

### Key 放在代理上

Lambda 环境变量（Cloudflare Worker 同理，改 `env` 取值方式）：

```
KEY_AGNES        Agnes 文本 Key
KEY_CHECK        ModelScope 质检 Key
KEY_DASHSCOPE    DashScope 生图 Key
KEY_SENSENOVA    SenseNova 生图 Key
PROXY_TOKEN      访问口令，生成一串 32 位以上随机字符
ALLOWED_ORIGINS  可选，逗号分隔。填了就只允许这些来源调用
```

## 关于密钥，把话说清楚

这套设计里哪些是机密、哪些不是，别搞混：

- **`VITE_PROXY_TOKEN` 不是机密。** `VITE_` 前缀的变量会被明文打进前端 JS，任何人打开 devtools 都能读到。它唯一的作用是挡住第三方网站盗用你的端点，以及过滤随机爬虫。所以它该放 GitHub **Variables** 而不是 Secrets——放 Secrets 也一样会进产物，只是给自己一个错误的安全感。
- **真正的 API Key 放在代理的环境变量里**，永远不进浏览器。这是「代理托管」模式的核心价值。
- **Lambda 环境变量对同账号有 IAM 权限的人可见。** 别给不该给的人开权限。想更严就上 SSM Parameter Store 的 SecureString。
- **拿到口令的人能用你的额度。** 这是分享的代价，绕不开。换 `PROXY_TOKEN` 可以踢人；换 `KEY_*` 可以轮换 Key，后者客户端完全不用动。
- **代理侧没有限额。** 想按人限流得自己加存储层（DynamoDB / KV 计数）。

## 开发

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器。走 dev server 反向代理，没有 CORS 问题，也不需要代理口令 |
| `npm test` | 跑测试 |
| `npm run build` | 构建 |
| `npm run check` | `tsc` + `vitest` + `build` 全量校验，提交前跑这个 |

### 静态约定扫描

`src/blocks/conventions.test.ts` 是个棘轮测试：每条规则对应一个历史缺陷，只扫写法不测行为。任何人重新引入同类写法，`npm run check` 直接红。目前覆盖中文数字数、标题截断、catch 后静默降级假内容、提示词吞掉风格参数、自检采纳断层。

## 项目结构

```
src/
├── App.tsx                  主流程与步骤导航
├── AdminView.tsx            后台（#/admin）
├── StudyView.tsx            复习（闪卡 + 间隔重复）
├── QuizView.tsx             测验
├── LearnBrowseView.tsx      延伸阅读
├── BatchExportView.tsx      批量导出
├── CardGallery.tsx          卡片画廊
├── ConceptGraph.tsx         概念图谱
├── StepErrorBoundary.tsx    单步错误边界，避免一处抛错整树卸载
├── blocks/                  纯逻辑层，不依赖 React，可单测
│   ├── gateway.ts           请求路由：前缀 → 真实端点，Key / 口令注入
│   ├── settings.ts          配置中心（server / local 双模式）
│   ├── decompose.ts         知识拆解
│   ├── styleEngine.ts       风格预设与六段式提示词构建
│   ├── imageProvider.ts     生图服务商适配（通义万相 / 商汤 / Mock）
│   ├── qualityCheck.ts      质检（B 模型复核）
│   ├── selfCheck.ts         自检与一键采纳
│   ├── contentExtractor.ts  网页 / PDF / 文件内容抽取
│   ├── spacedRepetition.ts  间隔重复算法
│   ├── quizSystem.ts        出题逻辑
│   └── textUtil.ts          中文字数、标题截断等
└── style.css                CSS 变量主题（深色 / 浅色）
```

样式以内联 `style` + CSS 变量为主，Tailwind 只作为全局基础样式引入。

## License

MIT