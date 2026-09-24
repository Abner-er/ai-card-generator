/**
 * blocks/imageProvider.ts — 统一图像生成 Provider（路 B：Qwen-Image-3）
 *
 * 路 A（免费 Agnes）只能稳定出「无字插画」，文字靠代码叠加，始终有拼贴感。
 * 路 B 直接让能渲染文字的模型（Qwen-Image-3）把「标题 + 正文 + 要点 + 配图」一次性烤进同一张图，
 * 得到真正有"生图感"的排版图文卡。
 *
 * 这里只定义与模型无关的 ImageProvider 接口 + 两个实现：
 *  - QwenImageProvider：调 DashScope multimodal-generation（密钥由 vite 代理 /ai-qwen 持有，前端不暴露）
 *  - MockImageProvider：无 key / Mock 模式下画 SVG 占位卡（把标题画进去），保证 UI 不崩
 * 未来要加其它模型，只要再实现一个 ImageProvider 并注册到 getImageProvider 即可。
 */
import type { Ratio } from './types';
import { getSettings, authErrorHint } from './settings';
import { gatewayFetch } from './gateway';
import { trimTitle } from './textUtil';

export type ImageProviderId = 'qwen' | 'sensenova' | 'mock';

export interface GenerateImageOptions {
  /** 宽高比（决定生图尺寸） */
  ratio: Ratio;
  /** 覆盖模型名 */
  model?: string;
  /** 锚点参考图（data URL）：传给模型做 I2I，保证同系列配色/画风一致 */
  refImage?: string;
  /** 强制 Mock */
  mock?: boolean;
  /** Mock 模式下要画进占位卡的文字 */
  mockText?: { title?: string; body?: string; bullets?: string[] };
  onProgress?: (msg: string) => void;
}

export interface ImageProvider {
  id: ImageProviderId;
  label: string;
  /** 生成一张完整图文卡，返回 data URL（png） */
  generate(prompt: string, opts: GenerateImageOptions): Promise<string>;
}

/** ratio → DashScope size（总像素控制在 512²~2048²，且严格匹配比例） */
const RATIO_SIZE: Record<Ratio, string> = {
  '1:1': '1024*1024',
  '3:4': '1152*1536',
  '4:3': '1536*1152',
  '9:16': '864*1536',
  '16:9': '1536*864',
  '2:3': '1024*1536',
  '3:2': '1536*1024',
};

export function ratioToSize(r: Ratio): string {
  return RATIO_SIZE[r] ?? '1024*1024';
}

/** ratio → Mock SVG 像素尺寸（仅控制占位卡比例） */
const RATIO_DIM: Record<Ratio, [number, number]> = {
  '1:1': [1024, 1024],
  '3:4': [864, 1152],
  '4:3': [1152, 864],
  '9:16': [736, 1312],
  '16:9': [1312, 736],
  '2:3': [832, 1248],
  '3:2': [1248, 832],
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ============ QwenImageProvider ============

const QWEN_PATH = '/ai-qwen/services/aigc/multimodal-generation/generation';

/** 从 DashScope 响应里抠出图片（兼容 base64 / http url / image-synthesis 的 results[].url） */
function extractImage(data: any): string | null {
  // 1) multimodal-generation/generation：output.choices[0].message.content[] 里找 image
  const content = data?.output?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part?.image === 'string') return part.image;
      if (typeof part?.image_url === 'string') return part.image_url;
    }
  }
  // 2) image-synthesis 异步风格：output.results[0].url
  const url = data?.output?.results?.[0]?.url;
  if (typeof url === 'string') return url;
  // 3) 兜底：choices 文本里揪出图片链接
  const txt = data?.output?.choices?.[0]?.message?.content;
  if (typeof txt === 'string') {
    const m = txt.match(/https?:\/\/\S+\.(?:png|jpe?g|webp)/i);
    if (m) return m[0];
  }
  return null;
}

