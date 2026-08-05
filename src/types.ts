/**
 * AI 信息图工作室 - 核心类型定义 (V2)
 * 基于产品分析文档：五阶段全链路工作流
 * 知识检索 → 内容生成 → Prompt工程 → AI出图 → HTML排版导出
 */

// ============================================================
// Part 1: 知识模块类型（兼容V1，知识卡片中的信息区块）
// ============================================================

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

export interface KnowledgeModule {
  id: string;
  type: ModuleType;
  title: string;
  content: string;
  bullets?: string[];
  icon?: string;
}

export interface ProcessStep {
  id: string;
  label: string;
  icon?: string;
}

export interface CompareItem {
  id: string;
  label: string;
  badge?: string;
  color?: string;
  features: string[];
  suitableFor?: string;
}

// ============================================================
// Part 2: Stage 1 — 知识检索输出
// ============================================================

/** 知识事实条目 */
export interface KnowledgeFact {
  label: string;
  value: string;
}

/** 生命周期阶段数据（lifecycle 模板专用） */
export interface LifecycleStage {
  id: string;
  name: string;       // 阶段名称，如"新生期"
  period: string;     // 时间段，如"0–2周"
  description: string; // 阶段描述
  features: string[];  // 外观/行为特征
  trivia?: string;     // 小知识
}

/** 时间线事件数据（timeline 模板专用） */
export interface TimelineEvent {
  id: string;
  year: string;        // 年份/时间标记
  title: string;       // 事件标题
  description: string; // 事件描述
  significance?: string; // 历史意义
}

/** 流程步骤数据（process 模板专用） */
export interface ProcessStepData {
  id: string;
  order: number;
  title: string;
  description: string;
  tip?: string;
}

/** 对比数据（comparison 模板专用） */
export interface CompareData {
  id: string;
  label: string;
  features: string[];
  pros: string[];
  cons: string[];
  suitableFor: string;
}

/** 知识库 — Stage 1 的完整输出 */
export interface KnowledgeBase {
  topic: string;
  summary: string;
  category: string;
  tags: string[];
  facts: KnowledgeFact[];
  keyPoints: string[];
  // 模板专用结构化数据
  lifecycleStages?: LifecycleStage[];
  timelineEvents?: TimelineEvent[];
  processSteps?: ProcessStepData[];
  compareData?: CompareData[];
  // 英文主题翻译（用于Prompt）
  englishTopic?: string;
}

// ============================================================
// Part 3: Stage 2 — 卡片内容
// ============================================================

/** 旧版内容区块（兼容V1） */
export interface ContentSection {
  id: string;
  title: string;
  body: string;
  icon?: string;
  index?: number;
}

/** 卡片内容数据 — Stage 2 的输出 */
export interface CardContent {
  // 基础信息
  title: string;
  subtitle: string;
  body: string;
  footer: string;
  tags: string[];

  // 系列信息
  seriesName?: string;
  episode?: string;
  totalEpisodes?: string;
  topicNumber?: string;
  englishSubtitle?: string;

  // 结构化知识内容
  definition?: string;
  modules?: KnowledgeModule[];
  processSteps?: ProcessStep[];
  compareItems?: CompareItem[];

  // 辅助内容
  handwrittenNote?: string;
  quote?: string;
  highlights?: string[];
  chapter?: string;

  // 兼容旧字段
  sections?: ContentSection[];
}

// ============================================================
// Part 4: Stage 3 — 六段式纯画面 Prompt
// ============================================================

/** 六段式 Prompt 结构（纯画面，无中文文字） */
export interface VisualPrompt {
  /** 1. 画面基调 — 视觉风格、底色、质感 */
  style: string;
  /** 2. 布局骨架 — 画面分区结构（只描述形状，不写文字） */
  layout: string;
  /** 3. 主视觉插画 — 核心主体的详细描述 */
  mainVisual: string;
  /** 4. 辅助插画 — 圆形特写、小图标、装饰元素 */
  auxiliary: string;
  /** 5. 留白区定义 — 哪些区域留空（用于HTML叠文字），百分比位置 */
  whitespace: string;
  /** 6. 装饰收尾 — 边框、印章、底部装饰 */
  decoration: string;
  /** 氛围描述 — 光线、构图角度、情绪（英文，按卡片序号变化） */
  atmosphere?: string;
  /** 负面提示词 */
  negative: string;
  /** Stage 0: 内容关系判定结果（P0新增） */
  contentRelation?: ContentAnalysis;
  /** P1新增: 信息预算安全区量化约束 */
  safetyZone?: string;
}

/**
 * P0: 内容关系分析结果
 * 描述当前卡片的内容关系类型及对应的视觉策略
 */
export interface ContentAnalysis {
  /** 内容关系类型 */
  relationType: ContentRelationType;
  /** 画面焦点描述（英文） */
  visualFocus: string;
  /** 场景情绪基调（英文） */
  sceneMood: string;
  /** 构图提示（英文） */
  compositionHint: string;
  /** 选择理由（英文，用于可解释性） */
  reason: string;
}

/** 内容关系类型（13种标准关系 + 通用） */
export type ContentRelationType =
  | 'birth'           // 新生/萌芽 — 脆弱、温暖、俯视保护
  | 'growth'          // 成长/发展 — 进取、动态、侧面视角
  | 'peak'            // 巅峰/繁盛 — 壮观、高对比、环境全景
  | 'decline'         // 衰退/衰老 — 沉稳、暮色、大远景
  | 'event'           // 历史事件 — 戏剧性、时代感、中景
  | 'action'          // 操作流程 — 清晰、指令性、特写
  | 'comparison'      // 对比分析 — 并列、平衡、对称
  | 'classification'  // 分类归纳 — 结构化、层次分明
  | 'process'         // 流程推进 — 顺序性、递进感
  | 'generic';        // 通用 — 默认策略

