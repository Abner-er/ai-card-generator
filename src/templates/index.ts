import type { CardTemplate, StylePreset } from '../types';
import { richTemplates } from './richTemplates';
import { knowledgeTemplates } from './knowledgeTemplates';
import { v2Templates } from './v2Templates';
import { stylePresets } from './stylePresets';

export { stylePresets };

/**
 * 内置模板集合（基础图层模板 + 富文本模板）
 */
export const templates: CardTemplate[] = [
  // ==================== 国风知识卡片 ====================
  {
    id: 'guofeng-classic',
    name: '国风经典',
    description: '宣纸纹理背景，书法字体，适合传统文化、自然科普主题',
    category: 'guofeng',
    canvas: {
      width: 1080,
      height: 1440,
      backgroundColor: '#f5f0e6',
    },
    promptTemplate: {
      style: 'Chinese traditional ink painting, gongbi brushwork, rice paper texture, elegant traditional aesthetic',
      subject: '{{subject}}',
      composition: 'centered composition, upper portion for illustration, lower portion for text overlay',
      negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量，变形',
      atmosphere: 'warm tones, soft lighting, traditional Chinese aesthetics',
      quality: 'high quality, 8K, detailed, masterpiece',
    },
    renderer: 'html',
    htmlTemplateId: 'scroll-history',
  },

  // ==================== 现代科技卡片 ====================
  {
    id: 'modern-tech',
    name: '现代科技',
    description: '深色渐变背景，霓虹点缀，适合科技知识、数据科普主题',
    category: 'modern',
    canvas: {
      width: 1080,
      height: 1440,
      backgroundColor: '#0f0f1a',
    },
    promptTemplate: {
      style: 'modern tech illustration, dark background, neon accents, futuristic, cyberpunk',
      subject: '{{subject}}',
      composition: '中心构图，主体占据画面上方60%区域，底部留白',
      negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
      atmosphere: '冷色调，蓝色和紫色霓虹光效，科技感强烈',
      quality: '超高清，8K，细节丰富，锐利',
    },
    renderer: 'html',
    htmlTemplateId: 'tech-infographic',
  },

  // ==================== 简约清新卡片 ====================
  {
    id: 'minimal-fresh',
    name: '简约清新',
    description: '柔和纯色背景，简洁排版，适合日常知识分享、读书笔记',
    category: 'minimal',
    canvas: {
      width: 1080,
      height: 1440,
      backgroundColor: '#faf8f5',
    },
    promptTemplate: {
      style: 'minimal flat illustration, soft pastel colors, clean design, gentle hand-drawn feel',
      subject: '{{subject}}',
      composition: 'upper portion for illustration, lower portion with ample whitespace for text',
      negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
      atmosphere: 'warm, bright, clean, fresh, soft lighting',
      quality: 'high quality, clean, bright, detailed',
    },
    renderer: 'html',
    htmlTemplateId: 'tech-infographic',
  },
];

/** 根据ID获取模板 */
export function getTemplateById(id: string): CardTemplate | undefined {
  return templates.find((t) => t.id === id);
}

// 追加富文本模板
templates.push(...richTemplates);

// 追加知识卡片模板
templates.unshift(...knowledgeTemplates);

// 追加 V2 系列模板（lifecycle/timeline/process）
templates.unshift(...v2Templates);
