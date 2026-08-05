import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// 图片代理插件：服务端下载远程图片并转为 base64 返回给前端
// 解决浏览器跨域加载 AI 生成的远程图片 URL 的问题
function imageProxyPlugin(): Plugin {
  return {
    name: 'image-proxy',
    configureServer(server) {
      server.middlewares.use('/ai-image-proxy', async (req, res) => {
        const fullUrl = req.url || '';
        const urlParam = new URL(fullUrl, 'http://localhost').searchParams.get('url');
        if (!urlParam) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }
        try {
          const response = await fetch(urlParam);
          if (!response.ok) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Image fetch failed: ${response.status}` }));
            return;
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const base64 = buffer.toString('base64');
          const contentType = response.headers.get('content-type') || 'image/png';
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: `data:${contentType};base64,${base64}` }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量（读取 .env 文件）
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), imageProxyPlugin()],
    server: {
      proxy: {
        // 统一代理：所有 /ai-api 开头的请求转发到 Agnes AI（OpenAI 兼容协议）
        // API Key 由服务端代理持有，不暴露给前端
        '/ai-api': {
          target: 'https://api.agnes-ai.cn/v1',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/ai-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const apiKey = env.AGNES_API_KEY;
              if (apiKey && apiKey !== 'sk-agnes-your-api-key-here') {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              }
            });
          },
        },
      },
    },
  };
});