// ============================================================
// Part 5: 风格预设
// ============================================================

export interface StylePreset {
  id: string;
  name: string;
  nameEn: string;
  /** Prompt 风格描述（英文） */
  stylePrompt: string;
  /** 底色描述 */
  baseColor: string;
  /** 质感描述 */
  texture: string;
  /** 配色方案 */
  palette: string[];
  /** P2新增: 100% 固定约束（品牌一致性，永不改变） */
  fixedConstraints?: string;
  /** P2新增: 100% 动态插槽（根据内容关系动态填充） */
  dynamicSlots?: string[];
}

// ============================================================
// Part 6: 卡片与项目数据模型
// ============================================================

/** 卡片设计输出 — 由 vision API 分析图片后决定 */
export interface CardDesignOutput {
  /** 布局类型 */
  layout: 'left-text' | 'right-text' | 'bottom-text' | 'center-text' | 'split' | 'floating';
  /** 颜色方案 */
  colors: {
    bg: string;
    text: string;
    accent: string;
    secondary: string;
  };
  /** 完整的 HTML 卡片内容（含 Tailwind 样式） */
  html: string;
  /** 设计描述（英文，供审校展示） */
  designDescription: string;
}

/** 单张卡片的完整数据（贯穿五阶段 + 新增 Stage 4.5） */
export interface CardData {
  id: number;
  /** 阶段标题，如"01 新生期" */
  stage: string;
  /** 副标题，如"0–2周 · 破壳与依偎" */
  subtitle: string;

  // 各阶段产物
  knowledge?: KnowledgeBase;    // Stage 1
  content?: CardContent;        // Stage 2
  prompt?: VisualPrompt;        // Stage 3
  imageUrl?: string;            // Stage 4
  imageStatus?: 'pending' | 'generating' | 'done' | 'error';
  imageError?: string;
  /** Stage 4.5: AI 卡片设计（vision API 分析图片后输出） */
  design?: CardDesignOutput;
  designStatus?: 'pending' | 'generating' | 'done' | 'error';
  designError?: string;
}

/** 项目 — 一个主题下多张卡片的集合 */
export interface CardProject {
  name: string;
  topic: string;
  templateId: string;
  stylePresetId: string;
  cards: CardData[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Part 7: 工作流与状态
// ============================================================

/** 工作流阶段 */
export type WorkflowStage =
  | 'input'
  | 'generating-knowledge' | 'review-knowledge'
  | 'generating-content' | 'review-content'
  | 'generating-prompt' | 'review-prompt'
  | 'generating-image' | 'review-image'
  | 'designing-card' | 'review-design'   // Stage 4.5: AI 卡片设计
  | 'typeset' | 'done';

/** 当前激活的阶段编号（1-5） */
export type StageNumber = 1 | 2 | 3 | 4 | 4.5 | 5;

// ============================================================
// Part 8: AI 服务配置
// ============================================================

/**
 * AI 服务配置
 * 注意：API Key 由服务端代理持有，不暴露给前端
 */
export interface AIConfig {
  baseURL: string;
  textModel: string;
  imageModel: string;
  imageSize: string;
  /** 图片宽高比 */
  imageRatio?: string;
}

/** @deprecated 兼容旧引用 */
export type AIImageConfig = AIConfig;
/** @deprecated 兼容旧引用 */
export type AITextConfig = AIConfig;

// ============================================================
// Part 9: 模板配置（兼容V1 + V2扩展）
// ============================================================

/** 渲染器类型 */
export type RendererType = 'layer' | 'html' | 'knowledge' | 'lifecycle' | 'timeline' | 'process';

/** 旧版 Prompt 配置（兼容V1） */
export interface PromptConfig {
  style: string;
  subject: string;
  composition: string;
  negative: string;
  atmosphere: string;
  quality: string;
}

/** 卡片模板配置 */
export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'quick' | 'encyclopedia' | 'compare' | 'guofeng' | 'modern' | 'minimal' | 'scroll' | 'handcraft' | 'tech' | 'nature' | 'lifecycle' | 'timeline' | 'process';
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  promptTemplate: PromptConfig;
  renderer: RendererType;
  layers?: TemplateLayer[];
  htmlTemplateId?: string;
  /** V2: 模板适用的卡片数量（系列模板>1） */
  cardCount?: number;
}

export type LayerType = 'image' | 'text' | 'box' | 'tag';

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

// ============================================================
// Part 10: AI 生成结果（兼容V1）
// ============================================================

export interface AIGeneratedContent {
  title: string;
  subtitle: string;
  body: string;
  tags: string[];
  imagePrompt: string;
  summary: string;
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
  sections?: ContentSection[];
  highlights?: string[];
  chapter?: string;
}

/** @deprecated 旧工作流步骤，保留兼容 */
export type WorkflowStep = 'input' | 'generating-content' | 'review-content' | 'generating-image' | 'done';

export type GenerationStatus = 'idle' | 'generating-content' | 'generating-prompt' | 'generating-image' | 'rendering' | 'done' | 'error';

export interface GenerationResult {
  status: GenerationStatus;
  imageUrl?: string;
  error?: string;
  prompt?: string;
}
