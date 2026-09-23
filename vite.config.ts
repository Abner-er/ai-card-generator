import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as undici from 'undici';

/* ============================================================
 * AI 网关 + 后台配置插件（dev server 内置轻量后端）
 *
 * 职责：
 *  1. /__settings        GET/PUT/RESET —— 配置读写（key 脱敏返回，真实 key 只在服务端）
 *  2. /__settings/test/* POST —— 文本/生图模型连通性测试
 *  3. /ai-api/*          动态转发到文本模型端点（模型/端点/key 改了立即生效，无需重启）
 *  4. /ai-qwen/*         动态转发到 DashScope 生图端点
 *  5. /ai-image-proxy    远程图片转 base64（解决跨域）
 *
 * 配置持久化在项目根 settings.json（已 gitignore），启动时读取并与 .env 默认值合并。
 * ============================================================ */

const PLACEHOLDER_OK = (v: unknown) =>
  typeof v === 'string' && v.length > 0 && !v.includes('your-api-key-here');

interface GatewayConfig {
  mock: boolean;
  text: {
    model: string;
    checkModel: string;
    extractModel: string;
    temperature: number;
    selfCheckTemperature: number;
    extractTemperature: number;
  };
  image: { providerId: 'qwen' | 'sensenova'; model: string; promptExtend: boolean; maxRetries: number; retryBackoffMs: number };
  study: { initialEase: number; minEase: number; easyBonus: number };
  quiz: { defaultCount: number; defaultDifficulty: 'easy' | 'medium' | 'hard' };
  proxy: { textBaseUrl: string; dashBaseUrl: string; checkBaseUrl: string; sensenovaBaseUrl: string };
  keys: { agnes: string; dashscope: string; check: string; sensenova: string };
}

function deepMerge<T extends Record<string, any>>(base: T, patch: Partial<T> | null | undefined): T {
  if (!patch || typeof patch !== 'object') return base;
  const out: any = { ...base };
  for (const k of Object.keys(patch)) {
    const bv = (base as any)[k];
    const pv = (patch as any)[k];
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && pv && typeof pv === 'object' && !Array.isArray(pv)) {
      out[k] = deepMerge(bv, pv);
    } else if (pv !== undefined) {
      out[k] = pv;
    }
  }
  return out as T;
}

