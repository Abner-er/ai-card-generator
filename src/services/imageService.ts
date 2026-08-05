import type { VisualPrompt, PromptConfig, CardContent, AIConfig } from '../types';
import { PromptBuilder } from './promptBuilder';

/**
 * AI 图片生成服务 (V2)
 * Stage 4: 调用 Agnes AI Image API 生成纯画面背景图
 *
 * 限流策略：
 * - 429 (Too Many Requests) → 等待 60 秒重试
 * - 503 (Service Unavailable) → 等待 30 秒重试，最多 3 次
 * - 其他错误 → 直接抛出
 */
export class ImageGenerationService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * V2 主接口：使用六段式 VisualPrompt 生成图片
   */
  async generateFromVisualPrompt(
    vp: VisualPrompt,
    onProgress?: (msg: string) => void,
  ): Promise<string> {
    const prompt = PromptBuilder.toPromptString(vp);
    const negative = vp.negative;

    if (import.meta.env.VITE_USE_MOCK === 'true') {
      return this.generateMock(prompt, 1080, 1440);
    }

    return this.generateWithAI(prompt, negative, onProgress);
  }

  /**
   * @deprecated V1兼容接口
   */
  async generate(promptConfig: PromptConfig, content: CardContent, width = 1080, height = 900): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const prompt = PromptBuilder.build(promptConfig, content);
      return this.generateMock(prompt, width, height);
    }

    const { prompt: finalPrompt, negative } = PromptBuilder.rebuildFromEditedContent(
      promptConfig,
      content,
      { promptTemplate: promptConfig } as any,
      promptConfig.subject,
    );

    return this.generateWithAI(finalPrompt, negative);
  }

  /**
   * Mock模式：生成本地占位图
   */
  private async generateMock(prompt: string, width: number, height: number): Promise<string> {
    await this.delay(500 + Math.random() * 500);
    const { bgColor1, bgColor2, accentColor, accentColor2 } = this.inferColors(prompt);
    const decorations = this.generateDecorations(prompt, width, height, accentColor, accentColor2);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bgColor1}" />
          <stop offset="100%" style="stop-color:${bgColor2}" />
        </linearGradient>
        <radialGradient id="glow1" cx="30%" cy="35%" r="40%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.25" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0" />
        </radialGradient>
        <radialGradient id="glow2" cx="70%" cy="60%" r="35%">
          <stop offset="0%" style="stop-color:${accentColor2};stop-opacity:0.2" />
          <stop offset="100%" style="stop-color:${accentColor2};stop-opacity:0" />
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="20" /></filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect width="${width}" height="${height}" fill="url(#glow1)" />
      <rect width="${width}" height="${height}" fill="url(#glow2)" />
      ${decorations}
    </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }

  private generateDecorations(prompt: string, width: number, height: number, accent: string, accent2: string): string {
    if (prompt.includes('watercolor') || prompt.includes('nature') || prompt.includes('hand-painted')) {
      return `
        <circle cx="${width * 0.2}" cy="${height * 0.3}" r="${height * 0.12}" fill="${accent}" opacity="0.06" filter="url(#blur)" />
        <circle cx="${width * 0.75}" cy="${height * 0.5}" r="${height * 0.18}" fill="${accent2}" opacity="0.05" filter="url(#blur)" />
        <path d="M0,${height * 0.7} Q${width * 0.3},${height * 0.5} ${width * 0.5},${height * 0.65} T${width},${height * 0.55} L${width},${height} L0,${height} Z" fill="${accent}" opacity="0.08" />
      `;
    }
    if (prompt.includes('clay') || prompt.includes('3D')) {
      return `
        <circle cx="${width * 0.3}" cy="${height * 0.35}" r="${height * 0.15}" fill="${accent}" opacity="0.1" filter="url(#blur)" />
        <circle cx="${width * 0.7}" cy="${height * 0.6}" r="${height * 0.2}" fill="${accent2}" opacity="0.08" filter="url(#blur)" />
      `;
    }
    if (prompt.includes('cyberpunk') || prompt.includes('neon') || prompt.includes('dark')) {
      return `
        <circle cx="${width * 0.3}" cy="${height * 0.35}" r="${height * 0.15}" fill="${accent}" opacity="0.12" filter="url(#blur)" />
        <circle cx="${width * 0.7}" cy="${height * 0.6}" r="${height * 0.2}" fill="${accent2}" opacity="0.08" filter="url(#blur)" />
        ${this.generateParticles(width, height, accent, 15)}
      `;
    }
    return `
      <circle cx="${width * 0.3}" cy="${height * 0.35}" r="${height * 0.15}" fill="${accent}" opacity="0.08" filter="url(#blur)" />
      <circle cx="${width * 0.7}" cy="${height * 0.6}" r="${height * 0.2}" fill="${accent2}" opacity="0.06" filter="url(#blur)" />
    `;
  }

  private generateParticles(width: number, height: number, color: string, count: number): string {
    let p = '';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.8;
      const r = Math.random() * 3 + 1;
      p += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${Math.random() * 0.3 + 0.1}" />`;
    }
    return p;
  }

  private inferColors(prompt: string) {
    if (prompt.includes('watercolor') || prompt.includes('nature') || prompt.includes('hand-painted')) {
      return { bgColor1: '#f9f6f0', bgColor2: '#e8dcc8', accentColor: '#8b6914', accentColor2: '#6b8e5a' };
    }
    if (prompt.includes('clay') || prompt.includes('3D')) {
      return { bgColor1: '#f5f0e6', bgColor2: '#e8dcc0', accentColor: '#c97b3c', accentColor2: '#8b6914' };
    }
    if (prompt.includes('cyberpunk') || prompt.includes('neon') || prompt.includes('dark')) {
      return { bgColor1: '#0f0f1a', bgColor2: '#16213e', accentColor: '#00d4ff', accentColor2: '#7b2ff7' };
    }
    if (prompt.includes('ink') || prompt.includes('Chinese')) {
      return { bgColor1: '#f5f0e6', bgColor2: '#e8dcc8', accentColor: '#8b4513', accentColor2: '#c97b3c' };
    }
    return { bgColor1: '#f0f4f8', bgColor2: '#e0e8f0', accentColor: '#4a90d9', accentColor2: '#7eb8e0' };
  }

  /**
   * AI模式：调用 Agnes AI 图片生成 API，含限流重试
   */
  private async generateWithAI(
    prompt: string,
    negative: string,
    onProgress?: (msg: string) => void,
  ): Promise<string> {
    const fullPrompt = negative ? `${prompt}. Avoid: ${negative}` : prompt;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        onProgress?.(attempt === 0 ? '正在生成图片...' : `第${attempt + 1}次尝试生成...`);

        const response = await fetch('/ai-api/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.imageModel || 'agnes-image-2.1-flash',
            prompt: fullPrompt,
            n: 1,
            size: this.config.imageSize || '1024x1024',
          }),
        });

        if (response.status === 429) {
          // 限流：等待 60 秒重试
          if (attempt < maxRetries) {
            onProgress?.(`图片API限流，等待60秒后重试...（第${attempt + 1}/${maxRetries}次）`);
            await this.delay(60000);
            continue;
          }
          throw new Error('图片生成限流，已达到最大重试次数，请稍后再试');
        }

        if (response.status === 503) {
          // 服务不可用：等待 30 秒重试
          if (attempt < maxRetries) {
            onProgress?.(`图片服务繁忙，等待30秒后重试...（第${attempt + 1}/${maxRetries}次）`);
            await this.delay(30000);
            continue;
          }
          throw new Error('图片服务繁忙，已达到最大重试次数');
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`图片生成失败: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        const b64 = data.data?.[0]?.b64_json;

        // 优先返回 base64（无需二次下载）
        if (b64) return `data:image/png;base64,${b64}`;

        // 如果返回的是 URL，通过服务端代理下载并转为 base64 data URL
        // 避免浏览器跨域加载远程图片失败的问题
        if (imageUrl) {
          onProgress?.('正在下载生成的图片...');
          try {
            const proxyResp = await fetch(`/ai-image-proxy?url=${encodeURIComponent(imageUrl)}`);
            if (proxyResp.ok) {
              const proxyData = await proxyResp.json();
              if (proxyData.data) return proxyData.data as string;
            }
          } catch {
            // 代理下载失败，返回原始 URL 作为兜底
            onProgress?.('图片下载失败，使用原始URL');
          }
          return imageUrl;
        }

        throw new Error(`图片生成返回数据异常: ${JSON.stringify(data).slice(0, 200)}`);
      } catch (err) {
        // 网络错误也重试
        if (attempt < maxRetries && err instanceof Error && !err.message.includes('最大重试')) {
          onProgress?.(`生成出错，3秒后重试...（第${attempt + 1}/${maxRetries}次）`);
          await this.delay(3000);
          continue;
        }
        throw err;
      }
    }

    throw new Error('图片生成失败，已达到最大重试次数');
  }

  updateConfig(config: Partial<AIConfig>) {
    this.config = { ...this.config, ...config };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