/** 把 raw（可能是 data url / http url / 裸 base64）统一成 data url */
async function toDataUrl(raw: string): Promise<string> {
  if (raw.startsWith('data:')) return raw;
  if (raw.startsWith('http')) {
    try {
      const p = await gatewayFetch(`/ai-image-proxy?url=${encodeURIComponent(raw)}`);
      if (p.ok) {
        const pd = await p.json();
        if (pd?.data) return pd.data as string;
      }
    } catch {
      /* 代理失败，回退原始 url */
    }
    return raw;
  }
  // 裸 base64
  return raw.includes('base64,') ? raw : `data:image/png;base64,${raw}`;
}

export class QwenImageProvider implements ImageProvider {
  id: ImageProviderId = 'qwen';
  label = '通义千问 Qwen-Image-3';

  async generate(prompt: string, opts: GenerateImageOptions): Promise<string> {
    if (opts.mock || getSettings().mock) {
      return mockCard(opts.ratio, opts.mockText);
    }

    const cfg = getSettings().image;
    const size = ratioToSize(opts.ratio);
    const content: Array<Record<string, string>> = [{ text: prompt }];
    if (opts.refImage) content.push({ image: opts.refImage });

    const body = {
      model: opts.model ?? cfg.model,
      input: { messages: [{ role: 'user', content }] },
      parameters: { prompt_extend: cfg.promptExtend, size },
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        opts.onProgress?.(attempt === 0 ? '正在生图…' : `重试生成 (${attempt + 1})…`);
        const resp = await gatewayFetch(QWEN_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (resp.status === 429) {
          if (attempt < cfg.maxRetries) {
            await delay(cfg.retryBackoffMs); // DashScope RPM 较低，退避长一点
            continue;
          }
          throw new Error('Qwen 限流，请稍后重试');
        }
        if (resp.status === 401 || resp.status === 403) {
          throw new Error(`DashScope 鉴权失败：${authErrorHint()}`);
        }
        if (!resp.ok) {
          const t = await resp.text().catch(() => '');
          throw new Error(`生图失败: ${resp.status} ${t.slice(0, 200)}`);
        }

        const data = await resp.json();
        const raw = extractImage(data);
        if (!raw) throw new Error(`生图返回异常: ${JSON.stringify(data).slice(0, 200)}`);
        return await toDataUrl(raw);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        // Key 错误 / 限流不再盲目重试
        if (msg.includes('Key') || msg.includes('限流') || attempt >= cfg.maxRetries) break;
        await delay(3000);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('生图失败');
  }
}

// ============ SensenovaImageProvider ============

/** SenseNova 用 OpenAI 兼容的 x 分隔尺寸，DashScope 用 * 分隔 */
function toSensenovaSize(r: Ratio): string {
  return ratioToSize(r).replace('*', 'x');
}

/**
 * 商汤 SenseNova U1.5 Lite（OpenAI 兼容接口，经 vite 代理 /ai-sensenova 持有 Key）：
 *  - 文生图：POST /images/generations
 *  - 参考图编辑（I2I）：POST /images/edits，images[0].image_url 支持 data URL
 * 响应 data[0].b64_json / data[0].url；watermark=false 公测免费无水印。
 */
export class SensenovaImageProvider implements ImageProvider {
  id: ImageProviderId = 'sensenova';
  label = '商汤 SenseNova U1.5 Lite';

  async generate(prompt: string, opts: GenerateImageOptions): Promise<string> {
    if (opts.mock || getSettings().mock) {
      return mockCard(opts.ratio, opts.mockText);
    }

    const cfg = getSettings().image;
    const useRef = !!opts.refImage;
    const body: Record<string, unknown> = {
      model: opts.model ?? cfg.model,
      prompt,
      n: 1,
      size: toSensenovaSize(opts.ratio),
      watermark: false,
      prompt_extend: cfg.promptExtend,
      response_format: 'b64_json',
    };
    if (useRef) body.images = [{ image_url: opts.refImage }];
    const path = useRef ? '/ai-sensenova/images/edits' : '/ai-sensenova/images/generations';

    let lastErr: unknown;
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        opts.onProgress?.(attempt === 0 ? '正在生图（SenseNova）…' : `重试生成 (${attempt + 1})…`);
        const resp = await gatewayFetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (resp.status === 429) {
          if (attempt < cfg.maxRetries) {
            await delay(cfg.retryBackoffMs);
            continue;
          }
          throw new Error('SenseNova 限流，请稍后重试');
        }
        if (resp.status === 401 || resp.status === 403) {
          throw new Error(`SenseNova 鉴权失败：${authErrorHint()}`);
        }
        if (!resp.ok) {
          const t = await resp.text().catch(() => '');
          throw new Error(`生图失败: ${resp.status} ${t.slice(0, 200)}`);
        }

        const data = await resp.json();
        const raw = data?.data?.[0]?.b64_json ?? data?.data?.[0]?.url;
        if (!raw) throw new Error(`生图返回异常: ${JSON.stringify(data).slice(0, 200)}`);
        return await toDataUrl(raw);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Key') || msg.includes('限流') || attempt >= cfg.maxRetries) break;
        await delay(3000);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('生图失败');
  }
}

// ============ MockImageProvider ============

export class MockImageProvider implements ImageProvider {
  id: ImageProviderId = 'mock';
  label = '占位预览 (Mock)';

  async generate(prompt: string, opts: GenerateImageOptions): Promise<string> {
    void prompt;
    return mockCard(opts.ratio, opts.mockText);
  }
}

/** 画一张占位卡：把标题/正文画进 SVG，方便无 key 时预览版式与流程 */
function mockCard(ratio: Ratio, text?: GenerateImageOptions['mockText']): string {
  const [rw, rh] = RATIO_DIM[ratio];
  const cx = rw / 2;
  const title = trimTitle(text?.title ?? '图文卡', '图文卡', 16);
  const body = (text?.body ?? '').slice(0, 40);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rw}" height="${rh}" viewBox="0 0 ${rw} ${rh}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbf7ef"/>
        <stop offset="100%" stop-color="#f1e7d6"/>
      </linearGradient>
    </defs>
    <rect width="${rw}" height="${rh}" fill="url(#bg)"/>
    <rect x="${rw * 0.06}" y="${rh * 0.06}" width="${rw * 0.88}" height="${rh * 0.88}" rx="24" fill="#ffffff" stroke="#d8c4a4" stroke-width="2" opacity="0.9"/>
    <g transform="translate(${cx} ${rh * 0.36})">
      <circle r="${Math.min(rw, rh) * 0.16}" fill="#f3d9a8" stroke="#c97b3c" stroke-width="6"/>
      <circle r="${Math.min(rw, rh) * 0.09}" fill="#e8b04e"/>
    </g>
    <text x="${cx}" y="${rh * 0.62}" text-anchor="middle" font-size="${Math.max(28, rw / 14)}" font-weight="800" fill="#5a3a2a" font-family="sans-serif">${escapeXml(title)}</text>
    <text x="${cx}" y="${rh * 0.7}" text-anchor="middle" font-size="${Math.max(18, rw / 22)}" fill="#7a5a4a" font-family="sans-serif">${escapeXml(body)}</text>
    <text x="${rw - 40}" y="${rh - 24}" text-anchor="end" font-size="${Math.max(20, rw / 22)}" fill="#b08040" opacity="0.6" font-family="sans-serif">MOCK · Qwen</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============ 注册表 ============

/** 按运行时配置/开关解析当前 Provider */
export function getImageProvider(forceMock = false): ImageProvider {
  const useMock = forceMock || getSettings().mock;
  if (useMock) return new MockImageProvider();
  const pid = getSettings().image.providerId;
  return pid === 'sensenova' ? new SensenovaImageProvider() : new QwenImageProvider();
}
