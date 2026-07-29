import type { PromptConfig, CardContent, AIImageConfig } from '../types';
import { PromptBuilder } from './promptBuilder';

/**
 * AI图片生成服务
 * 支持 Mock 模式（本地占位图）和真实API模式（通义万相/文心一格）
 */
export class ImageGenerationService {
  private config: AIImageConfig;

  constructor(config: AIImageConfig) {
    this.config = config;
  }

  /**
   * 生成图片
   * 返回图片的URL或Base64
   */
  async generate(promptConfig: PromptConfig, content: CardContent, width = 1080, height = 900): Promise<string> {
    const prompt = PromptBuilder.build(promptConfig, content);

    switch (this.config.provider) {
      case 'mock':
        return this.generateMock(prompt, width, height);
      case 'tongyi':
        return this.generateWithTongyi(promptConfig, content);
      case 'wenxin':
        return this.generateWithWenxin(promptConfig, content);
      default:
        return this.generateMock(prompt, width, height);
    }
  }

  /**
   * Mock模式：生成本地占位图（高质量SVG渐变 + 装饰元素）
   */
  private async generateMock(prompt: string, width: number, height: number): Promise<string> {
    const { bgColor1, bgColor2, accentColor, accentColor2 } = this.inferColors(prompt);

    // 根据提示词风格生成不同的装饰图案
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
        <filter id="blur">
          <feGaussianBlur stdDeviation="20" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect width="${width}" height="${height}" fill="url(#glow1)" />
      <rect width="${width}" height="${height}" fill="url(#glow2)" />
      ${decorations}
    </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }

  /**
   * 根据提示词风格生成装饰图案
   */
  private generateDecorations(prompt: string, width: number, height: number, accent: string, accent2: string): string {
    // 国风：水墨、花瓣、山水
    if (prompt.includes('工笔画') || prompt.includes('水墨') || prompt.includes('古画') || prompt.includes('宣纸') || prompt.includes('Chinese traditional')) {
      return `
        <circle cx="${width * 0.2}" cy="${height * 0.3}" r="${height * 0.12}" fill="${accent}" opacity="0.06" filter="url(#blur)" />
        <circle cx="${width * 0.75}" cy="${height * 0.5}" r="${height * 0.18}" fill="${accent2}" opacity="0.05" filter="url(#blur)" />
        <path d="M0,${height * 0.7} Q${width * 0.3},${height * 0.5} ${width * 0.5},${height * 0.65} T${width},${height * 0.55} L${width},${height} L0,${height} Z" fill="${accent}" opacity="0.08" />
        <circle cx="${width * 0.5}" cy="${height * 0.25}" r="${height * 0.06}" fill="${accent2}" opacity="0.1" filter="url(#blur)" />
      `;
    }
    // 科技：网格、粒子、光束
    if (prompt.includes('科技') || prompt.includes('霓虹') || prompt.includes('赛博') || prompt.includes('futuristic') || prompt.includes('dark')) {
      return `
        <circle cx="${width * 0.3}" cy="${height * 0.35}" r="${height * 0.15}" fill="${accent}" opacity="0.12" filter="url(#blur)" />
        <circle cx="${width * 0.7}" cy="${height * 0.6}" r="${height * 0.2}" fill="${accent2}" opacity="0.08" filter="url(#blur)" />
        <line x1="0" y1="${height * 0.3}" x2="${width}" y2="${height * 0.4}" stroke="${accent}" stroke-width="2" opacity="0.15" />
        <line x1="0" y1="${height * 0.5}" x2="${width}" y2="${height * 0.45}" stroke="${accent2}" stroke-width="1" opacity="0.1" />
        ${this.generateParticles(width, height, accent, 15)}
      `;
    }
    // 简约/清新：柔和几何形状
    if (prompt.includes('清新') || prompt.includes('自然') || prompt.includes('柔和') || prompt.includes('minimal') || prompt.includes('illustration')) {
      return `
        <circle cx="${width * 0.25}" cy="${height * 0.35}" r="${height * 0.14}" fill="${accent}" opacity="0.1" filter="url(#blur)" />
        <circle cx="${width * 0.7}" cy="${height * 0.55}" r="${height * 0.16}" fill="${accent2}" opacity="0.08" filter="url(#blur)" />
        <circle cx="${width * 0.5}" cy="${height * 0.2}" r="${height * 0.05}" fill="${accent}" opacity="0.15" />
        <circle cx="${width * 0.85}" cy="${height * 0.25}" r="${height * 0.04}" fill="${accent2}" opacity="0.12" />
      `;
    }
    // 默认：通用装饰
    return `
      <circle cx="${width * 0.3}" cy="${height * 0.35}" r="${height * 0.15}" fill="${accent}" opacity="0.08" filter="url(#blur)" />
      <circle cx="${width * 0.7}" cy="${height * 0.6}" r="${height * 0.2}" fill="${accent2}" opacity="0.06" filter="url(#blur)" />
      <circle cx="${width * 0.5}" cy="${height * 0.3}" r="${height * 0.08}" fill="${accent}" opacity="0.1" />
    `;
  }

