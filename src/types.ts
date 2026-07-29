/**
 * AI知识卡片生成系统 - 核心类型定义
 */

/** 内容区块（用于复杂模板的多段内容） */
export interface ContentSection {
  /** 区块ID */
  id: string;
  /** 区块标题 */
  title: string;
  /** 区块正文 */
  body: string;
  /** 图标标识（emoji或关键词） */
  icon?: string;
  /** 序号 */
  index?: number;
}

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
  /** 多区块内容（复杂模板使用） */
  sections?: ContentSection[];
  /** 要点列表（底部总结用） */
  highlights?: string[];
  /** 章节编号（如"01"、"第四章"） */
  chapter?: string;
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

/** 渲染器类型 */
export type RendererType = 'layer' | 'html';

/** 卡片模板配置 */
export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'guofeng' | 'modern' | 'minimal' | 'scroll' | 'handcraft' | 'tech' | 'nature';
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  /** AI图片生成提示词模板 */
  promptTemplate: PromptConfig;
  /** 渲染器类型：layer=绝对定位图层，html=HTML/CSS模板 */
  renderer: RendererType;
  /** 图层列表（layer渲染器使用，从下到上渲染） */
  layers?: TemplateLayer[];
  /** HTML模板ID（html渲染器使用，对应RichCardRenderer中的组件） */
  htmlTemplateId?: string;
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
  source?: 'ai-generated' | 'static';
  promptSlot?: string;
  content?: string;
  align?: 'left' | 'center' | 'right';
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  lineHeight?: number;
  letterSpacing?: string;
  background?: string;
  borderRadius?: number;
  border?: string;
  boxShadow?: string;
  backdropFilter?: string;
}

/** AI图片生成服务配置 */
export interface AIImageConfig {
  provider: 'mock' | 'tongyi' | 'wenxin';
  apiKey?: string;
  size: string;
  mode: 'fast' | 'quality';
}

/** AI文本生成服务配置 */
export interface AITextConfig {
  provider: 'mock' | 'qianwen' | 'deepseek' | 'zhipu';
  apiKey?: string;
  model?: string;
}

/** AI生成的内容结果 */
export interface AIGeneratedContent {
  title: string;
  subtitle: string;
  body: string;
  tags: string[];
  /** AI生成的配图提示词（英文，用于图片生成） */
  imagePrompt: string;
  /** 知识点摘要，用于用户参考 */
  summary: string;
  /** 多区块内容（复杂模板使用） */
  sections?: ContentSection[];
  /** 要点列表 */
  highlights?: string[];
  /** 章节编号 */
  chapter?: string;
}

/** 工作流步骤 */
export type WorkflowStep = 'input' | 'generating-content' | 'review-content' | 'generating-image' | 'done';

/** 生成状态 */
export type GenerationStatus = 'idle' | 'generating-content' | 'generating-prompt' | 'generating-image' | 'rendering' | 'done' | 'error';

/** 生成结果 */
export interface GenerationResult {
  status: GenerationStatus;
  imageUrl?: string;
  error?: string;
  prompt?: string;
}
