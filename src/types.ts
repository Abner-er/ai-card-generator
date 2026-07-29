/**
 * AI知识卡片生成系统 - 核心类型定义
 */

/** 卡片内容数据 */
export interface CardContent {
  /** 主标题 */
  title: string;
  /** 副标题 */
  subtitle: string;
  /** 正文内容（支持换行） */
  body: string;
  /** 底部信息（如作者、日期等） */
  footer: string;
  /** 标签列表 */
  tags: string[];
}

/** AI图片生成提示词配置 */
export interface PromptConfig {
  /** 视觉风格描述 */
  style: string;
  /** 主体描述 */
  subject: string;
  /** 构图布局 */
  composition: string;
  /** 负面提示词（排除文字等） */
  negative: string;
  /** 氛围与光线 */
  atmosphere: string;
  /** 画质要求 */
  quality: string;
}

/** 模板图层类型 */
export type LayerType = 'image' | 'text' | 'box' | 'tag';

/** 模板图层配置 */
export interface TemplateLayer {
  type: LayerType;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // 图片层
  source?: 'ai-generated' | 'static';
  promptSlot?: string;
  // 文字层
  content?: string;
  align?: 'left' | 'center' | 'right';
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  lineHeight?: number;
  letterSpacing?: string;
  // 盒子层
  background?: string;
  borderRadius?: number;
  border?: string;
  boxShadow?: string;
  backdropFilter?: string;
}

/** 卡片模板配置 */
export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'guofeng' | 'modern' | 'minimal';
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  /** AI图片生成提示词模板 */
  promptTemplate: PromptConfig;
  /** 图层列表（从下到上渲染） */
  layers: TemplateLayer[];
}

/** AI图片生成服务配置 */
export interface AIImageConfig {
  provider: 'mock' | 'tongyi' | 'wenxin';
  apiKey?: string;
  /** 图片尺寸 */
  size: string;
  /** 生成模式 */
  mode: 'fast' | 'quality';
}

/** 生成状态 */
export type GenerationStatus = 'idle' | 'generating-prompt' | 'generating-image' | 'rendering' | 'done' | 'error';

/** 生成结果 */
export interface GenerationResult {
  status: GenerationStatus;
  imageUrl?: string;
  error?: string;
  prompt?: string;
}
