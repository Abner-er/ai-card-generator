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
   * Mock模式：生成本地占位图（SVG渐变背景 + 主题文字标注）
   */
  private async generateMock(prompt: string, width: number, height: number): Promise<string> {
    // 根据提示词推断色调
    const { bgColor1, bgColor2, accentColor } = this.inferColors(prompt);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bgColor1}" />
          <stop offset="100%" style="stop-color:${bgColor2}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect width="${width}" height="${height}" fill="url(#glow)" />
      <circle cx="${width * 0.3}" cy="${height * 0.35}" r="${height * 0.15}" fill="${accentColor}" opacity="0.08" />
      <circle cx="${width * 0.7}" cy="${height * 0.6}" r="${height * 0.2}" fill="${accentColor}" opacity="0.06" />
      <circle cx="${width * 0.5}" cy="${height * 0.3}" r="${height * 0.08}" fill="${accentColor}" opacity="0.1" />
    </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }

  /**
   * 根据提示词推断配色方案
   */
  private inferColors(prompt: string) {
    if (prompt.includes('工笔画') || prompt.includes('水墨') || prompt.includes('古画') || prompt.includes('宣纸')) {
      return { bgColor1: '#e8dcc8', bgColor2: '#d4c4a8', accentColor: '#8b6914' };
    }
    if (prompt.includes('科技') || prompt.includes('霓虹') || prompt.includes('赛博') || prompt.includes('深色')) {
      return { bgColor1: '#1a1a2e', bgColor2: '#16213e', accentColor: '#00d4ff' };
    }
    if (prompt.includes('清新') || prompt.includes('自然') || prompt.includes('柔和')) {
      return { bgColor1: '#f0e6d6', bgColor2: '#e8d5c4', accentColor: '#e8a87c' };
    }
    // 默认
    return { bgColor1: '#f5f0e6', bgColor2: '#e8dcc8', accentColor: '#8b4513' };
  }

  /**
   * 通义万相API调用
   * 文档：https://help.aliyun.com/document_detail/470012.html
   */
  private async generateWithTongyi(promptConfig: PromptConfig, content: CardContent): Promise<string> {
    const params = PromptBuilder.buildForTongyi(promptConfig, content);
    
    // 注意：实际使用时需要后端代理调用，避免API Key暴露在前端
    // 这里仅作为示例，实际部署时应通过后端API中转
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
    // 通义万相返回的是URL
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
