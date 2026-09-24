/**
 * gateway 回归测试 — 钉死 local 直连架构的核心契约
 *
 * 背景：GitHub Pages 静态部署无 dev server，AI 请求必须由浏览器直连真实端点。
 * 契约：
 *  1. /ai-* 前缀 → 真实端点 URL 改写 + localStorage Key 注入 Authorization
 *  2. /ai-check-api 未配独立端点/Key 时回退生成链路（与 vite 代理行为一致）
 *  3. /ai-qwen 附带 X-DashScope-Async: disable（同步返回，对齐 dev 代理）
 *  4. Key 缺失显式抛错引导去「后台管理」，绝不静默发出无鉴权请求
 *  5. server 模式与非浏览器环境（node/CI）原样透传——业务测试仍可 stub fetch
 *  6. 代理托管模式：配了口令则允许无 Key，请求带 X-Proxy-Token 且不带 Authorization
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

/** gateway 的 local 分支判定依赖 window + location + localStorage（存 key） */
function stubBrowser(storage: ReturnType<typeof fakeStorage>) {
  vi.stubGlobal('window', {});
  vi.stubGlobal('location', { href: 'https://abner-er.github.io/ai-card-generator/' });
  vi.stubGlobal('localStorage', storage);
}

function okJsonFetch() {
  // 参数签名不能省：vi.fn 无参会让 mock.calls 推断成空元组，断言取不到实参
  return vi.fn(async (_url: any, _init?: any) => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('gatewayFetch：local 模式（浏览器直连）', () => {
  it('/ai-api → 真实端点 + Bearer Key 注入', async () => {
    stubBrowser(fakeStorage({ kb_local_keys_v1: JSON.stringify({ agnes: 'sk-test-agnes' }) }));
    const f = okJsonFetch();
    vi.stubGlobal('fetch', f);
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-api/chat/completions', { method: 'POST', body: '{}' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.agnes-ai.cn/v1/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-test-agnes');
  });

  it('/ai-check-api 未配独立 Key 时回退生成端点与 Agnes Key（与 vite 代理一致）', async () => {
    stubBrowser(fakeStorage({ kb_local_keys_v1: JSON.stringify({ agnes: 'sk-a' }) }));
    const f = okJsonFetch();
    vi.stubGlobal('fetch', f);
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-check-api/chat/completions', { method: 'POST', body: '{}' });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.agnes-ai.cn/v1/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-a');
  });

  it('/ai-qwen 注入 DashScope Key 与 X-DashScope-Async: disable', async () => {
    stubBrowser(fakeStorage({ kb_local_keys_v1: JSON.stringify({ dashscope: 'sk-dash' }) }));
    const f = okJsonFetch();
    vi.stubGlobal('fetch', f);
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-qwen/services/aigc/multimodal-generation/generation', { method: 'POST', body: '{}' });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://dashscope.aliyuncs.com/services/aigc/multimodal-generation/generation');
    const h = new Headers(init.headers);
    expect(h.get('authorization')).toBe('Bearer sk-dash');
    expect(h.get('x-dashscope-async')).toBe('disable');
  });

  it('Key 缺失显式抛错（指向后台管理），绝不发出无鉴权请求', async () => {
    stubBrowser(fakeStorage());
    const f = okJsonFetch();
    vi.stubGlobal('fetch', f);
    const { gatewayFetch } = await import('./gateway');
    await expect(gatewayFetch('/ai-api/chat/completions', { method: 'POST' })).rejects.toThrow(/未配置.*API Key/);
    expect(f).not.toHaveBeenCalled();
  });

  it('非 AI 路径原样透传（不被前缀改写误伤）', async () => {
    stubBrowser(fakeStorage());
    const f = okJsonFetch();
    vi.stubGlobal('fetch', f);
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/some/other/api', { method: 'GET' });
    expect(f.mock.calls[0][0]).toBe('/some/other/api');
  });
});

