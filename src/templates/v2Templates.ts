import type { CardTemplate } from '../types';

/**
 * V2 系列模板集合 - 多卡片系列模板
 * 适合生命周期、时间线、流程步骤等多卡片连续叙事场景
 * 每个模板使用专属渲染器（LifecycleRenderer / TimelineRenderer / ProcessRenderer）
 */

// ==================== 生命周期图鉴 ====================
const lifecycle: CardTemplate = {
  id: 'lifecycle',
  name: '生命周期图鉴',
  description:
    '一套展示生命成长周期的系列卡片（数量随主题自然决定，常见3-6张），中央主图+左侧圆形特写+右侧信息卡片+底部三栏+收束语，适合生命观察系列',
  category: 'lifecycle',
  canvas: { width: 1080, height: 1440, backgroundColor: '#f9f6f0' },
  renderer: 'lifecycle',
  htmlTemplateId: 'lifecycle',
  cardCount: 6, // 默认建议值，实际卡片数量以知识库检索到的阶段数为准
  promptTemplate: {
    style: 'watercolor nature illustration, hand-painted style, soft colors, natural science illustration',
    subject: '{{subject}}',
    composition:
      'centered main subject in the upper-middle area, circular close-up on the left, info card space on the right, three-column footer at the bottom, leaving clean whitespace for text overlay',
    negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
    atmosphere: 'soft natural light, scientific illustration mood, detailed and tender atmosphere',
    quality: 'high quality, 8K, masterpiece, detailed, professional natural science illustration',
  },
};

// ==================== 历史时间线 ====================
const timeline: CardTemplate = {
  id: 'timeline',
  name: '历史时间线',
  description: '横向/纵向时间轴+多节点插画+事件卡片，适合历史事件图解',
  category: 'timeline',
  canvas: { width: 1080, height: 1440, backgroundColor: '#f5f0e6' },
  renderer: 'timeline',
  htmlTemplateId: 'timeline',
  cardCount: 6,
  promptTemplate: {
    style: 'clay art style, warm earth tones, 3D clay texture, soft lighting, diorama aesthetic',
    subject: '{{subject}}',
    composition:
      'horizontal or vertical timeline axis with multiple illustrated nodes, event card spaces alongside each node, diorama-style scene segments, clean background for text overlay',
    negative:
      '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量，变形',
    atmosphere: 'warm earth tones, soft directional lighting, tactile clay diorama feel, storytelling mood',
    quality: 'high quality, 8K, detailed, masterpiece, 3D render quality',
  },
};

// ==================== 流程步骤图 ====================
const process: CardTemplate = {
  id: 'process',
  name: '流程步骤图',
  description: '顺序步骤卡片+连接箭头+总结，适合操作指南和工作流程',
  category: 'process',
  canvas: { width: 1080, height: 1440, backgroundColor: '#f0f4f8' },
  renderer: 'process',
  htmlTemplateId: 'process',
  cardCount: 6,
  promptTemplate: {
    style: 'flat design illustration, clean modern style, isometric perspective, soft gradients',
    subject: '{{subject}}',
    composition:
      'sequential step cards connected by arrows, isometric scene illustration at top, summary block at the bottom, structured grid layout with whitespace for text overlay',
    negative:
      '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量，变形',
    atmosphere: 'clean modern, soft gradient lighting, professional and friendly, isometric clarity',
    quality: 'high quality, 8K, crisp lines, clean flat design, modern infographic grade',
  },
};

export const v2Templates: CardTemplate[] = [lifecycle, timeline, process];
