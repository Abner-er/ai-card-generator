import type { CardTemplate } from '../types';

/**
 * 富文本模板集合 - 复杂布局风格
 * 每个模板使用 HTML/CSS 渲染器（RichCardRenderer）
 */

// ==================== 国风卷轴历史卡片 ====================
const scrollHistory: CardTemplate = {
  id: 'scroll-history',
  name: '国风卷轴',
  description: '卷轴造型、编号节点、要点总结，适合历史故事、知识讲解',
  category: 'scroll',
  canvas: { width: 1080, height: 1440, backgroundColor: '#e8dcc4' },
  renderer: 'html',
  htmlTemplateId: 'scroll-history',
  promptTemplate: {
    style: 'Chinese traditional ink painting style, ancient scroll texture, warm earth tones, historical illustration',
    subject: '{{subject}}',
    composition: 'centered composition, upper portion, leaving space at bottom for text',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量，变形',
    atmosphere: 'warm tones, soft lighting, traditional Chinese aesthetics',
    quality: 'high quality, 8K, detailed, masterpiece',
  },
};

// ==================== 手账风对比卡片 ====================
const handcraftCompare: CardTemplate = {
  id: 'handcraft-compare',
  name: '手账对比',
  description: '胶带装饰、手写体、三栏对比，适合选择对比、知识点对照',
  category: 'handcraft',
  canvas: { width: 1080, height: 1440, backgroundColor: '#f5f0e6' },
  renderer: 'html',
  htmlTemplateId: 'handcraft-compare',
  promptTemplate: {
    style: 'hand-drawn illustration style, warm pastel colors, journal aesthetic, washi tape decoration',
    subject: '{{subject}}',
    composition: 'centered illustration, soft and warm atmosphere',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
    atmosphere: 'warm, cozy, friendly, handwritten feel',
    quality: 'high quality, clean, bright',
  },
};

// ==================== 科技信息图卡片 ====================
const techInfographic: CardTemplate = {
  id: 'tech-infographic',
  name: '科技信息图',
  description: '编号模块、彩色图标、流程图，适合技术科普、产品介绍',
  category: 'tech',
  canvas: { width: 1080, height: 1440, backgroundColor: '#f5f5f0' },
  renderer: 'html',
  htmlTemplateId: 'tech-infographic',
  promptTemplate: {
    style: 'modern tech illustration, flat design, clean lines, digital art style',
    subject: '{{subject}}',
    composition: 'centered, modern layout, clean background',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
    atmosphere: 'professional, modern, tech-oriented',
    quality: 'high quality, crisp, clean',
  },
};

// ==================== 自然科普卡片 ====================
const natureScience: CardTemplate = {
  id: 'nature-science',
  name: '自然科普',
  description: '工笔插画、印章装饰、信息网格，适合自然科普、生物知识',
  category: 'nature',
  canvas: { width: 1080, height: 1440, backgroundColor: '#f5f0e0' },
  renderer: 'html',
  htmlTemplateId: 'nature-science',
  promptTemplate: {
    style: 'Chinese traditional bird-and-flower painting style, gongbi technique, rice paper texture, natural illustration',
    subject: '{{subject}}',
    composition: 'centered subject, natural environment, elegant composition',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量，变形',
    atmosphere: 'serene, natural, warm tones, traditional aesthetics',
    quality: 'high quality, 8K, detailed, masterpiece',
  },
};

export const richTemplates: CardTemplate[] = [
  scrollHistory,
  handcraftCompare,
  techInfographic,
  natureScience,
];
