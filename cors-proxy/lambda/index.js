/**
 * AWS Lambda — AI API CORS 代理 + Key 托管（Function URL 模式）
 *
 * 两个作用：
 *   1. 解决纯静态部署（GitHub Pages）下浏览器直连 AI API 被 CORS 拦截的问题。
 *   2. 托管 API Key：Key 存在 Lambda 环境变量里，由本函数在服务端注入。
 *      浏览器永远拿不到 Key，只带一个口令。适合把应用分享给别人、共享自己额度的场景。
 *
 * ─────────── 部署步骤 ───────────
 * 1. Lambda 控制台 → 创建函数
 *    - 名称：ai-cors-proxy
 *    - 运行时：Node.js 20.x
 *    - 架构：arm64（更便宜）
 * 2. 把本文件内容粘进 index.js（handler 保持默认 index.handler）
 * 3. 配置 → 环境变量 → 按下表添加（只加你实际用到的）
 *      KEY_AGNES        Agnes 文本 Key
 *      KEY_CHECK        ModelScope 质检 Key
 *      KEY_DASHSCOPE    DashScope 生图 Key
 *      KEY_SENSENOVA    SenseNova 生图 Key
 *      KEY_NVIDIA       NVIDIA 文本 Key
 *      PROXY_TOKEN      访问口令，随便生成一串 32 位以上随机字符
 *      ALLOWED_ORIGINS  可选，逗号分隔。填了就只允许这些来源调用
 * 4. 配置 → 常规配置 → 超时时间改成 60 秒（生图要等，别用默认 3 秒），内存 256MB 足够
 * 5. 配置 → 函数 URL → 创建函数 URL
 *    - 授权类型：NONE（必须，否则 Authorization 头会被 SigV4 吃掉）
 *    - 跨源资源共享 (CORS)：**不要配置**（见下方说明）
 * 6. 在应用「后台管理」填端点（https 后面是一个斜杠）：
 *      生成端点：https://xxx.lambda-url.ap-northeast-1.on.aws/https/integrate.api.nvidia.com/v1
 *      生图端点：https://xxx.lambda-url.ap-northeast-1.on.aws/https/dashscope.aliyuncs.com
 *    代理口令填 PROXY_TOKEN 的值，各 API Key 全部留空。
 *
 * ─────────── 为什么是 Function URL 而不是 API Gateway ───────────
 * API Gateway HTTP API 集成超时上限 30 秒，生图请求经常 30~60 秒，会稳定超时。
 * Function URL 上限 15 分钟（受函数超时时间约束），适合长请求。
 *
 * ─────────── 为什么 Function URL 的 CORS 要关掉 ───────────
 * 开了它 AWS 会自动注入 Access-Control-Allow-Origin，本函数再返回一次就是重复头，
 * 浏览器会因为 "multiple values" 直接拒绝。全部交给本函数处理更可控。
 *
 * ─────────── 防泄露要点 ───────────
 * - Key 只从环境变量读取，任何情况下都不写进响应体、响应头或日志。
 * - 转发前先剥掉浏览器发来的 Authorization，避免旧值干扰。
 * - 回给浏览器的响应头里过滤掉 authorization / x-proxy-token，防止上游回显。
 * - 出错信息只回状态码和上游正文，不含请求头。
 */

// ── 配置 ──────────────────────────────────────────

/**
 * 目标域名 → 环境变量名。
 * 这里列出的域名同时构成白名单：不在表里的域名一律拒绝转发。
 * 环境变量为空或未配置 → 该域名不注入 Key，透传浏览器发来的 Authorization。
 */
const KEY_ENV = {
  'integrate.api.nvidia.com': 'KEY_NVIDIA',
  'api-inference.modelscope.cn': 'KEY_CHECK',
  'api.agnes-ai.cn': 'KEY_AGNES',
  'dashscope.aliyuncs.com': 'KEY_DASHSCOPE',
  'token.sensenova.cn': 'KEY_SENSENOVA',
};

/** 转发给上游时要去掉的请求头 */
const STRIP_REQ_HEADERS = [
  'host',            // 由 fetch 按目标地址重写
  'connection',
  'content-length',  // fetch 按实际 body 重算
  'accept-encoding', // 强制上游返回未压缩内容，避免 Content-Encoding 处理出错
  'x-proxy-token',   // 内部口令，不上行
];

/** 回给浏览器时要去掉的响应头（Lambda 自己处理这些，或属于敏感信息） */
const STRIP_RES_HEADERS = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'authorization',   // 万一上游回显
  'x-proxy-token',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DashScope-Async, X-Proxy-Token, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// ── 主逻辑 ──────────────────────────────────────────

