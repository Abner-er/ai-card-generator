import type { CardTemplate } from '../types';

/**
 * 知识卡片模板 - 结构化信息卡片
 * 每个模板使用 KnowledgeCardRenderer 渲染
 */

// ==================== 知识速记卡 ====================
const quickKnowledge: CardTemplate = {
  id: 'quick-knowledge',
  name: '知识速记卡',
  description: '概念+要点+例子+注意+金句，结构化知识模块，适合社交媒体分享',
  category: 'quick',
  canvas: { width: 1080, height: 1440, backgroundColor: '#F5F5F0' },
  renderer: 'knowledge',
  htmlTemplateId: 'quick-knowledge',
  promptTemplate: {
    style: 'modern flat illustration, clean minimal style, tech-oriented',
    subject: '{{subject}}',
    composition: 'centered, clean background, leaving space for text overlay',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
    atmosphere: 'professional, modern, clean',
    quality: 'high quality, crisp, clean',
  },
};

// ==================== 百科词条卡 ====================
const encyclopedia: CardTemplate = {
  id: 'encyclopedia',
  name: '百科词条卡',
  description: '定义+信息框+详解+要点，左侧主体右侧信息栏，适合知识体系梳理',
  category: 'encyclopedia',
  canvas: { width: 1080, height: 1440, backgroundColor: '#FAFAFA' },
  renderer: 'knowledge',
  htmlTemplateId: 'encyclopedia',
  promptTemplate: {
    style: 'clean editorial illustration, informative style, encyclopedia aesthetic',
    subject: '{{subject}}',
    composition: 'centered subject, clean background',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
    atmosphere: 'professional, academic, clean',
    quality: 'high quality, detailed, clean',
  },
};

// ==================== 对比分析卡 ====================
const compareCard: CardTemplate = {
  id: 'compare-card',
  name: '对比分析卡',
  description: '多栏对比+特征列表+选择引导，手账风格，适合选择决策、知识点对照',
  category: 'compare',
  canvas: { width: 1080, height: 1440, backgroundColor: '#f5f0e6' },
  renderer: 'knowledge',
  htmlTemplateId: 'compare-card',
  promptTemplate: {
    style: 'hand-drawn illustration style, warm pastel colors, journal aesthetic',
    subject: '{{subject}}',
    composition: 'centered illustration, warm atmosphere',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
    atmosphere: 'warm, cozy, friendly',
    quality: 'high quality, clean, bright',
  },
};

export const knowledgeTemplates: CardTemplate[] = [
  quickKnowledge,
  encyclopedia,
  compareCard,
];
