/**
 * blocks/types.ts — 「知识积木」核心类型
 *
 * 积木拼合法（两层独立产物）：
 *  1) image  每个知识点 1 张：AI 生成的「完整模块小图」，
 *            ── 标题 / 正文 / 要点文字 + 配图都画进同一张图里（由 Agnes 生成）
 *  2) 拼合   系统按「随机节奏」把这些小图拼成一张长图（不是固定网格，有变化）
 * 视觉统一靠系列风格（同一 artStyle/palette），每个模块同风格生成自然统一。
 */

/** 模块类型：决定版式与生图提示词的构图 */
export type ModuleType =
  | 'cover' // 封面 / 大标题卡
  | 'definition' // 定义 / 概念
  | 'fact' // 事实 / 知识点
  | 'step' // 步骤 / 流程
  | 'compare' // 对比（双栏）
  | 'timeline' // 时间线节点
  | 'stat' // 数据 / 数字
  | 'quote' // 金句 / 名言
  | 'tip' // 贴士 / 注意
  | 'section'; // 分节小标题

/** 支持的宽高比（决定每张模块图的构图与大小） */
export type Ratio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '2:3' | '3:2';

/** 拼合节奏：模块在长图/面板里占据的宽度 */
export type Span = 'full' | 'half' | 'third';

/** 布局维度（与风格解耦）：决定模块图里文字与图形的空间排布骨架 */
export type Layout =
  | 'sparse' // 极简：大标题 + 一行副文，大量留白
  | 'balanced' // 平衡：标题 + 正文 + 2~3 要点，主次分明
  | 'dense' // 密集有序：标题 + 正文 + 4~5 要点紧凑网格
  | 'list' // 竖向编号清单
  | 'comparison' // 左右/上下两栏对照
  | 'flow' // 1→2→3 编号流程，箭头串联
  | 'mindmap' // 中心概念 + 放射分支
  | 'quadrant' // 2×2 四象限网格
  | 'bigNumber'; // 巨大数字 + 标签，数字即主视觉

/** 模块生成状态 */
export type ModuleStatus = 'pending' | 'generating' | 'done' | 'error';

/** 信息区文字版式类型（代码叠字风格化，对应插画风格） */
export type TextVariant = 'magazine' | 'bujo' | 'chalk' | 'riso' | 'minimal' | 'data';

/** 信息区文字版式主题：决定代码叠加标题/正文的视觉样式，与插画风格呼应 */
export interface TextTheme {
  /** 版式类型：magazine 杂志底线 / bujo 手帐便签 / chalk 黑板粉笔 / riso 复古印刷 / minimal 极简标签 / data 数据卡 */
  variant: TextVariant;
  /** 信息区背景色 */
  bg: string;
  /** 整卡容器背景色 */
  cardBg: string;
  /** 标题颜色 */
  titleColor: string;
  /** 正文颜色 */
  bodyColor: string;
  /** 要点 / 装饰强调色 */
  accent: string;
  /** 次要装饰色（底线 / 标签块） */
  deco: string;
  /** 字体栈类型 */
  font: 'sans' | 'serif' | 'kai' | 'mono';
  /** 标题是否带强调底线 */
  titleUnderline?: boolean;
  /** 标题是否带色块 / 荧光笔底色 */
  titleBlock?: boolean;
}

/** 系列风格：整套模块共享，保证视觉统一（搭积木不乱） */
export interface ModuleStyle {
  /** 艺术风格描述，例如 "扁平矢量插画" / "水彩" / "3D 黏土" */
  artStyle: string;
  /** 配色描述，例如 "暖橘 + 米白，低饱和" */
  palette: string;
  /** 氛围，例如 "温暖、治愈、明亮" */
  mood: string;
  /** 文字处理方式，例如 "粗体无衬线、高对比、清晰可读" */
  typography: string;
  /** 卡片浅色底（拼合长图时的补白色） */
  background?: string;
  /** 信息区文字版式主题（代码叠字风格化，与插画风格呼应） */
  textTheme?: TextTheme;
  /** 光照方案，例如 "柔和漫射光、无硬阴影" / "霓虹辉光、高对比色光" */
  lighting?: string;
  /** 镜头视角，例如 "微距特写、科学纪录片视角" / "戏剧性低角度" */
  camera?: string;
  /** 材质质感，例如 "水彩湿画法晕染、纸纹吸水" / "哑光黏土表面、圆润立体" */
  material?: string;
}

/** 一个知识模块（最小积木单元） */
export interface KnowledgeModule {
  id: string;
  type: ModuleType;
  /** 短标题，≤10 字，会被画进模块图 */
  title: string;
  /** 正文，≤40 字，会被画进模块图 */
  body: string;
  /** 要点列表，≤4 条，每条 ≤14 字，会被画进模块图 */
  bullets?: string[];
  /** emoji 图标（可选，画进图作为点缀） */
  icon?: string;
  /** 配图说明：这个模块的配图该画什么主体（由 LLM 生成，写进生图 prompt） */
  visualHint?: string;
  /** 该模块的宽高比 */
  ratio: Ratio;
  /** 布局骨架（决定文字/图形如何排布，与风格解耦） */
  layout: Layout;
  /** 生成状态 */
  status: ModuleStatus;
  /** AI 生成的「完整模块图」data URL（文字+配图都在图里，成功后填入） */
  image?: string;
  /** 错误信息 */
  error?: string;
  /** 排序（搭积木重排用） */
  order: number;
  /** 是否启用（关闭则不参与导出） */
  enabled: boolean;
  /** 拼合节奏：full=整行宽 / half=半宽 / third=三分之一宽 */
  span: Span;
  /** 学习扩写后的完整正文（学习页专用，默认空） */
  fullBody?: string;
  /** 学习扩写后的分层要点（学习页专用，默认空） */
  fullBullets?: string[];
  /** 学习扩写后的备注/延伸（学习页专用，默认空） */
  notes?: string;
}

/** LLM 扩写服务返回：单个模块的学习内容 */
export interface LearnModule {
  id: string;
  /** 完整正文（2-5 句话，讲透一个知识点） */
  fullBody: string;
  /** 分层要点（3-6 条，每条一句话） */
  fullBullets: string[];
  /** 备注/延伸/易错点（1-3 句话的纯文本备注） */
  notes?: string;
}

/** LLM 拆解返回的结构（不含运行时字段） */
export interface DecomposedModule {
  id: string;
  type: ModuleType;
  title: string;
  body: string;
  bullets?: string[];
  icon?: string;
  /** 配图说明：这个模块的配图该画什么主体 */
  visualHint?: string;
  ratio: Ratio;
  /** 布局骨架（决定文字/图形如何排布，与风格解耦） */
  layout: Layout;
}

/** 一张图页：多个知识模块组成的手抄报式信息图 */
export interface CardPage {
  id: string;
  /** 页标题 */
  title: string;
  /** 该页包含的模块 ID 列表 */
  moduleIds: string[];
  /** 宽高比 */
  ratio: Ratio;
  /** 该页的整体画面描述：布局结构、各模块的空间排布 */
  visualHint?: string;
}

export interface DecomposeResult {
  seriesTitle: string;
  seriesStyle: ModuleStyle;
  modules: DecomposedModule[];
  /** 按 information density 分组后的页面列表 */
  pages: CardPage[];
}
