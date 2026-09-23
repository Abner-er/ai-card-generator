/**
 * blocks/gateway.ts — AI 请求统一路由
 *
 * 双模式核心：
 *  - server 模式（dev）：路径原样发出，由 vite dev server 反代并注入 Key（行为与之前完全一致）。
 *  - local 模式（静态部署，如 GitHub Pages）：把 /ai-api、/ai-check-api、/ai-qwen、/ai-sensenova
 *    前缀翻译成真实端点 URL，并从 localStorage 取 Key 注入 Authorization 头。
 *    端点 CORS 实测均放行浏览器直调（allow-origin: *）。
 *
 * 所有原本 fetch('/ai-…') 的调用点一律改走 gatewayFetch，保证两种模式行为一致。
 */
import { getMode, getProxy, getLocalKeys, type LocalKeys } from './settings';

interface Route {
  prefix: string;
  base: (p: ReturnType<typeof getProxy>) => string;
  key: (k: LocalKeys) => string;
  /** 需要额外注入的请求头（对齐 dev server forward 的行为） */
  extraHeaders?: Record<string, string>;
}

const ROUTES: Route[] = [
  { prefix: '/ai-api', base: (p) => p.textBaseUrl, key: (k) => k.agnes },
  { prefix: '/ai-check-api', base: (p) => p.checkBaseUrl || p.textBaseUrl, key: (k) => k.check || k.agnes },
  { prefix: '/ai-qwen', base: (p) => p.dashBaseUrl, key: (k) => k.dashscope, extraHeaders: { 'X-DashScope-Async': 'disable' } },
  { prefix: '/ai-sensenova', base: (p) => p.sensenovaBaseUrl, key: (k) => k.sensenova },
];

/** base + path 拼接，处理斜杠边界 */
export function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return b + p;
}

/** dev server 里 /__settings 等管理端点在纯静态部署不存在，给出可读错误 */
function keyMissingError(name: string): Error {
  const label: Record<string, string> = {
    agnes: '生成（Agnes）',
    check: '质检',
    dashscope: 'DashScope 生图',
    sensenova: 'SenseNova 生图',
  };
  return new Error(`未配置 ${label[name] ?? name} API Key：请进入「后台管理」，在本地模式下的 Key 输入框填写并保存（仅存本浏览器）`);
}

/** 把远程图片 URL 转成 data URL（local 模式下替代 /ai-image-proxy 服务端代理） */
async function browserImageProxy(rawUrl: string): Promise<Response> {
  try {
    const r = await fetch(rawUrl);
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `Image fetch failed: ${r.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const blob = await r.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    return new Response(JSON.stringify({ data: dataUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // CORS 拦截等：返回非 200，调用方（toDataUrl）自带回退原始 URL 的兜底
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * local 直连是浏览器专属能力：依赖 localStorage 存 Key、依赖同源相对路径由
 * dev server 代理兜底。非浏览器环境（node / vitest / CI）没有这些前提，
 * 一律透传给全局 fetch——测试仍可 stub fetch 验证业务层请求构造。
 * （内容提取的静态部署守卫复用此判定，见 contentExtractor.ts）
 */
export function isBrowserLike(): boolean {
  return typeof window !== 'undefined' && typeof location !== 'undefined';
}

export async function gatewayFetch(url: string, init: RequestInit = {}): Promise<Response> {
  // server 模式：一切照旧，交给 vite dev 代理
  if (getMode() === 'server') return fetch(url, init);

  // —— local 模式（仅浏览器） ——
  if (!isBrowserLike()) return fetch(url, init);

  if (url.startsWith('/ai-image-proxy')) {
    const target = new URL(url, location.href).searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    return browserImageProxy(target);
  }

  const route = ROUTES.find((r) => url.startsWith(r.prefix));
  if (!route) return fetch(url, init); // 非 AI 路径不动

  const proxy = getProxy();
  const keys = getLocalKeys();
  const key = route.key(keys);
  if (!key) {
    const name = route.prefix === '/ai-api' ? 'agnes' : route.prefix === '/ai-check-api' ? (keys.check ? 'check' : 'agnes') : route.prefix === '/ai-qwen' ? 'dashscope' : 'sensenova';
    throw keyMissingError(name);
  }
  const base = route.base(proxy);
  if (!base) throw new Error('端点（Base URL）未配置：请在「后台管理」本地模式下填写端点');

  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${key}`);
  for (const [k, v] of Object.entries(route.extraHeaders ?? {})) headers.set(k, v);

  return fetch(joinUrl(base, url.slice(route.prefix.length)), { ...init, headers });
}
