/**
 * blocks/settings.ts — 运行时配置中心
 *
 * 双模式：
 *  - server 模式（dev）：配置存于 vite dev server 的 settings.json，通过 /__settings API 读写。
 *    API Key 只在服务端，前端拿到的永远是脱敏值（前6位…后3位）。
 *  - local 模式（静态构建/服务不可用）：配置存 localStorage，Key/端点管理禁用。
 *
 * 所有 blocks 通过 getSettings() 同步读取，改完立即生效，无需重启。
 */

import { STYLE_PRESETS, type PageBadgeFormat, type PageBadgePos } from './styleEngine';

export interface TextSettings {
  model: string;
  /** 质检模型（B 模型）：留空 = 回退到 model。用不同家族的模型可规避自我偏好偏差 */
  checkModel: string;
  /** 内容提取模型：留空 = 回退到 model */
  extractModel: string;
  temperature: number;
  selfCheckTemperature: number;
  extractTemperature: number;
}
export interface ImageSettings {
  /** 生图服务商：qwen=通义千问 / sensenova=商汤 */
  providerId: 'qwen' | 'sensenova';
  model: string;
  promptExtend: boolean;
  maxRetries: number;
  retryBackoffMs: number;
}
export interface StudySettings {
  initialEase: number;
  minEase: number;
  easyBonus: number;
}
export interface QuizSettings {
  defaultCount: number;
  defaultDifficulty: 'easy' | 'medium' | 'hard';
}
export interface ProxySettings {
  textBaseUrl: string;
  dashBaseUrl: string;
  /** 质检模型（B）独立端点：留空 = 回退 textBaseUrl */
  checkBaseUrl: string;
  /** 商汤 SenseNova 生图端点 */
  sensenovaBaseUrl: string;
  /**
   * 代理口令：端点若由自建代理（Lambda / Worker）托管 API Key，在这里填口令。
   * 填了它 → 浏览器不再要求填 Key，Key 由代理在服务端注入，请求带 X-Proxy-Token 供代理校验。
   */
  proxyToken: string;
}
export interface KeyStatus {
  set: boolean;
  masked: string;
}

/** 应用外观标识（可改：导航栏标题、浏览器标签页标题） */
export interface AppIdentity {
  name: string;
  subtitle: string;
}

/**
 * 默认生成参数：进入输入步骤时的初始值。
 * stylePresetId 支持哨兵值 'auto' = 跟随 AI 按输入内容推荐风格。
 */
export interface UiSettings {
  stylePresetId: string;
  pageNumber: boolean;
  pagePos: PageBadgePos;
  pageFormat: PageBadgeFormat;
}

export interface AppSettings {
  mock: boolean;
  app: AppIdentity;
  ui: UiSettings;
  text: TextSettings;
  image: ImageSettings;
  study: StudySettings;
  quiz: QuizSettings;
  /** 仅 server 模式下由服务端返回；local 模式为 null */
  server: {
    proxy: ProxySettings;
    keys: { agnes: KeyStatus; dashscope: KeyStatus; check: KeyStatus; sensenova: KeyStatus };
  } | null;
}

export type SettingsMode = 'server' | 'local';

/** 应用名默认值（设置页可改；导航栏与浏览器标题都读这里） */
export const DEFAULT_APP_NAME = '提示词工坊';
export const DEFAULT_APP_SUBTITLE = 'Knowledge Card Prompt Workshop';

/** 编译期默认值（.env → 构建常量），作为兜底 */
const ENV_DEFAULTS: AppSettings = {
  mock: import.meta.env.VITE_USE_MOCK === 'true',
  app: {
    name: import.meta.env.VITE_APP_NAME ?? DEFAULT_APP_NAME,
    subtitle: import.meta.env.VITE_APP_SUBTITLE ?? DEFAULT_APP_SUBTITLE,
  },
  // 默认让 AI 按内容选风格：固定一种风格（如"专业医学插画"）套所有主题并不合适
  ui: { stylePresetId: 'auto', pageNumber: false, pagePos: 'tr', pageFormat: 'cn' },
  text: {
    model: import.meta.env.VITE_TEXT_MODEL ?? 'agnes-2.5-flash',
    checkModel: import.meta.env.VITE_CHECK_MODEL ?? '',
    extractModel: import.meta.env.VITE_EXTRACT_MODEL ?? '',
    temperature: 0.6,
    selfCheckTemperature: 0,
    extractTemperature: 0.3,
  },
  image: {
    providerId: 'qwen',
    model: import.meta.env.VITE_QWEN_MODEL ?? 'qwen-image-3.0',
    promptExtend: true,
    maxRetries: 3,
    retryBackoffMs: 20000,
  },
  study: { initialEase: 2.5, minEase: 1.3, easyBonus: 1.3 },
  quiz: { defaultCount: 10, defaultDifficulty: 'medium' },
  server: null,
};

