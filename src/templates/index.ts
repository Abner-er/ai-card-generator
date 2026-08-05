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
      style: '中国传统工笔画风格，古画质感，宣纸纹理背景，水墨渲染',
      subject: '{{subject}}',
      composition: '中心构图，主体占据画面上方65%区域，底部留白用于文字',
      negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量，变形',
      atmosphere: '柔和自然光，温暖色调，细腻笔触，淡雅色调',
      quality: '超高清，8K，细节丰富，大师级作品',
    },
    renderer: 'layer',
    layers: [
      // 背景图片层（AI生成）
      {
        type: 'image',
        id: 'bg-image',
        source: 'ai-generated',
        promptSlot: 'main-visual',
        x: 0, y: 0,
        width: 1080, height: 900,
      },
      // 底部渐变遮罩（增强文字可读性）
      {
        type: 'box',
        id: 'gradient-mask',
        x: 0, y: 700,
        width: 1080, height: 200,
        background: 'linear-gradient(to bottom, transparent, #f5f0e6)',
      },
      // 顶部装饰条
      {
        type: 'box',
        id: 'top-bar',
        x: 80, y: 80,
        width: 80, height: 4,
        background: '#8b4513',
      },
      // 主标题
      {
        type: 'text',
        id: 'title',
        content: '{{title}}',
        x: 80, y: 960,
        width: 920, height: 120,
        align: 'left',
        fontFamily: '"Noto Serif SC", serif',
        fontSize: 72,
        fontWeight: 700,
        color: '#3a2410',
        lineHeight: 1.3,
        letterSpacing: '0.05em',
      },
      // 副标题
      {
        type: 'text',
        id: 'subtitle',
        content: '{{subtitle}}',
        x: 80, y: 1100,
        width: 920, height: 60,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 28,
        fontWeight: 400,
        color: '#8b6914',
        lineHeight: 1.5,
      },
      // 正文内容
      {
        type: 'text',
        id: 'body',
        content: '{{body}}',
        x: 80, y: 1200,
        width: 920, height: 160,
        align: 'left',
        fontFamily: '"Noto Serif SC", serif',
        fontSize: 24,
        fontWeight: 400,
        color: '#4a3820',
        lineHeight: 1.8,
      },
      // 底部信息
      {
        type: 'text',
        id: 'footer',
        content: '{{footer}}',
        x: 80, y: 1380,
        width: 920, height: 40,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 18,
        fontWeight: 400,
        color: '#9a8a6a',
      },
    ],
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
      style: '现代科技风格，深色背景，霓虹光效，未来感，赛博朋克',
      subject: '{{subject}}',
      composition: '中心构图，主体占据画面上方60%区域，底部留白',
      negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
      atmosphere: '冷色调，蓝色和紫色霓虹光效，科技感强烈',
      quality: '超高清，8K，细节丰富，锐利',
    },
    renderer: 'layer',
    layers: [
      // 背景图片层
      {
        type: 'image',
        id: 'bg-image',
        source: 'ai-generated',
        promptSlot: 'main-visual',
        x: 0, y: 0,
        width: 1080, height: 880,
      },
      // 渐变遮罩
      {
        type: 'box',
        id: 'gradient-mask',
        x: 0, y: 680,
        width: 1080, height: 220,
        background: 'linear-gradient(to bottom, transparent, #0f0f1a)',
      },
      // 内容区背景卡片
      {
        type: 'box',
        id: 'content-card',
        x: 60, y: 900,
        width: 960, height: 480,
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
      },
      // 标签
      {
        type: 'tag',
        id: 'tag-1',
        x: 80, y: 920,
        width: 120, height: 36,
        content: '{{tag}}',
      },
      // 主标题
      {
        type: 'text',
        id: 'title',
        content: '{{title}}',
        x: 80, y: 980,
        width: 920, height: 100,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 64,
        fontWeight: 700,
        color: '#ffffff',
        lineHeight: 1.3,
      },
      // 副标题
      {
        type: 'text',
        id: 'subtitle',
        content: '{{subtitle}}',
        x: 80, y: 1100,
        width: 920, height: 50,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 26,
        fontWeight: 400,
        color: '#00d4ff',
      },
      // 正文
      {
        type: 'text',
        id: 'body',
        content: '{{body}}',
        x: 80, y: 1180,
        width: 920, height: 160,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 22,
        fontWeight: 400,
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: 1.8,
      },
      // 底部
      {
        type: 'text',
        id: 'footer',
        content: '{{footer}}',
        x: 80, y: 1360,
        width: 920, height: 40,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 16,
        fontWeight: 400,
        color: 'rgba(255, 255, 255, 0.4)',
      },
    ],
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
      style: '简约插画风格，柔和色彩，扁平化设计，手绘感',
      subject: '{{subject}}',
      composition: '上部40%区域为主题插画，下方大面积留白用于文字排版',
      negative: '文字，字母，数字，水印，签名，标语，logo，任何语言文字，模糊，低质量',
      atmosphere: '温暖柔和的色调，明亮通透，清新自然',
      quality: '高清，4K，色彩柔和，构图干净',
    },
    renderer: 'layer',
    layers: [
      // 插画区域
      {
        type: 'image',
        id: 'bg-image',
        source: 'ai-generated',
        promptSlot: 'main-visual',
        x: 0, y: 0,
        width: 1080, height: 580,
      },
      // 装饰圆点
      {
        type: 'box',
        id: 'accent-dot',
        x: 80, y: 640,
        width: 12, height: 12,
        background: '#e8a87c',
        borderRadius: 6,
      },
      // 标签
      {
        type: 'text',
        id: 'tag-text',
        content: '{{tag}}',
        x: 110, y: 635,
        width: 200, height: 30,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 16,
        fontWeight: 500,
        color: '#e8a87c',
        letterSpacing: '0.1em',
      },
      // 主标题
      {
        type: 'text',
        id: 'title',
        content: '{{title}}',
        x: 80, y: 700,
        width: 920, height: 140,
        align: 'left',
        fontFamily: '"Noto Serif SC", serif',
        fontSize: 56,
        fontWeight: 700,
        color: '#2d3436',
        lineHeight: 1.35,
      },
      // 分隔线
      {
        type: 'box',
        id: 'divider',
        x: 80, y: 870,
        width: 60, height: 3,
        background: '#e8a87c',
      },
      // 副标题
      {
        type: 'text',
        id: 'subtitle',
        content: '{{subtitle}}',
        x: 80, y: 900,
        width: 920, height: 50,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 24,
        fontWeight: 500,
        color: '#636e72',
      },
      // 正文
      {
        type: 'text',
        id: 'body',
        content: '{{body}}',
        x: 80, y: 990,
        width: 920, height: 320,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 22,
        fontWeight: 400,
        color: '#636e72',
        lineHeight: 2,
      },
      // 底部
      {
        type: 'text',
        id: 'footer',
        content: '{{footer}}',
        x: 80, y: 1360,
        width: 920, height: 40,
        align: 'left',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 16,
        fontWeight: 400,
        color: '#b2bec3',
      },
    ],
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
