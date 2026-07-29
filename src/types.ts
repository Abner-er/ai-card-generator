/**
 * AI知识卡片生成系统 - 核心类型定义
 */

/** 知识模块类型 - 对应知识卡片中的各类信息区块 */
export type ModuleType =
  | 'concept'    // 概念定义
  | 'points'     // 核心要点
  | 'example'    // 实例说明
  | 'suitable'   // 适用场景
  | 'process'    // 操作流程
  | 'note'       // 注意事项
  | 'tip'        // 小贴士
  | 'resource'   // 资源链接
  | 'compare'    // 对比项
  | 'fact';      // 关键事实

/** 知识模块 - 知识卡片的核心信息单元 */
export interface KnowledgeModule {
  id: string;
  type: ModuleType;
  title: string;
  /** 正文内容 */
  content: string;
  /** 要点列表（适合"核心要点"等模块） */
  bullets?: string[];
  /** 图标 emoji */
  icon?: string;
}

/** 流程步骤 - 用于流程可视化 */
export interface ProcessStep {
  id: string;
  label: string;
  icon?: string;
}

/** 对比项 - 用于对比类卡片 */
export interface CompareItem {
  id: string;
  label: string;
  /** 选项标识（如 A/B/C） */
  badge?: string;
  /** 颜色主题 */
  color?: string;
  /** 特征列表 */
  features: string[];
  /** 适用人群 */
  suitableFor?: string;
}

/** 卡片内容数据 */
export interface CardContent {
  // ===== 基础信息 =====
  title: string;
  subtitle: string;
  body: string;
  footer: string;
  tags: string[];

  // ===== 系列信息 =====
  /** 系列名称（如"知识速记"） */
  seriesName?: string;
  /** 当前期号（如"03"） */
  episode?: string;
  /** 总期数（如"09"） */
  totalEpisodes?: string;
  /** 主题编号（如"01"） */
  topicNumber?: string;
  /** 英文副标题 */
  englishSubtitle?: string;

  // ===== 结构化知识内容 =====
  /** 概念定义（一段话描述） */
  definition?: string;
  /** 知识模块列表 */
  modules?: KnowledgeModule[];
  /** 流程步骤 */
  processSteps?: ProcessStep[];
  /** 对比项列表 */
  compareItems?: CompareItem[];

  // ===== 辅助内容 =====
  /** 手写批注（红色手写体） */
  handwrittenNote?: string;
  /** 底部金句 */
  quote?: string;
  /** 要点列表 */
  highlights?: string[];
  /** 章节编号 */
  chapter?: string;

  // ===== 兼容旧字段 =====
  sections?: ContentSection[];
}

/** 旧版内容区块（兼容） */
export interface ContentSection {
  id: string;
  title: string;
  body: string;
  icon?: string;
  index?: number;
}

/** AI图片生成提示词配置 */
export interface PromptConfig {
  style: string;
  subject: string;
  composition: string;
  negative: string;
  atmosphere: string;
  quality: string;
}

/** 渲染器类型 */
export type RendererType = 'layer' | 'html' | 'knowledge';

/** 卡片模板配置 */
export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'quick' | 'encyclopedia' | 'compare' | 'guofeng' | 'modern' | 'minimal' | 'scroll' | 'handcraft' | 'tech' | 'nature';
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  promptTemplate: PromptConfig;
  renderer: RendererType;
  layers?: TemplateLayer[];
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
  imagePrompt: string;
  summary: string;

  // 结构化知识内容
  seriesName?: string;
  episode?: string;
  totalEpisodes?: string;
  topicNumber?: string;
  englishSubtitle?: string;
  definition?: string;
  modules?: KnowledgeModule[];
  processSteps?: ProcessStep[];
  compareItems?: CompareItem[];
  handwrittenNote?: string;
  quote?: string;

  // 兼容旧字段
  sections?: ContentSection[];
  highlights?: string[];
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
