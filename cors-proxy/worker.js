/**
 * Cloudflare Worker — AI API CORS 代理
 *
 * 解决 GitHub Pages 等纯静态部署下浏览器直连 API 被 CORS 拦截的问题。
 * Worker 在服务端转发请求（服务端不受 CORS 限制），并给响应加上 CORS 头。
 *
 * 部署步骤：
 *   1. 注册 Cloudflare 账号（免费）
 *   2. Workers & Pages → Create application → Create Worker
 *   3. 取个名字（如 ai-cors-proxy），粘贴本文件内容，Deploy
 *   4. 拿到 Worker 地址，如 https://ai-cors-proxy.your-name.workers.dev
 *   5. 在应用后台管理的「生成端点」填：
 *      https://ai-cors-proxy.your-name.workers.dev/https://integrate.api.nvidia.com/v1
 *      （即 Worker地址 + / + 真实API的完整Base URL）
 *
 * 用法：
 *   原本：textBaseUrl = https://integrate.api.nvidia.com/v1
 *   改为：textBaseUrl = https://ai-cors-proxy.your-name.workers.dev/https://integrate.api.nvidia.com/v1
 *   gateway 会拼出：https://ai-cors-proxy.../https://integrate.api.nvidia.com/v1/chat/completions
 *   Worker 收到后去掉前缀，转发到真实地址。
 *
 * 安全提示：
 *   这是一个开放代理。如果担心被滥用，可以在 ALLOWED_HOSTS 里加白名单，
 *   只放行你用的 API 域名。或者加一个简单的 token 校验。
 */

// 可选：限制只允许转发到这些域名（留空数组 = 不限制）
const ALLOWED_HOSTS = [
  'integrate.api.nvidia.com',
  'api.agnes-ai.cn',
  'dashscope.aliyuncs.com',
  'token.sensenova.cn',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DashScope-Async',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    // 路径格式：/https://api.example.com/v1/chat/completions
    // 去掉开头的 / 得到目标完整 URL
    const targetUrl = url.pathname.slice(1) + url.search;

    if (!targetUrl.startsWith('http')) {
      return new Response(JSON.stringify({ error: '路径中缺少目标 URL，格式：/<完整API地址>' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // 域名白名单校验
    if (ALLOWED_HOSTS.length > 0) {
      let targetHost;
      try {
        targetHost = new URL(targetUrl).hostname;
      } catch {
        return new Response(JSON.stringify({ error: '目标 URL 格式无效' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      if (!ALLOWED_HOSTS.includes(targetHost)) {
        return new Response(JSON.stringify({ error: `域名 ${targetHost} 不在白名单中` }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    // 转发请求到真实 API
    try {
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined,
      });

      // 复制响应头并加上 CORS
      const headers = new Headers(resp.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.delete('Content-Encoding'); // 避免重复压缩

      return new Response(resp.body, {
        status: resp.status,
        headers,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: `转发失败: ${e.message}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  },
};