const LS_KEY = 'kb_app_settings_v1';
const LS_KEYS_PROXY = 'kb_app_proxy_v1';
/** local 模式的 API Key 存储（仅本浏览器 localStorage；GitHub 上无任何 key） */
const LS_KEYS_SECRET = 'kb_local_keys_v1';

export interface LocalKeys {
  agnes: string;
  dashscope: string;
  check: string;
  sensenova: string;
}

const EMPTY_KEYS: LocalKeys = { agnes: '', dashscope: '', check: '', sensenova: '' };

function loadLocalKeys(): LocalKeys {
  try {
    const raw = localStorage.getItem(LS_KEYS_SECRET);
    if (raw) return { ...EMPTY_KEYS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...EMPTY_KEYS };
}

let localKeys: LocalKeys = loadLocalKeys();

export function getLocalKeys(): LocalKeys {
  return localKeys;
}

function maskKey(k: string): string {
  return k.length > 10 ? `${k.slice(0, 6)}…${k.slice(-3)}` : '***';
}

/** UI 统一的 Key 状态视图：server 模式取服务端脱敏值，local 模式取 localStorage（同样只回脱敏值） */
export interface KeysView {
  agnes: KeyStatus;
  dashscope: KeyStatus;
  check: KeyStatus;
  sensenova: KeyStatus;
}

export function getKeysView(): KeysView {
  if (currentMode === 'server' && current.server) return current.server.keys;
  return {
    agnes: { set: !!localKeys.agnes, masked: localKeys.agnes ? maskKey(localKeys.agnes) : '' },
    dashscope: { set: !!localKeys.dashscope, masked: localKeys.dashscope ? maskKey(localKeys.dashscope) : '' },
    check: { set: !!localKeys.check, masked: localKeys.check ? maskKey(localKeys.check) : '' },
    sensenova: { set: !!localKeys.sensenova, masked: localKeys.sensenova ? maskKey(localKeys.sensenova) : '' },
  };
}

function deepMerge<T extends Record<string, any>>(base: T, patch: any): T {
  if (!patch || typeof patch !== 'object') return base;
  const out: any = { ...base };
  for (const k of Object.keys(patch)) {
    const bv = (base as any)[k];
    const pv = patch[k];
    if (pv === undefined) continue;
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && pv && typeof pv === 'object' && !Array.isArray(pv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out as T;
}

/* ---------------- 状态 ---------------- */

let current: AppSettings = structuredCloneSafe(ENV_DEFAULTS);
let currentMode: SettingsMode = 'local';
const DEFAULT_PROXY: ProxySettings = {
  textBaseUrl: 'https://api.agnes-ai.cn/v1',
  dashBaseUrl: 'https://dashscope.aliyuncs.com',
  checkBaseUrl: '',
  sensenovaBaseUrl: 'https://token.sensenova.cn/v1',
  proxyToken: '',
};
let currentProxy: ProxySettings = { ...DEFAULT_PROXY };
const listeners = new Set<() => void>();

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.warn('settings listener error:', e); }
  });
}

export function getSettings(): AppSettings {
  return current;
}

export function getMode(): SettingsMode {
  return currentMode;
}

export function getProxy(): ProxySettings {
  return currentProxy;
}

/**
 * 鉴权失败（401/403）时的修复指引。
 * 代理托管模式下浏览器本来就没有 Key，让用户去后台管理填 Key 是错的，会白折腾。
 */
export function authErrorHint(): string {
  if ((currentProxy.proxyToken || '').trim()) {
    return '代理口令可能不对，或代理侧保管的 API Key 已失效（需在代理的环境变量里更新）';
  }
  return '请在「后台管理 ⚙」中填写并保存 API Key';
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 可持久化到 localStorage 的子集（不含 server/keys） */
function persistable(s: AppSettings) {
  return {
    mock: s.mock, app: s.app, ui: s.ui,
    text: s.text, image: s.image, study: s.study, quiz: s.quiz,
  };
}

function loadFromLocalStorage(): Partial<AppSettings> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveToLocalStorage(s: AppSettings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(persistable(s)));
  } catch { /* ignore */ }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