  /**
   * 生成随机粒子（用于科技风格）
   */
  private generateParticles(width: number, height: number, color: string, count: number): string {
    let particles = '';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.8;
      const r = Math.random() * 3 + 1;
      const opacity = Math.random() * 0.3 + 0.1;
      particles += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`;
    }
    return particles;
  }

  /**
   * 根据提示词推断配色方案
   */
  private inferColors(prompt: string) {
    if (prompt.includes('工笔画') || prompt.includes('水墨') || prompt.includes('古画') || prompt.includes('宣纸') || prompt.includes('Chinese traditional') || prompt.includes('warm earth')) {
      return { bgColor1: '#e8dcc8', bgColor2: '#d4c4a8', accentColor: '#8b6914', accentColor2: '#c97b3c' };
    }
    if (prompt.includes('科技') || prompt.includes('霓虹') || prompt.includes('赛博') || prompt.includes('futuristic') || prompt.includes('dark') || prompt.includes('neon')) {
      return { bgColor1: '#1a1a2e', bgColor2: '#16213e', accentColor: '#00d4ff', accentColor2: '#7b2ff7' };
    }
    if (prompt.includes('清新') || prompt.includes('自然') || prompt.includes('柔和') || prompt.includes('minimal') || prompt.includes('pastel')) {
      return { bgColor1: '#f0e6d6', bgColor2: '#e8d5c4', accentColor: '#e8a87c', accentColor2: '#c4b5a0' };
    }
    // 默认
    return { bgColor1: '#f5f0e6', bgColor2: '#e8dcc8', accentColor: '#8b4513', accentColor2: '#c97b3c' };
  }

  /**
   * 通义万相API调用
   * 文档：https://help.aliyun.com/document_detail/470012.html
   */
  private async generateWithTongyi(promptConfig: PromptConfig, content: CardContent): Promise<string> {
    const params = PromptBuilder.buildForTongyi(promptConfig, content);

    // 注意：实际使用时需要后端代理调用，避免API Key暴露在前端
    const response = await fetch('/api/generate-image/tongyi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        apiKey: this.config.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`通义万相API调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.output?.results?.[0]?.url || data.data?.[0]?.url;
  }

  /**
   * 文心一格API调用
   * 文档：https://cloud.baidu.com/doc/WENXINWORKSHOP/s/al676bcxn
   */
  private async generateWithWenxin(promptConfig: PromptConfig, content: CardContent): Promise<string> {
    const params = PromptBuilder.buildForWenxin(promptConfig, content);

    const response = await fetch('/api/generate-image/wenxin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        apiKey: this.config.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`文心一格API调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.data?.[0]?.b64_image || data.data?.[0]?.url;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AIImageConfig>) {
    this.config = { ...this.config, ...config };
  }
}