/** /__settings 不可达 → 判定为 local 模式，同时让 localStorage 里的端点/口令配置生效 */
function localModeFetch() {
  return vi.fn(async (url: any, _init?: any) => {
    if (String(url) === '/__settings') throw new Error('offline');
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

/** 启动到 local 模式并返回 fetch spy（calls[0] 是 /__settings 探测） */
async function bootLocal(storage: ReturnType<typeof fakeStorage>) {
  stubBrowser(storage);
  const f = localModeFetch();
  vi.stubGlobal('fetch', f);
  const s = await import('./settings');
  await s.loadRuntimeSettings();
  return f;
}

/** 取出发往 AI 端点的调用（跳过 /__settings 探测） */
function aiCall(f: ReturnType<typeof localModeFetch>) {
  return f.mock.calls.find((c) => !String(c[0]).startsWith('/__settings')) as [string, RequestInit];
}

describe('gatewayFetch：代理托管模式（Key 由代理注入）', () => {
  it('配了口令、未配 Key：请求带 X-Proxy-Token，且不带 Authorization', async () => {
    const f = await bootLocal(fakeStorage({
      kb_app_proxy_v1: JSON.stringify({
        textBaseUrl: 'https://proxy.example.workers.dev/https/api.agnes-ai.cn/v1',
        proxyToken: 'tok-abc123',
      }),
    }));
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-api/chat/completions', { method: 'POST', body: '{}' });
    const [url, init] = aiCall(f);
    expect(url).toBe('https://proxy.example.workers.dev/https/api.agnes-ai.cn/v1/chat/completions');
    const h = new Headers(init.headers);
    expect(h.get('x-proxy-token')).toBe('tok-abc123');
    // 空 Bearer 会被代理当成无效凭证，必须完全不发这个头
    expect(h.get('authorization')).toBeNull();
  });

  it('口令与 Key 同时存在：两者都发（代理侧会用自己的 Key 覆盖）', async () => {
    const f = await bootLocal(fakeStorage({
      kb_local_keys_v1: JSON.stringify({ agnes: 'sk-own' }),
      kb_app_proxy_v1: JSON.stringify({ proxyToken: 'tok-abc123' }),
    }));
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-api/chat/completions', { method: 'POST', body: '{}' });
    const h = new Headers(aiCall(f)[1].headers);
    expect(h.get('authorization')).toBe('Bearer sk-own');
    expect(h.get('x-proxy-token')).toBe('tok-abc123');
  });

  it('口令为纯空白视为未配置：仍然抛错，不放行无鉴权请求', async () => {
    const f = await bootLocal(fakeStorage({
      kb_app_proxy_v1: JSON.stringify({ proxyToken: '   ' }),
    }));
    const { gatewayFetch } = await import('./gateway');
    await expect(gatewayFetch('/ai-api/chat/completions', { method: 'POST' })).rejects.toThrow(/未配置.*API Key/);
    expect(aiCall(f)).toBeUndefined();
  });

  it('代理托管对生图链路同样生效（/ai-qwen 带口令且不带 Authorization）', async () => {
    const f = await bootLocal(fakeStorage({
      kb_app_proxy_v1: JSON.stringify({
        dashBaseUrl: 'https://proxy.example.workers.dev/https/dashscope.aliyuncs.com',
        proxyToken: 'tok-abc123',
      }),
    }));
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-qwen/services/aigc/multimodal-generation/generation', { method: 'POST', body: '{}' });
    const [url, init] = aiCall(f);
    expect(url).toBe('https://proxy.example.workers.dev/https/dashscope.aliyuncs.com/services/aigc/multimodal-generation/generation');
    const h = new Headers(init.headers);
    expect(h.get('x-proxy-token')).toBe('tok-abc123');
    expect(h.get('authorization')).toBeNull();
    expect(h.get('x-dashscope-async')).toBe('disable');
  });
});

describe('gatewayFetch：透传边界', () => {
  it('server 模式一律原样发出（交给 dev 代理）', async () => {
    const f = vi.fn(async (url: any) => {
      if (String(url) === '/__settings') {
        return new Response(JSON.stringify({ mock: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', f);
    const s = await import('./settings');
    await s.loadRuntimeSettings();
    expect(s.getMode()).toBe('server');
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-api/chat/completions', { method: 'POST', body: '{}' });
    const aiCall = f.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/ai-'));
    expect(aiCall).toEqual(['/ai-api/chat/completions']);
  });

  it('非浏览器环境（node/测试）即使 local 模式也透传，不要求 Key', async () => {
    const f = okJsonFetch();
    vi.stubGlobal('fetch', f);
    const { gatewayFetch } = await import('./gateway');
    await gatewayFetch('/ai-api/chat/completions', { method: 'POST', body: '{}' });
    expect(f.mock.calls[0][0]).toBe('/ai-api/chat/completions');
  });
});

describe('joinUrl：斜杠边界', () => {
  it('base 尾部斜杠与 path 头部斜杠不产生双斜杠、不丢斜杠', async () => {
    const { joinUrl } = await import('./gateway');
    expect(joinUrl('https://a.com/v1/', '/chat/completions')).toBe('https://a.com/v1/chat/completions');
    expect(joinUrl('https://a.com/v1', 'chat/completions')).toBe('https://a.com/v1/chat/completions');
    expect(joinUrl('https://a.com/', '/x')).toBe('https://a.com/x');
  });
});
