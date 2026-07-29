import type { PromptConfig, CardContent } from '../types';

/**
 * 提示词引擎 - 根据用户输入和模板配置生成AI图片生成提示词
 */
export class PromptBuilder {
  /**
   * 根据模板提示词配置和用户输入内容，构建完整的提示词
   */
  static build(config: PromptConfig, content: CardContent): string {
    const subject = this.extractSubject(content);
    const filledSubject = config.subject.replace('{{subject}}', subject);

    const parts = [
      config.style,
      filledSubject,
      config.composition,
      config.atmosphere,
      config.quality,
    ].filter(Boolean);

    return parts.join('，');
  }

  /**
   * 获取负面提示词
   */
  static getNegativePrompt(config: PromptConfig): string {
    return config.negative;
  }

  /**
   * 从卡片内容中提取AI图片的主体描述
   * 策略：优先使用标题，其次副标题，最后从正文提取关键词
   */
  static extractSubject(content: CardContent): string {
    // 如果有标签，用标签+标题组合
    if (content.tags && content.tags.length > 0) {
      return `${content.tags[0]} ${content.title}`;
    }
    
    // 默认使用标题
    if (content.title) {
      return content.title;
    }

    // 从副标题提取
    if (content.subtitle) {
      return content.subtitle;
    }

    // 从正文提取前30个字符
    if (content.body) {
      return content.body.slice(0, 30);
    }

    return '知识卡片配图';
  }

  /**
   * 生成通义万相API格式的提示词参数
   */
  static buildForTongyi(config: PromptConfig, content: CardContent) {
    return {
      prompt: this.build(config, content),
      negative_prompt: this.getNegativePrompt(config),
      n: 1,
      size: '1024*1024',
    };
  }

  /**
   * 生成文心一格API格式的提示词参数
   */
  static buildForWenxin(config: PromptConfig, content: CardContent) {
    return {
      prompt: this.build(config, content),
      negativePrompt: this.getNegativePrompt(config),
      style: this.mapStyleForWenxin(config.style),
      resolution: '1024*1024',
     Num: 1,
    };
  }

  /**
   * 将模板风格映射为文心一格支持的风格参数
   */
  private static mapStyleForWenxin(style: string): string {
    if (style.includes('工笔画') || style.includes('水墨') || style.includes('古画')) {
      return '古风';
    }
    if (style.includes('科技') || style.includes('霓虹') || style.includes('赛博')) {
      return '未来主义';
    }
    if (style.includes('插画') || style.includes('手绘') || style.includes('扁平')) {
      return '动漫';
    }
    return '写实';
  }
}