/** local 模式下恢复端点配置（server 模式以服务端返回为准） */
function loadProxyFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEYS_PROXY);
    if (raw) currentProxy = { ...currentProxy, ...JSON.parse(raw) };
  } catch { /* ignore */ }
}

/**
 * 启动时调用：尝试从 dev server 拉取配置（server 模式），
 * 失败则回退 localStorage / 编译期默认值（local 模式）。
 */
export async function loadRuntimeSettings(): Promise<SettingsMode> {
  // local 模式下 localStorage 先行生效
  current = deepMerge(structuredCloneSafe(ENV_DEFAULTS), loadFromLocalStorage());
  current.server = null;
  loadProxyFromLocalStorage();

  try {
    const resp = await withTimeout(fetch('/__settings', { method: 'GET' }), 2500);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    // 剥离 server 信息，其余合并进 settings
    const { server, ...rest } = data;
    current = deepMerge(structuredCloneSafe(ENV_DEFAULTS), rest);
    current.server = server ?? null;
    if (server?.proxy) {
      currentProxy = { ...currentProxy, ...server.proxy };
      try { localStorage.setItem(LS_KEYS_PROXY, JSON.stringify(currentProxy)); } catch { /* ignore */ }
    }
    currentMode = 'server';
  } catch {
    currentMode = 'local';
  }
  emit();
  return currentMode;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/**
 * 保存设置。patch 只包含 UI 可编辑字段（mock/app/ui/text/image/study/quiz）。
 * server 模式走 API；local 模式写 localStorage。
 */
export async function saveRuntimeSettings(patch: Partial<AppSettings>): Promise<SaveResult> {
  if (currentMode === 'server') {
    try {
      const resp = await fetch('/__settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: patch }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const { server, ...rest } = data;
      current = deepMerge(structuredCloneSafe(ENV_DEFAULTS), rest);
      current.server = server ?? null;
      if (server?.proxy) currentProxy = { ...currentProxy, ...server.proxy };
      emit();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  // local 模式：Key/端点不可改，其余写 localStorage
  current = deepMerge(current, patch);
  saveToLocalStorage(current);
  emit();
  return { ok: true };
}

/**
 * 保存 API Key。
 * server 模式 → 写服务端 settings.json；
 * local 模式 → 只写本浏览器 localStorage（静态部署方案，key 不上任何服务器/仓库）。
 * 传 '__CLEAR__' 清除。
 */
export async function saveKeys(keys: { agnes?: string; dashscope?: string; check?: string; sensenova?: string }): Promise<SaveResult> {
  if (currentMode !== 'server') {
    for (const k of Object.keys(keys) as (keyof LocalKeys)[]) {
      const v = keys[k];
      if (v === undefined) continue;
      localKeys[k] = v === '__CLEAR__' ? '' : v.trim();
    }
    try { localStorage.setItem(LS_KEYS_SECRET, JSON.stringify(localKeys)); } catch { /* ignore */ }
    emit();
    return { ok: true };
  }
  try {
    const resp = await fetch('/__settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const { server, ...rest } = data;
    current = deepMerge(structuredCloneSafe(ENV_DEFAULTS), rest);
    current.server = server ?? null;
    if (server?.proxy) currentProxy = { ...currentProxy, ...server.proxy };
    emit();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** 保存代理端点（server 模式走服务端；local 模式写 localStorage） */
export async function saveProxy(proxy: Partial<ProxySettings>): Promise<SaveResult> {
  if (currentMode !== 'server') {
    currentProxy = { ...currentProxy, ...proxy };
    try { localStorage.setItem(LS_KEYS_PROXY, JSON.stringify(currentProxy)); } catch { /* ignore */ }
    emit();
    return { ok: true };
  }
  try {
    const resp = await fetch('/__settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proxy }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const { server, ...rest } = data;
    current = deepMerge(structuredCloneSafe(ENV_DEFAULTS), rest);
    current.server = server ?? null;
    if (server?.proxy) currentProxy = { ...currentProxy, ...server.proxy };
    emit();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** 恢复默认（仅 server 模式支持服务端重置；local 模式清 localStorage） */
export async function resetSettings(): Promise<SaveResult> {
  if (currentMode === 'server') {
    try {
      const resp = await fetch('/__settings/reset', { method: 'POST' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const { server, ...rest } = data;
      current = deepMerge(structuredCloneSafe(ENV_DEFAULTS), rest);
      current.server = server ?? null;
      if (server?.proxy) currentProxy = { ...currentProxy, ...server.proxy };
      emit();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  current = structuredCloneSafe(ENV_DEFAULTS);
  // 端点里可能存着代理口令这类凭证，恢复默认必须一起清掉，否则会静默残留
  currentProxy = { ...DEFAULT_PROXY };
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(LS_KEYS_PROXY); } catch { /* ignore */ }
  emit();
  return { ok: true };
}

/* ---------------- 配置导出 / 导入 ---------------- */

/** 配置文件格式版本：结构变更时递增，导入端据此做兼容 */
export const CONFIG_BUNDLE_VERSION = 1;

export interface ConfigBundle {
  /** 标识文件来源，导入时用来拒绝无关的 JSON */
  app: 'ai-card-generator';
  version: number;
  exportedAt: string;
  /** 导出时的运行模式，仅作参考 */
  mode: SettingsMode;
  /** 文件里是否含明文 Key */
  hasKeys: boolean;
  settings: ReturnType<typeof persistable>;
  proxy: ProxySettings;
  keys?: LocalKeys;
}

const PAGE_POS_VALUES: PageBadgePos[] = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'];
const PAGE_FMT_VALUES: PageBadgeFormat[] = ['cn', 'slash', 'dot'];
const PROXY_FIELDS: Array<keyof ProxySettings> = ['textBaseUrl', 'dashBaseUrl', 'checkBaseUrl', 'sensenovaBaseUrl', 'proxyToken'];
const KEY_FIELDS: Array<keyof LocalKeys> = ['agnes', 'dashscope', 'check', 'sensenova'];

/** 导出当前配置。server 模式的 Key 在服务端，前端拿不到明文，故不含 keys */
export function exportConfig(): ConfigBundle {
  const includeKeys = currentMode !== 'server';
  return {
    app: 'ai-card-generator',
    version: CONFIG_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    mode: currentMode,
    hasKeys: includeKeys && KEY_FIELDS.some((k) => !!localKeys[k]),
    settings: persistable(current),
    proxy: { ...currentProxy },
    ...(includeKeys ? { keys: { ...localKeys } } : {}),
  };
}

/**
 * 只保留已知字段与合法取值。导入是系统边界（内容来自用户挑选的文件，可能被手改过），
 * 脏值若直接合并进去会污染运行时状态，所以这里逐字段白名单过滤。
 */
function sanitizeSettings(input: any): Partial<AppSettings> {
  const out: any = {};
  for (const k of ['mock', 'app', 'ui', 'text', 'image', 'study', 'quiz'] as const) {
    const v = input?.[k];
    if (v === undefined) continue;
    const base: any = (ENV_DEFAULTS as any)[k];
    if (typeof base !== 'object') {
      if (typeof v === typeof base) out[k] = v;
      continue;
    }
    const sub: any = {};
    for (const sk of Object.keys(base)) {
      const sv = v?.[sk];
      if (sv !== undefined && typeof sv === typeof base[sk]) sub[sk] = sv;
    }
    if (Object.keys(sub).length) out[k] = sub;
  }
  // 类型对上但取值非法的枚举字段，单独剔除（否则会静默回退成默认预设）
  const { ui, image, quiz } = out;
  if (ui) {
    if (ui.stylePresetId !== undefined && ui.stylePresetId !== 'auto' && !STYLE_PRESETS.some((p) => p.id === ui.stylePresetId)) delete ui.stylePresetId;
    if (ui.pagePos !== undefined && !PAGE_POS_VALUES.includes(ui.pagePos)) delete ui.pagePos;
    if (ui.pageFormat !== undefined && !PAGE_FMT_VALUES.includes(ui.pageFormat)) delete ui.pageFormat;
  }
  if (image?.providerId !== undefined && image.providerId !== 'qwen' && image.providerId !== 'sensenova') delete image.providerId;
  if (quiz?.defaultDifficulty !== undefined && !['easy', 'medium', 'hard'].includes(quiz.defaultDifficulty)) delete quiz.defaultDifficulty;
  return out;
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  /** 成功写入了文件里的 Key */
  appliedKeys?: boolean;
}

/**
 * 应用导入的配置：设置 → 端点 → Key 依次写入，任一环节失败即中断并回报原因。
 * server 模式下同样可导入 Key（会写进服务端 settings.json）。
 */
export async function importConfig(raw: unknown): Promise<ImportResult> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '文件内容不是有效的配置对象' };
  }
  const b = raw as Partial<ConfigBundle>;
  if (!b.settings || typeof b.settings !== 'object' || Array.isArray(b.settings)) {
    return { ok: false, error: '缺少 settings 字段，可能不是本应用导出的配置文件' };
  }

  const settings = sanitizeSettings(b.settings);
  if (!Object.keys(settings).length) {
    return { ok: false, error: '配置文件里的设置项都无法识别' };
  }

  let res = await saveRuntimeSettings(settings);
  if (!res.ok) return { ok: false, error: res.error };

  if (b.proxy && typeof b.proxy === 'object') {
    const proxy: Partial<ProxySettings> = {};
    for (const k of PROXY_FIELDS) {
      const v = (b.proxy as any)[k];
      if (typeof v === 'string') proxy[k] = v;
    }
    if (Object.keys(proxy).length) {
      res = await saveProxy(proxy);
      if (!res.ok) return { ok: false, error: res.error };
    }
  }

  if (b.keys && typeof b.keys === 'object') {
    const payload: Partial<LocalKeys> = {};
    for (const k of KEY_FIELDS) {
      const v = (b.keys as any)[k];
      if (typeof v === 'string' && v.trim()) payload[k] = v.trim();
    }
    if (Object.keys(payload).length) {
      res = await saveKeys(payload);
      if (!res.ok) return { ok: false, error: res.error };
      return { ok: true, appliedKeys: true };
    }
  }
  return { ok: true, appliedKeys: false };
}

export interface TestResult {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  error?: string;
  note?: string;
}

/** local 模式统一出口：走 gateway 直连真实端点（动态 import 避免模块环） */
async function gatewayFetch(url: string, init: RequestInit): Promise<Response> {
  const g = await import('./gateway');
  return g.gatewayFetch(url, init);
}

/**
 * 浏览器 fetch 被 CORS 拦截或网络不可达时，抛出的通常是 TypeError "Failed to fetch"。
 * 原始消息对用户毫无诊断价值，这里识别并替换成可读说明。
 */
function formatFetchError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return '网络请求失败（可能被 CORS 拦截）：该端点不支持浏览器直连。本地模式（GitHub Pages）下浏览器直接请求 API，需端点返回 CORS 头。请换用支持 CORS 的端点，或在本地用 npm run dev 测试。';
  }
  return msg;
}

/** local 模式文本模型实测：最小请求验证端点 + Key 可用 */
async function probeChat(path: string, model: string): Promise<TestResult> {
  const t0 = performance.now();
  try {
    const resp = await gatewayFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
    });
    const latencyMs = Math.round(performance.now() - t0);
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, latencyMs, error: `鉴权失败（HTTP ${resp.status}）：${authErrorHint()}` };
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { ok: false, latencyMs, error: `HTTP ${resp.status} ${txt.slice(0, 120)}` };
    }
    return { ok: true, latencyMs, model };
  } catch (e) {
    return { ok: false, error: formatFetchError(e) };
  }
}

export async function testTextModel(): Promise<TestResult> {
  if (currentMode !== 'server') return probeChat('/ai-api/chat/completions', current.text.model);
  try {
    const resp = await fetch('/__settings/test/text', { method: 'POST' });
    return await resp.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** B 模型（质检）连通性测试：server 走 /ai-check-api 同源配置；local 直连实测 */
export async function testCheckModel(): Promise<TestResult> {
  if (currentMode !== 'server') {
    const usingFallback = !currentProxy.checkBaseUrl;
    const result = await probeChat('/ai-check-api/chat/completions', current.text.checkModel || current.text.model);
    if (usingFallback) {
      result.note = '质检端点留空，使用生成端点';
    }
    return result;
  }
  try {
    const resp = await fetch('/__settings/test/check', { method: 'POST' });
    return await resp.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function testImageModel(): Promise<TestResult> {
  if (currentMode !== 'server') {
    // 轻量探测：空 body 请求生图端点，只验「端点可达 + Key 通过鉴权」，不真实出图（省钱省时）
    const isQwen = current.image.providerId !== 'sensenova';
    const path = isQwen
      ? '/ai-qwen/services/aigc/multimodal-generation/generation'
      : '/ai-sensenova/images/generations';
    const t0 = performance.now();
    try {
      const resp = await gatewayFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const latencyMs = Math.round(performance.now() - t0);
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, latencyMs, error: `鉴权失败（HTTP ${resp.status}）：${authErrorHint()}` };
      }
      // 400/422 等参数类错误反而说明请求已到达服务端且通过鉴权
      return { ok: true, latencyMs, note: '本地模式仅验证端点可达与 Key 鉴权，未真实出图' };
    } catch (e) {
      return { ok: false, error: formatFetchError(e) };
    }
  }
  try {
    const resp = await fetch('/__settings/test/image', { method: 'POST' });
    return await resp.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
