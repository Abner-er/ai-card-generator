import type { PromptConfig, CardContent, AIGeneratedContent, CardTemplate } from '../types';

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
   * 如果AI生成了专用的图片提示词（imagePrompt），优先使用它
   * 否则回退到模板提示词
   */
  static buildFromAIContent(
    config: PromptConfig,
    content: CardContent,
    aiContent?: AIGeneratedContent
  ): { prompt: string; negative: string; source: 'ai' | 'template' } {
    // 如果AI生成了英文图片提示词，优先使用
    if (aiContent?.imagePrompt && aiContent.imagePrompt.trim().length > 10) {
      // 将AI提示词与模板的风格和构图信息组合
      const parts = [
        aiContent.imagePrompt,
        config.composition,
        config.quality,
      ].filter(Boolean);
      return {
        prompt: parts.join('，'),
        negative: config.negative,
        source: 'ai',
      };
    }

    // 回退：使用模板提示词
    return {
      prompt: this.build(config, content),
      negative: this.getNegativePrompt(config),
      source: 'template',
    };
  }

  /**
   * 用户编辑内容后，重新整理提示词
   * 将用户修改后的内容转换为图片生成提示词
   */
  static rebuildFromEditedContent(
    config: PromptConfig,
    content: CardContent,
    template: CardTemplate,
    baseImagePrompt?: string
  ): { prompt: string; negative: string } {
    // 如果用户编辑了内容，我们需要根据新内容更新提示词
    const subject = this.extractSubject(content);

    // 如果有AI基础提示词，替换其中的主体描述
    if (baseImagePrompt) {
      // 保留AI原始提示词的风格描述，只更新主体
      // 简单策略：在基础提示词后面追加新的关键词
      const updatedPrompt = `${baseImagePrompt}, ${this.contentToImageKeywords(content)}`;
      return {
        prompt: updatedPrompt,
        negative: config.negative,
      };
    }

    // 没有AI提示词，从内容生成
    const keywords = this.contentToImageKeywords(content);
    const parts = [
      config.style,
      keywords,
      config.composition,
      config.atmosphere,
      config.quality,
    ].filter(Boolean);

    return {
      prompt: parts.join('，'),
      negative: config.negative,
    };
  }

  /**
   * 将卡片内容转换为图片关键词
   */
  static contentToImageKeywords(content: CardContent): string {
    const parts: string[] = [];

    // 从标题提取
    if (content.title) {
      parts.push(content.title);
    }

    // 从标签提取
    if (content.tags && content.tags.length > 0) {
      parts.push(content.tags.join('，'));
    }

    // 从副标题提取前20字
    if (content.subtitle) {
      parts.push(content.subtitle.slice(0, 20));
    }

    return parts.join('，') || '知识卡片配图';
  }

  /**
   * 获取负面提示词
   */
  static getNegativePrompt(config: PromptConfig): string {
    return config.negative;
  }

  /**
   * 从卡片内容中提取AI图片的主体描述
   */
  static extractSubject(content: CardContent): string {
    if (content.tags && content.tags.length > 0) {
      return `${content.tags[0]} ${content.title}`;
    }
    if (content.title) return content.title;
    if (content.subtitle) return content.subtitle;
    if (content.body) return content.body.slice(0, 30);
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
    if (style.includes('工笔画') || style.includes('水墨') || style.includes('古画')) return '古风';
    if (style.includes('科技') || style.includes('霓虹') || style.includes('赛博')) return '未来主义';
    if (style.includes('插画') || style.includes('手绘') || style.includes('扁平')) return '动漫';
    return '写实';
  }
}