/**
 * 从请求路径还原真实目标 URL。
 * 支持两种写法，后者是为了绕开 Function URL 前置 CloudFront 对 `//` 的规范化：
 *   /https/api.example.com/v1/chat/completions   ← 推荐
 *   /https://api.example.com/v1/chat/completions ← 兼容
 */
function resolveTarget(rawPath, search) {
  let rest = rawPath.replace(/^\/+/, '');

  // 顺序不能反：'https://x' 也满足 startsWith('https/')，必须先判三斜杠形式
  if (rest.startsWith('https://') || rest.startsWith('http://')) {
    // 原样
  } else if (rest.startsWith('https/')) {
    rest = 'https://' + rest.slice('https/'.length);
  } else if (rest.startsWith('http/')) {
    rest = 'http://' + rest.slice('http/'.length);
  } else {
    return null;
  }

  return rest + search;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(payload),
  };
}

/** 文本类响应直接返回字符串，二进制（图片）转 base64 */
function looksLikeText(contentType) {
  return /^(text\/|application\/(json|xml|javascript|x-ndjson|problem\+json))/.test(contentType);
}

exports.handler = async (event) => {
  const method = event?.requestContext?.http?.method || 'GET';
  const rawPath = event?.rawPath || '/';
  const reqHeaders = event?.headers || {};

  // 预检：直接放行，不打上游
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // 来源校验（可选，配了 ALLOWED_ORIGINS 才生效）
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (allowedOrigins.length) {
    const origin = reqHeaders.origin || reqHeaders.Origin || '';
    if (!allowedOrigins.includes(origin)) {
      return jsonResponse(403, { error: '来源不在允许列表中' });
    }
  }

  // 口令校验（配了 PROXY_TOKEN 才生效）
  const expectedToken = process.env.PROXY_TOKEN || '';
  if (expectedToken) {
    const got = reqHeaders['x-proxy-token'] || reqHeaders['X-Proxy-Token'] || '';
    if (got !== expectedToken) {
      return jsonResponse(401, { error: '代理口令缺失或错误' });
    }
  }

  const search = event?.rawQueryString ? `?${event.rawQueryString}` : '';
  const targetUrl = resolveTarget(rawPath, search);

  if (!targetUrl) {
    return jsonResponse(400, {
      error: '路径缺少目标 URL。格式：/https/api.example.com/v1/chat/completions',
      got: rawPath,
    });
  }

  // 域名白名单：只放行 KEY_ENV 里登记的域名
  let targetHost;
  try {
    targetHost = new URL(targetUrl).hostname;
  } catch {
    return jsonResponse(400, { error: '目标 URL 格式无效' });
  }
  if (!Object.prototype.hasOwnProperty.call(KEY_ENV, targetHost)) {
    return jsonResponse(403, { error: `域名 ${targetHost} 不在白名单内` });
  }

  // 组装转发请求头
  const fwdHeaders = {};
  for (const [k, v] of Object.entries(reqHeaders)) {
    if (STRIP_REQ_HEADERS.includes(k.toLowerCase())) continue;
    fwdHeaders[k] = v;
  }

  // Key 注入：环境变量里有就用它，并覆盖浏览器发来的一切 Authorization
  const envName = KEY_ENV[targetHost];
  const injectedKey = (process.env[envName] || '').trim();
  if (injectedKey) {
    fwdHeaders.Authorization = `Bearer ${injectedKey}`;
  }

  const hasBody = event?.body !== undefined && event.body !== null && method !== 'GET' && method !== 'HEAD';
  const body = hasBody
    ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body)
    : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: fwdHeaders,
      body,
      redirect: 'follow',
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || '';
    const asText = looksLikeText(contentType);

    const resHeaders = { ...CORS_HEADERS };
    upstream.headers.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (STRIP_RES_HEADERS.includes(lk)) return;
      if (lk.startsWith('access-control-')) return; // 用我们自己的，避免重复
      resHeaders[k] = v;
    });

    return {
      statusCode: upstream.status,
      headers: resHeaders,
      body: asText ? buf.toString('utf8') : buf.toString('base64'),
      isBase64Encoded: !asText,
    };
  } catch (e) {
    // 只回错误摘要，不回请求头，避免意外带出凭证
    return jsonResponse(502, {
      error: `转发到 ${targetHost} 失败：${e.message}`,
    });
  }
};