function maskKey(k: string): string {
  if (!PLACEHOLDER_OK(k)) return '';
  if (k.length <= 10) return '•••';
  return `${k.slice(0, 6)}…${k.slice(-3)}`;
}

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve_, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve_(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function readRawBody(req: any): Promise<Buffer | undefined> {
  return new Promise((resolve_, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve_(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

/* ---- 网页正文提取（/api/extract-url 用） ---- */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCodePoint(Number(d)); } catch { return ' '; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ' '; }
    })
    .replace(/&amp;/g, '&');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** 标签 → 纯文本（保留段落换行，先转义实体再兜底清掉伪标签） */
function htmlToText(seg: string): string {
  const s = seg
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(s)
    .replace(/<[^>\s]*>/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 2)
    .join('\n');
}

function pickTitle(html: string): string {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og && og[1].trim()) return decodeEntities(og[1]).trim();
  const wx = html.match(/var\s+msg_title\s*=\s*['"]([^'"]+)['"]/);
  if (wx && wx[1].trim()) return decodeEntities(wx[1]).trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return stripTags(t[1]);
  return '';
}

/** 从 HTML 里抽出标题 + 正文（微信公众号走 #js_content，通用走段落标签，兜底全文清洗） */
function extractArticle(html: string): { title: string; content: string } {
  const title = pickTitle(html);
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const i = cleaned.search(/id=["']js_content["']/i);
  if (i >= 0) {
    const rest = cleaned.slice(i);
    const gt = rest.indexOf('>');
    const body = gt >= 0 ? rest.slice(gt + 1) : rest;
    const e = body.search(
      /id=["']js_tags["']|id=["']js_temp_bottom_area["']|rich_media_tool|js_share_profile/i,
    );
    const content = htmlToText(e > 200 ? body.slice(0, e) : body);
    if (content.length >= 40) return { title, content: content.slice(0, 20000) };
  }

  const texts: string[] = [];
  const re = /<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const t = stripTags(m[2]);
    if (t.length >= 4) texts.push(t);
  }
  const seen = new Set<string>();
  const general = texts.filter((t) => (seen.has(t) ? false : (seen.add(t), true))).join('\n');
  if (general.length >= 40) return { title, content: general.slice(0, 20000) };

  return { title, content: htmlToText(cleaned).slice(0, 20000) };
}

function isSslError(e: unknown): boolean {
  const msg = String((e as any)?.cause?.message || (e as any)?.message || e);
  return /SSL|certificate|self-signed|unable to verify/i.test(msg);
}

async function extractFromUrlSafe(rawUrl: string): Promise<{ title: string; content: string }> {
  const headers = {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };
  let resp: Response;
  try {
    resp = await fetch(rawUrl, { headers, redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch (e) {
    // 部分站点用自签/过期证书：仅对 SSL 错误降级为不校验（本机开发环境，可接受）
    if (!isSslError(e)) throw e;
    resp = await (undici.fetch as any)(rawUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      dispatcher: new undici.Agent({ connect: { rejectUnauthorized: false } }),
    });
  }
  if (!resp.ok) throw new Error(`目标站点返回 HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const ctype = resp.headers.get('content-type') || '';
  const charset = ctype.match(/charset=([\w-]+)/i)?.[1];
  let text: string;
  try {
    text = new TextDecoder(charset || 'utf-8').decode(buf);
  } catch {
    text = buf.toString('utf8');
  }
  return extractArticle(text);
}

async function forward(
  req: any,
  res: any,
  baseUrl: string,
  subPath: string,
  apiKey: string,
  extraHeaders: Record<string, string> = {},
) {
  if (!baseUrl) return json(res, 502, { error: '未配置目标端点（检查后台管理 → 端点设置）' });
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readRawBody(req).catch(() => undefined);
  const headers: Record<string, string> = { ...extraHeaders };
  const ct = req.headers['content-type'];
  if (ct) headers['Content-Type'] = String(ct);
  if (PLACEHOLDER_OK(apiKey)) headers['Authorization'] = `Bearer ${apiKey}`;

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const path = subPath.startsWith('/') ? subPath : `/${subPath}`;
  const target = `${cleanBase}${path}`;

  try {
    const upstream = await fetch(target, { method: req.method, headers, body });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = upstream.status;
    const uct = upstream.headers.get('content-type');
    if (uct) res.setHeader('Content-Type', uct);
    res.end(buf);
  } catch (e) {
    json(res, 502, { error: `上游请求失败: ${target} — ${String(e)}` });
  }
}

function aiGatewayPlugin(): Plugin {
  return {
    name: 'ai-gateway',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      const settingsPath = resolve(process.cwd(), 'settings.json');

      const defaults: GatewayConfig = {
        mock: env.VITE_USE_MOCK === 'true',
        text: {
          model: env.VITE_TEXT_MODEL || 'agnes-2.5-flash',
          checkModel: env.VITE_CHECK_MODEL || '',
          extractModel: env.VITE_EXTRACT_MODEL || '',
          temperature: 0.6,
          selfCheckTemperature: 0,
          extractTemperature: 0.3,
        },
        image: {
          providerId: 'qwen',
          model: env.VITE_QWEN_MODEL || 'qwen-image-3.0',
          promptExtend: true,
          maxRetries: 3,
          retryBackoffMs: 20000,
        },
        study: { initialEase: 2.5, minEase: 1.3, easyBonus: 1.3 },
        quiz: { defaultCount: 10, defaultDifficulty: 'medium' },
        proxy: {
          textBaseUrl: 'https://api.agnes-ai.cn/v1',
          dashBaseUrl: env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
          checkBaseUrl: env.VITE_CHECK_BASE_URL || '',
          sensenovaBaseUrl: env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1',
        },
        keys: {
          agnes: env.AGNES_API_KEY || '',
          dashscope: env.DASHSCOPE_API_KEY || '',
          check: env.CHECK_API_KEY || '',
          sensenova: env.SENSENOVA_API_KEY || '',
        },
      };

      function loadDisk(): Partial<GatewayConfig> {
        try {
          if (existsSync(settingsPath)) return JSON.parse(readFileSync(settingsPath, 'utf8'));
        } catch (e) {
          console.warn('[ai-gateway] settings.json 解析失败，使用默认配置:', e);
        }
        return {};
      }

      let cfg: GatewayConfig = deepMerge(defaults, loadDisk());
      function save() {
        try {
          writeFileSync(settingsPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch (e) {
          console.error('[ai-gateway] 写入 settings.json 失败:', e);
        }
      }
      function publicView() {
        const { keys, ...rest } = cfg;
        return {
          ...rest,
          server: {
            proxy: cfg.proxy,
            keys: {
              agnes: { set: PLACEHOLDER_OK(keys.agnes), masked: maskKey(keys.agnes) },
              dashscope: { set: PLACEHOLDER_OK(keys.dashscope), masked: maskKey(keys.dashscope) },
              check: { set: PLACEHOLDER_OK(keys.check), masked: maskKey(keys.check) },
              sensenova: { set: PLACEHOLDER_OK(keys.sensenova), masked: maskKey(keys.sensenova) },
            },
          },
        };
      }

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const qIndex = rawUrl.indexOf('?');
        const url = qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl;
        const query = qIndex >= 0 ? rawUrl.slice(qIndex) : '';

        try {
          /* ---- 配置 API ---- */
          if (url === '/__settings' && req.method === 'GET') {
            return json(res, 200, publicView());
          }
          if (url === '/__settings' && req.method === 'PUT') {
            const body = await readJsonBody(req);
            if (body.settings) cfg = deepMerge(cfg, body.settings);
            if (body.proxy) cfg.proxy = deepMerge(cfg.proxy, body.proxy);
            if (body.keys) {
              if (typeof body.keys.agnes === 'string' && body.keys.agnes) {
                cfg.keys.agnes = body.keys.agnes === '__CLEAR__' ? '' : body.keys.agnes;
              }
              if (typeof body.keys.dashscope === 'string' && body.keys.dashscope) {
                cfg.keys.dashscope = body.keys.dashscope === '__CLEAR__' ? '' : body.keys.dashscope;
              }
              if (typeof body.keys.check === 'string' && body.keys.check) {
                cfg.keys.check = body.keys.check === '__CLEAR__' ? '' : body.keys.check;
              }
              if (typeof body.keys.sensenova === 'string' && body.keys.sensenova) {
                cfg.keys.sensenova = body.keys.sensenova === '__CLEAR__' ? '' : body.keys.sensenova;
              }
            }
            save();
            return json(res, 200, publicView());
          }
          if (url === '/__settings/reset' && req.method === 'POST') {
            cfg = deepMerge(defaults, {});
            save();
            return json(res, 200, publicView());
          }

          /* ---- 连通性测试 ---- */
          if (url === '/__settings/test/text' && req.method === 'POST') {
            if (!PLACEHOLDER_OK(cfg.keys.agnes)) {
              return json(res, 200, { ok: false, error: '未配置文本模型 API Key' });
            }
            const t0 = Date.now();
            try {
              const r = await fetch(`${cfg.proxy.textBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${cfg.keys.agnes}`,
                },
                body: JSON.stringify({
                  model: cfg.text.model,
                  messages: [{ role: 'user', content: 'ping' }],
                  max_tokens: 1,
                }),
              });
              const latencyMs = Date.now() - t0;
              if (r.ok) return json(res, 200, { ok: true, latencyMs, model: cfg.text.model });
              const txt = (await r.text()).slice(0, 200);
              return json(res, 200, { ok: false, latencyMs, error: `HTTP ${r.status} ${txt}` });
            } catch (e) {
              return json(res, 200, { ok: false, error: `网络错误: ${String(e)}` });
            }
          }
          if (url === '/__settings/test/check' && req.method === 'POST') {
            const base = cfg.proxy.checkBaseUrl || cfg.proxy.textBaseUrl;
            const key = cfg.keys.check || cfg.keys.agnes;
            const model = cfg.text.checkModel || cfg.text.model;
            if (!PLACEHOLDER_OK(key)) {
              return json(res, 200, { ok: false, error: '未配置质检模型的 API Key' });
            }
            const t0 = Date.now();
            try {
              const r = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                  model,
                  messages: [{ role: 'user', content: 'ping' }],
                  max_tokens: 8,
                }),
              });
              const latencyMs = Date.now() - t0;
              if (r.ok) return json(res, 200, { ok: true, latencyMs, model });
              const txt = (await r.text()).slice(0, 200);
              return json(res, 200, { ok: false, latencyMs, error: `HTTP ${r.status} ${txt}` });
            } catch (e) {
              return json(res, 200, { ok: false, error: `网络错误: ${String(e)}` });
            }
          }
          if (url === '/__settings/test/image' && req.method === 'POST') {
            /* SenseNova 探活：按 providerId 分流 */
            if (cfg.image.providerId === 'sensenova') {
              if (!PLACEHOLDER_OK(cfg.keys.sensenova)) {
                return json(res, 200, { ok: false, error: '未配置 SenseNova API Key' });
              }
              const t0 = Date.now();
              try {
                const r = await fetch(
                  `${cfg.proxy.sensenovaBaseUrl.replace(/\/+$/, '')}/images/generations`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${cfg.keys.sensenova}`,
                    },
                    body: JSON.stringify({ model: cfg.image.model, prompt: 'ping', n: 1, size: '1024x1024' }),
                  },
                );
                const latencyMs = Date.now() - t0;
                if (r.status === 401 || r.status === 403) {
                  const txt = (await r.text()).slice(0, 200);
                  return json(res, 200, { ok: false, latencyMs, error: `Key 无效: HTTP ${r.status} ${txt}` });
                }
                return json(res, 200, { ok: true, latencyMs, model: cfg.image.model, note: '鉴权通过（探活请求，未实际生图）' });
              } catch (e) {
                return json(res, 200, { ok: false, error: `网络错误: ${String(e)}` });
              }
            }
            if (!PLACEHOLDER_OK(cfg.keys.dashscope)) {
              return json(res, 200, { ok: false, error: '未配置 DashScope API Key' });
            }
            // 探活：发送一个空 content 的合法结构请求。
            // key 无效 → 401/403；key 有效但参数不全 → 400（说明鉴权已通过，不产生费用）
            const t0 = Date.now();
            try {
              const r = await fetch(
                `${cfg.proxy.dashBaseUrl.replace(/\/+$/, '')}/api/v1/services/aigc/multimodal-generation/generation`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${cfg.keys.dashscope}`,
                    'X-DashScope-Async': 'disable',
                  },
                  body: JSON.stringify({
                    model: cfg.image.model,
                    input: { messages: [{ role: 'user', content: [] }] },
                  }),
                },
              );
              const latencyMs = Date.now() - t0;
              if (r.status === 401 || r.status === 403) {
                const txt = (await r.text()).slice(0, 200);
                return json(res, 200, { ok: false, latencyMs, error: `Key 无效: HTTP ${r.status} ${txt}` });
              }
              return json(res, 200, { ok: true, latencyMs, model: cfg.image.model, note: '鉴权通过（探活请求，未实际生图）' });
            } catch (e) {
              return json(res, 200, { ok: false, error: `网络错误: ${String(e)}` });
            }
          }

          /* ---- 网页正文提取（URL 输入用；服务端抓取绕开浏览器 CORS） ---- */
          if (url === '/api/extract-url' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const text = String(body?.url || '').trim();
            if (!/^https?:\/\//i.test(text)) {
              return json(res, 400, { error: '请提供 http(s) 完整链接' });
            }
            try {
              const art = await extractFromUrlSafe(text);
              if (!art.content || art.content.length < 40) {
                return json(res, 502, { error: '未能提取到正文（页面可能需登录、被反爬拦截或为纯动态渲染）' });
              }
              return json(res, 200, art);
            } catch (e) {
              return json(res, 502, { error: `抓取失败: ${String((e as any)?.message || e)}` });
            }
          }

          /* ---- 模型网关（动态读取配置） ---- */
          if (url.startsWith('/ai-api')) {
            return await forward(req, res, cfg.proxy.textBaseUrl, url.slice('/ai-api'.length) + query, cfg.keys.agnes);
          }
          /* B 模型（质检）网关：配了独立端点/Key 就走独立的，否则回退 A 端点 */
          if (url.startsWith('/ai-check-api')) {
            return await forward(
              req, res,
              cfg.proxy.checkBaseUrl || cfg.proxy.textBaseUrl,
              url.slice('/ai-check-api'.length) + query,
              cfg.keys.check || cfg.keys.agnes,
            );
          }
          if (url.startsWith('/ai-qwen')) {
            return await forward(req, res, cfg.proxy.dashBaseUrl, url.slice('/ai-qwen'.length) + query, cfg.keys.dashscope, {
              'X-DashScope-Async': 'disable',
            });
          }
          /* 商汤 SenseNova 生图网关（OpenAI 兼容：/images/generations、/images/edits） */
          if (url.startsWith('/ai-sensenova')) {
            return await forward(req, res, cfg.proxy.sensenovaBaseUrl, url.slice('/ai-sensenova'.length) + query, cfg.keys.sensenova);
          }
        } catch (e) {
          return json(res, 500, { error: String(e) });
        }
        next();
      });
    },
  };
}

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
export default defineConfig(() => {
  return {
    // GitHub Pages 项目页部署在 /<repo>/ 子路径下；SPA 无路由 history 依赖，
    // 用相对路径 base 一次构建通吃根域/子路径/本地 file 预览
    base: './',
    plugins: [react(), aiGatewayPlugin(), imageProxyPlugin()],
  };
});
