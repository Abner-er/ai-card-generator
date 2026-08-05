import type {
  VisualPrompt,
  KnowledgeBase,
  CardContent,
  CardTemplate,
  StylePreset,
  PromptConfig,
  AIGeneratedContent,
  LifecycleStage,
  TimelineEvent,
  ProcessStepData,
  ContentAnalysis,
  ContentRelationType,
} from '../types';
import { AIPromptRewriter } from './aiPromptRewriter';

/**
 * Prompt 引擎 (V2) — 六段式纯画面 Prompt 生成
 *
 * 产品文档规范：
 * 1. 画面基调 — 视觉风格、底色、质感
 * 2. 布局骨架 — 画面分区结构（只描述形状，不写文字）
 * 3. 主视觉插画 — 核心主体详细描述
 * 4. 辅助插画 — 圆形特写、小图标、装饰元素
 * 5. 留白区定义 — 哪些区域留空，百分比位置
 * 6. 装饰收尾 — 边框、印章、底部装饰
 *
 * 关键规则：所有 prompt 中不出现任何中文文字内容
 */
export class PromptBuilder {
  // 全局 AI 改写器（懒加载模式：首次调用时初始化）
  private static rewriter: AIPromptRewriter | null = null;

  /**
   * 配置全局 AI 改写器（在 App.tsx 启动时调用一次）
   */
  static configureRewriter(config: { baseURL: string; textModel: string }) {
    this.rewriter = new AIPromptRewriter({
      baseURL: config.baseURL,
      textModel: config.textModel,
      imageModel: '',
      imageSize: '',
    });
  }

  // ============================================================
  // 视觉关键词中英文映射
  // 用于从中文正文 / 模块要点 / 特征中提取英文画面细节，
  // 保证最终 prompt 中绝不出现中文。
  // ============================================================
  private static VISUAL_KEYWORDS: Array<[string, string]> = [
    // 颜色
    ['白色', 'white'], ['黑色', 'black'], ['灰色', 'gray'], ['棕色', 'brown'],
    ['褐色', 'brown'], ['绿色', 'green'], ['黄色', 'yellow'], ['蓝色', 'blue'],
    ['红色', 'red'], ['橙色', 'orange'], ['紫色', 'purple'], ['金色', 'golden'],
    ['银色', 'silver'], ['翠绿', 'emerald green'], ['雪白', 'snow-white'],
    ['漆黑', 'jet-black'], ['灰蓝', 'grayish-blue'], ['橙黄', 'orange-yellow'],
    // 鸟类 / 动物身体部位
    ['羽毛', 'feathers'], ['绒羽', 'downy feathers'], ['飞羽', 'flight feathers'],
    ['喙', 'beak'], ['翅膀', 'wings'], ['翼', 'wings'], ['眼睛', 'eyes'],
    ['脚', 'legs'], ['爪', 'claws'], ['头部', 'head'], ['冠羽', 'crest feathers'],
    ['尾羽', 'tail feathers'], ['颈部', 'neck'], ['腹部', 'belly'], ['背部', 'back'],
    ['胸部', 'chest'], ['瞳孔', 'pupils'],
    // 植物
    ['叶片', 'leaves'], ['花瓣', 'petals'], ['花蕾', 'buds'], ['茎秆', 'stem'],
    ['根系', 'roots'], ['果实', 'fruit'], ['种子', 'seeds'], ['枝条', 'branches'],
    ['树干', 'trunk'], ['花蕊', 'stamens'], ['子叶', 'cotyledons'], ['胚根', 'radicle'],
    // 动作 / 行为
    ['飞行', 'flying'], ['觅食', 'foraging'], ['捕食', 'hunting'], ['捕鱼', 'catching fish'],
    ['筑巢', 'nesting'], ['孵化', 'hatching'], ['破壳', 'breaking out of the shell'],
    ['生长', 'growing'], ['游泳', 'swimming'], ['站立', 'standing'], ['行走', 'walking'],
    ['奔跑', 'running'], ['鸣叫', 'calling'], ['展翅', 'spreading wings'],
    ['梳理羽毛', 'preening feathers'], ['休息', 'resting'], ['伺猎', 'stalking prey'],
    ['喂食', 'feeding'], ['栖息', 'perching'], ['潜水', 'diving'], ['攀爬', 'climbing'],
    ['开花', 'blooming'], ['结果', 'bearing fruit'], ['发芽', 'sprouting'],
    ['绽放', 'blossoming'], ['凋谢', 'wilting'], ['授粉', 'pollinating'],
    ['求偶', 'courtship display'], ['展翅高飞', 'soaring with spread wings'],
    // 形态 / 状态
    ['幼小', 'small and young'], ['稚嫩', 'tender and delicate'], ['成熟', 'mature'],
    ['庞大', 'large'], ['纤细', 'slender'], ['丰满', 'plump and full'],
    ['轻盈', 'lightweight'], ['健壮', 'sturdy'], ['柔弱', 'fragile'],
    ['稀疏', 'sparse'], ['浓密', 'dense'], ['光滑', 'smooth'], ['粗糙', 'rough'],
    ['柔软', 'soft'], ['坚硬', 'hard'], ['鲜艳', 'vividly colored'], ['暗淡', 'muted'],
    ['斑驳', 'mottled'], ['匀称', 'well-proportioned'],
    // 环境
    ['森林', 'forest'], ['湿地', 'wetland'], ['草地', 'grassland'], ['河边', 'riverside'],
    ['湖泊', 'lake'], ['池塘', 'pond'], ['芦苇', 'reeds'], ['泥滩', 'mudflat'],
    ['天空', 'sky'], ['岩石', 'rocks'], ['土壤', 'soil'], ['阳光', 'sunlight'],
    ['月光', 'moonlight'], ['晨露', 'morning dew'], ['雾', 'mist'], ['雨水', 'rain'],
    // 通用生命体阶段
    ['幼鸟', 'young bird'], ['成鸟', 'adult bird'], ['雏鸟', 'chick'],
    ['幼体', 'juvenile'], ['成体', 'adult'], ['幼虫', 'larva'],
  ];

  /**
   * Stage 0 + Stage 3: 内容关系判定 + 六段式纯画面 Prompt 生成
   *
   * P0 改进：先分析内容关系（Stage 0），再构建 prompt
   * - 新生期 → 脆弱、温暖、俯视保护
   * - 成长期 → 进取、动态、侧面视角
   * - 巅峰期 → 壮观、高对比、环境全景
   * - 衰退期 → 沉稳、暮色、大远景
   * 而不是简单地按 cardIndex 轮转
   */
  static buildVisualPrompt(
    knowledge: KnowledgeBase,
    content: CardContent,
    template: CardTemplate,
    stylePreset: StylePreset,
    cardIndex: number = 0,
  ): VisualPrompt {
    const englishTopic = knowledge.englishTopic || this.translateTopic(knowledge.topic);
    const templateId = template.htmlTemplateId || template.id;

    // 提取当前阶段名称（用于辅助元素智能判断）
    const stageName = this.getCurrentStageName(knowledge, content, templateId, cardIndex);

    // P0: Stage 0 — 内容关系判定
    const contentAnalysis = this.analyzeContentRelation(knowledge, content, templateId, cardIndex);

    return {
      style: this.buildStyle(stylePreset),
      layout: this.buildLayout(templateId, cardIndex, contentAnalysis),
      mainVisual: this.buildMainVisual(englishTopic, knowledge, content, templateId, cardIndex, contentAnalysis),
      auxiliary: this.buildAuxiliary(templateId, knowledge, cardIndex, stageName, contentAnalysis),
      whitespace: this.buildWhitespace(templateId),
      safetyZone: this.buildSafetyZone(templateId, contentAnalysis),
      decoration: this.buildDecoration(stylePreset, templateId),
      atmosphere: this.buildAtmosphere(templateId, cardIndex, contentAnalysis),
      negative: this.getNegativePrompt(),
      contentRelation: contentAnalysis,
    };
  }

  /** 获取当前阶段的名称（中文 + 英文），用于辅助元素智能判断 */
  private static getCurrentStageName(
    knowledge: KnowledgeBase,
    content: CardContent,
    templateId: string,
    cardIndex: number,
  ): string {
    if (templateId === 'lifecycle' && knowledge.lifecycleStages) {
      const idx = parseInt(content.topicNumber || String(cardIndex + 1)) - 1;
      const stage = knowledge.lifecycleStages[idx] || knowledge.lifecycleStages[0];
      if (stage) return stage.name || '';
    }
    if (templateId === 'timeline' && knowledge.timelineEvents) {
      const idx = parseInt(content.topicNumber || String(cardIndex + 1)) - 1;
      const event = knowledge.timelineEvents[idx] || knowledge.timelineEvents[0];
      if (event) return event.title || '';
    }
    if (templateId === 'process' && knowledge.processSteps) {
      const idx = parseInt(content.topicNumber || String(cardIndex + 1)) - 1;
      const step = knowledge.processSteps[idx] || knowledge.processSteps[0];
      if (step) return step.title || '';
    }
    return '';
  }

  // ============================================================
  // P0: Stage 0 — 内容关系判定（核心新增）
  // ============================================================

  /**
   * 判定当前卡片的内容关系类型，返回视觉策略分析
   * 这是 P0 的核心改进：不再简单按 cardIndex 轮转，
   * 而是先理解"这张卡片的内容是什么关系"，再决定 prompt 策略
   */
  private static analyzeContentRelation(
    knowledge: KnowledgeBase,
    content: CardContent,
    templateId: string,
    cardIndex: number,
  ): ContentAnalysis {
    const stageName = this.getCurrentStageName(knowledge, content, templateId, cardIndex);
    const lowerName = stageName.toLowerCase();
    const totalCards = knowledge.lifecycleStages?.length || knowledge.timelineEvents?.length || knowledge.processSteps?.length || 1;
    const ratio = totalCards > 1 ? cardIndex / (totalCards - 1) : 0.5; // 0=第一张, 1=最后一张

    // lifecycle 模板：根据阶段名称判定关系类型
    if (templateId === 'lifecycle' && knowledge.lifecycleStages) {
      return this.analyzeLifecycleRelation(lowerName, ratio, stageName, cardIndex, totalCards);
    }

    // timeline 模板：根据事件在时间线中的位置判定
    if (templateId === 'timeline' && knowledge.timelineEvents) {
      return this.analyzeTimelineRelation(lowerName, ratio, stageName, cardIndex);
    }

    // process 模板：根据步骤位置判定
    if (templateId === 'process' && knowledge.processSteps) {
      return this.analyzeProcessRelation(ratio, stageName, cardIndex);
    }

    // compare-card 模板
    if (templateId === 'compare-card') {
      return {
        relationType: 'comparison',
        visualFocus: 'balanced dual subjects in a comparative layout',
        sceneMood: 'neutral analytical mood, clear visual distinction between two subjects',
        compositionHint: 'symmetrical or split composition with equal visual weight on both sides',
        reason: '对比模板需要平衡构图，两个主体视觉权重均等，便于读者直观比较',
      };
    }

    // 默认通用策略
    return this.analyzeGenericRelation(lowerName, stageName);
  }

  /** lifecycle 模板关系分析 */
  private static analyzeLifecycleRelation(
    lowerName: string,
    ratio: number,
    stageName: string,
    cardIndex: number,
    totalCards: number,
  ): ContentAnalysis {
    // 新生/萌芽阶段
    if (lowerName.includes('新生') || lowerName.includes('萌芽') || lowerName.includes('胚胎') ||
        lowerName.includes('seed') || lowerName.includes('egg') || lowerName.includes('neonatal')) {
      return {
        relationType: 'birth',
        visualFocus: 'a fragile newly emerged subject, small and tender, resting or huddling',
        sceneMood: 'soft dawn light, gentle pink and pale blue tones, dewdrops glistening, serene and tender mood conveying birth and fragility',
        compositionHint: 'top-down protective viewpoint, subject nestled in its safe environment, intimate close framing',
        reason: `阶段"${stageName}"是生命/事物的起始点，画面需要传达脆弱、温暖和保护的视觉语言，俯视角度营造安全感`,
      };
    }

    // 成长/发展阶段
    if (lowerName.includes('成长') || lowerName.includes('发育') || lowerName.includes('幼鸟') ||
        lowerName.includes('雏鸟') || lowerName.includes('幼苗') || lowerName.includes('生长') ||
        lowerName.includes('juvenile') || lowerName.includes('nestling') || lowerName.includes('growing')) {
      return {
        relationType: 'growth',
        visualFocus: 'an active growing subject exploring its surroundings, energetic posture',
        sceneMood: 'morning light with warm golden rays filtering through, fresh and energetic mood, sense of growth and vitality',
        compositionHint: 'side profile or three-quarter view showing forward movement, dynamic pose',
        reason: `阶段"${stageName}"是成长和探索期，画面需要传达进取、动态和生命力的视觉语言，侧面视角展现探索姿态`,
      };
    }

    // 巅峰/繁盛阶段
    if (lowerName.includes('成鸟') || lowerName.includes('成体') || lowerName.includes('成熟') ||
        lowerName.includes('盛期') || lowerName.includes('繁荣') || lowerName.includes('peak') ||
        lowerName.includes('adult') || lowerName.includes('mature') || lowerName.includes('breeding')) {
      return {
        relationType: 'peak',
        visualFocus: 'a fully developed subject at its prime, displaying characteristic behavior with confidence',
        sceneMood: 'golden afternoon light with rich amber tones, dramatic and majestic mood, peak vitality',
        compositionHint: 'wide habitat viewpoint showing the subject in its full environment, environmental portrait',
        reason: `阶段"${stageName}"是巅峰期，画面需要传达壮观、自信和成熟的视觉语言，环境全景展现其在自然栖息地中的完整状态`,
      };
    }

    // 衰退/衰老阶段
    if (lowerName.includes('衰老') || lowerName.includes('衰退') || lowerName.includes('老年') ||
        lowerName.includes('senile') || lowerName.includes('elderly') || lowerName.includes('decline') ||
        lowerName.includes('wither')) {
      return {
        relationType: 'decline',
        visualFocus: 'a seasoned subject moving with quiet dignity, calm and contemplative posture',
        sceneMood: 'cool twilight with muted blue and lavender tones, tranquil and reflective mood, soft diffused light',
        compositionHint: 'distant environmental viewpoint, subject in a wide habitat context, sense of quiet落幕',
        reason: `阶段"${stageName}"是衰退期，画面需要传达沉稳、宁静和反思的视觉语言，大远景营造岁月的沉淀感`,
      };
    }

    // 通过 ratio 兜底判定（适用于无法精确匹配名称的阶段）
    if (ratio < 0.25) {
      return {
        relationType: 'birth',
        visualFocus: 'a fragile early-stage subject, small and tender',
        sceneMood: 'soft dawn light, gentle and tender mood, protective atmosphere',
        compositionHint: 'top-down protective viewpoint, intimate framing',
        reason: `早期阶段（第${cardIndex + 1}/${totalCards}张），内容处于萌芽/新生状态，需要温暖保护的视觉语言`,
      };
    }
    if (ratio > 0.75) {
      return {
        relationType: 'decline',
        visualFocus: 'a seasoned subject with quiet dignity',
        sceneMood: 'cool twilight with muted tones, tranquil and reflective mood',
        compositionHint: 'wide environmental viewpoint, distant perspective',
        reason: `后期阶段（第${cardIndex + 1}/${totalCards}张），内容处于成熟/衰退状态，需要沉稳反思的视觉语言`,
      };
    }
    if (ratio > 0.4 && ratio <= 0.6) {
      return {
        relationType: 'peak',
        visualFocus: 'a fully developed subject at peak vitality',
        sceneMood: 'golden light with rich warm tones, energetic and confident mood',
        compositionHint: 'wide habitat viewpoint, subject prominently displayed',
        reason: `中期阶段（第${cardIndex + 1}/${totalCards}张），内容处于发展/繁盛状态，需要充满活力的视觉语言`,
      };
    }

    // 默认
    return {
      relationType: 'growth',
      visualFocus: 'an active subject in a natural pose',
      sceneMood: 'bright natural lighting, balanced and vibrant mood',
      compositionHint: 'three-quarter view showing depth and context',
      reason: `阶段"${stageName}"为通用成长阶段，采用平衡的构图策略`,
    };
  }

  /** timeline 模板关系分析 */
  private static analyzeTimelineRelation(
    lowerName: string,
    ratio: number,
    stageName: string,
    cardIndex: number,
  ): ContentAnalysis {
    if (ratio < 0.25) {
      return {
        relationType: 'event',
        visualFocus: 'the origins and founding moment of this historical topic',
        sceneMood: 'dawn light over an ancient landscape, solemn origins mood, wide establishing viewpoint',
        compositionHint: 'wide establishing shot showing the historical context and setting',
        reason: `时间线开端（第${cardIndex + 1}张），展示起源和初始时刻，需要庄重宏大的历史氛围`,
      };
    }
    if (ratio > 0.75) {
      return {
        relationType: 'event',
        visualFocus: 'the legacy and reflective conclusion of this historical topic',
        sceneMood: 'cool twilight, reflective legacy mood, distant retrospective viewpoint',
        compositionHint: 'distant panoramic viewpoint showing the long-term impact',
        reason: `时间线尾声（第${cardIndex + 1}张），展示影响和回顾，需要深沉反思的历史氛围`,
      };
    }
    return {
      relationType: 'event',
      visualFocus: 'a pivotal historical moment with dramatic significance',
      sceneMood: 'bright daylight, vibrant and prosperous mood, bustling scene viewpoint',
      compositionHint: 'mid-range viewpoint showing both the event and its context',
      reason: `时间线中段（第${cardIndex + 1}张），展示发展过程中的关键事件，需要清晰有力的叙事氛围`,
    };
  }

  /** process 模板关系分析 */
  private static analyzeProcessRelation(
    ratio: number,
    stageName: string,
    cardIndex: number,
  ): ContentAnalysis {
    if (ratio < 0.25) {
      return {
        relationType: 'action',
        visualFocus: 'the preparation and initial setup phase',
        sceneMood: 'clean bright starting light, fresh and anticipatory mood, overhead preparation viewpoint',
        compositionHint: 'overhead or close-up action viewpoint showing the preparation steps',
        reason: `流程第一步（第${cardIndex + 1}张），展示准备阶段，需要清晰指令性的视觉语言`,
      };
    }
    if (ratio > 0.75) {
      return {
        relationType: 'action',
        visualFocus: 'the final completion and showcase phase',
        sceneMood: 'gentle showcase light, proud and finished mood, presentation viewpoint',
        compositionHint: 'wide presentation viewpoint showing the completed result',
        reason: `流程最后一步（第${cardIndex + 1}张），展示完成状态，需要成就感的视觉语言`,
      };
    }
    return {
      relationType: 'process',
      visualFocus: 'an active transformation or construction phase',
      sceneMood: 'warm building light, energetic and constructive mood, three-quarter viewpoint',
      compositionHint: 'three-quarter view showing the action in progress with clear context',
      reason: `流程中段（第${cardIndex + 1}张），展示执行过程中的关键动作，需要清晰的操作指示性视觉语言`,
    };
  }

  /** 通用关系分析 */
  private static analyzeGenericRelation(lowerName: string, stageName: string): ContentAnalysis {
    if (lowerName.includes('对比') || lowerName.includes('compare') || lowerName.includes('difference')) {
      return {
        relationType: 'comparison',
        visualFocus: 'two distinct subjects presented side by side for clear comparison',
        sceneMood: 'balanced neutral lighting, analytical mood, symmetrical composition',
        compositionHint: 'split or dual composition with equal visual weight',
        reason: `内容涉及对比关系，需要平衡对称的构图策略`,
      };
    }
    return {
      relationType: 'generic',
      visualFocus: `a single subject representing ${stageName || 'the topic'}`,
      sceneMood: 'soft natural lighting, gentle and balanced mood, eye-level viewpoint',
      compositionHint: 'three-quarter view with natural habitat context',
      reason: `通用策略，采用平衡中性的构图方式`,
    };
  }

  /**
   * P1: 信息预算安全区 — 量化文字叠加区域的约束
   * 确保 AI 生成图的留白区域与 HTML 排版精确匹配
   */
  private static buildSafetyZone(templateId: string, analysis: ContentAnalysis): string {
    const zones: Record<string, string> = {
      lifecycle: 'text safety zone: bottom 15% of canvas, min 18pt font readable, 8% margin all sides, gradient overlay only at very bottom edge',
      timeline: 'text safety zone: right 30% of canvas, min 16pt font readable, 10% padding, vertical reading flow',
      process: 'text safety zone: bottom 20% strips at each step transition, min 16pt font, 8% margin',
      'quick-knowledge': 'text safety zone: bottom 25% of canvas, min 18pt font readable, high contrast overlay',
      encyclopedia: 'text safety zone: right 35% of canvas, min 16pt font, overlay should not obscure main illustration',
      'compare-card': 'text safety zone: bottom 35% with card-shaped overlays, min 16pt font, structured layout',
    };
    return zones[templateId] || 'text safety zone: bottom 20% of canvas, min 16pt font readable, 8% margin all sides';
  }

  /**
   * 异步版本的 buildVisualPrompt：在同步模板的基础上，
   * 调用大模型改写 mainVisual 和 auxiliary 字段，
   * 让 prompt 与当前阶段内容高度匹配，避免阶段冲突元素。
   *
   * 失败时自动 fallback 到同步版本。
   */
  static async buildVisualPromptAsync(
    knowledge: KnowledgeBase,
    content: CardContent,
    template: CardTemplate,
    stylePreset: StylePreset,
    cardIndex: number,
    cardTotal: number,
  ): Promise<VisualPrompt> {
    // 1. 先用同步模板生成基础 prompt
    const base = this.buildVisualPrompt(knowledge, content, template, stylePreset, cardIndex);

    // 2. 如果没有配置 rewriter 或非系列模板，直接返回基础版
    if (!this.rewriter) return base;

    // 3. 调用大模型改写（P3: 保留 reason 和 visualFocus）
    try {
      const rewritten = await this.rewriter.rewrite(knowledge, content, cardIndex, cardTotal);
      if (rewritten) {
        return {
          ...base,
          mainVisual: rewritten.mainVisual || base.mainVisual,
          auxiliary: rewritten.auxiliary || base.auxiliary,
          contentRelation: base.contentRelation
            ? {
                ...base.contentRelation,
                reason: rewritten.reason,
              }
            : undefined,
        };
      }
    } catch (err) {
      console.warn('[PromptBuilder] AI rewrite failed, using template prompt:', err);
    }

    // 4. fallback：返回同步版本
    return base;
  }

  /**
   * 将六段式 Prompt 合并为完整的图片生成提示词字符串
   * 仅保留需要生成的部分，负面提示词已全部去除
   */
  static toPromptString(vp: VisualPrompt): string {
    const parts: string[] = [
      vp.style,
      vp.layout,
      `Main visual: ${vp.mainVisual}`,
    ];
    if (vp.atmosphere) parts.push(`Atmosphere: ${vp.atmosphere}`);
    parts.push(
      `Auxiliary elements: ${vp.auxiliary}`,
      `Whitespace zones: ${vp.whitespace}`,
      `Decoration: ${vp.decoration}`,
    );
    // P1: 信息预算安全区
    if (vp.safetyZone) parts.push(`Safety zone: ${vp.safetyZone}`);
    // 仅返回生成所需的正向提示词，不包含任何负面提示词
    return parts.join('. ');
  }

  // ============================================================
  // 六段构建方法
  // ============================================================

  /** 1. 画面基调 */
  private static buildStyle(preset: StylePreset): string {
    // 所有风格都附加现实感约束，防止卡通化或塑料感导致的解剖失真
    const realismConstraint = 'realistic proportions, natural anatomy, no stylized distortion of body parts';
    return `${preset.stylePrompt}, base color ${preset.baseColor}, ${preset.texture}, ${realismConstraint}`;
  }

  /** 2. 布局骨架 — 只描述形状和位置，不写文字；按 cardIndex 微调构图视角，融合内容关系分析 */
  private static buildLayout(templateId: string, cardIndex: number = 0, analysis?: ContentAnalysis): string {
    // 通用解剖学正确约束：明确指定正常生物结构，防止AI生成畸形
    const anatomyConstraint = 'single subject with exactly one head, correct number of limbs, natural body proportions, realistic anatomy, no body part duplication';

    const layouts: Record<string, string> = {
      // 生命周期：单主体占主导，圆形框只放局部特写（羽毛/眼睛/喙），绝不放第二只完整动物
      lifecycle: `full-bleed vertical illustration filling the entire canvas, ONE single main animal as the sole subject occupying 70% of the frame, ${anatomyConstraint}, a small circular inset in the upper-left corner showing only a partial close-up detail (feather texture, eye, or beak tip), botanical and environmental elements as secondary decoration, the composition is rich and fills all corners with no large empty areas, no other complete animals in the scene`,
      timeline: `full-bleed vertical illustration, a single central scene depicting one key moment, environmental details fill the background, small decorative symbolic elements only, ${anatomyConstraint}, no duplicate subjects, no crowd scenes`,
      process: `full-bleed vertical illustration, a single main subject shown in one clear action or state, environmental context throughout, no sequential panels, no multiple copies of the same subject, ${anatomyConstraint}, one animal only`,
      'quick-knowledge': `full-bleed vertical illustration filling the entire canvas, ONE single main subject large and centered occupying 65% of the frame, ${anatomyConstraint}, surrounded by decorative elements and natural textures, rich detail throughout with no empty zones, only one instance of the subject`,
      encyclopedia: `full-bleed vertical illustration on the left 60% with rich detail filling edge to edge, ONE single subject depicted with ${anatomyConstraint}, the right 40% has a subtle lighter overlay zone for text readability`,
      'compare-card': `full-bleed vertical illustration filling the top 60% with one single subject in a natural setting, ${anatomyConstraint}, the bottom 40% has subtle decorative zones, no duplicate subjects, one animal only`,
    };
    const base = layouts[templateId] || `full-bleed vertical illustration filling the entire canvas, ONE single main subject large and prominent, ${anatomyConstraint}, rich details throughout, no large empty areas, no duplicate or repeated subjects`;

    // P0: 融合内容关系分析的构图提示
    const compositionHint = analysis?.compositionHint
      ? `, ${analysis.compositionHint}`
      : '';

    // 按卡片序号微调构图视角
    const angleVariations = [
      'framed from a slightly elevated top-down angle',
      'framed as a clean side profile',
      'framed in a three-quarter view showing depth',
      'framed as a wide habitat perspective',
      'framed as a close-up action shot',
      'framed as an environmental portrait',
    ];
    const angle = angleVariations[cardIndex % angleVariations.length];
    return `${base}${compositionHint}, ${angle}`;
  }

  /** 3. 主视觉插画 — 核心主体描述，融合内容正文与模块要点的可视细节 */
  private static buildMainVisual(
    englishTopic: string,
    knowledge: KnowledgeBase,
    content: CardContent,
    templateId: string,
    cardIndex: number = 0,
    analysis?: ContentAnalysis,
  ): string {
    const stageHint = content.chapter || content.episode || '';

    if (templateId === 'lifecycle' && knowledge.lifecycleStages) {
      // 找到当前阶段
      const stageIdx = parseInt(content.topicNumber || '1') - 1;
      const stage = knowledge.lifecycleStages[stageIdx] || knowledge.lifecycleStages[0];
      return this.describeLifecycleStage(englishTopic, stage, content, cardIndex);
    }

    if (templateId === 'timeline' && knowledge.timelineEvents) {
      const stageIdx = parseInt(content.topicNumber || '1') - 1;
      const event = knowledge.timelineEvents[stageIdx] || knowledge.timelineEvents[0];
      return this.describeTimelineEvent(englishTopic, event, content);
    }

    if (templateId === 'process' && knowledge.processSteps) {
      const stageIdx = parseInt(content.topicNumber || '1') - 1;
      const step = knowledge.processSteps[stageIdx] || knowledge.processSteps[0];
      return this.describeProcessStep(englishTopic, step, content);
    }

    // 通用主视觉：融合正文与模块要点的可视细节，强调单主体 + 解剖学正确
    const contentDetails = this.extractContentVisualDetails(content);
    return `detailed realistic illustration of one single ${englishTopic}${stageHint ? ` in its ${stageHint} phase` : ''}${contentDetails ? `, depicting ${contentDetails}` : ''}, photorealistic anatomy with exactly one head, natural correct number of legs and wings, properly connected body parts, natural realistic pose, no extra or missing limbs, scientifically accurate, vibrant natural colors, the main subject occupies the center of the frame, only one animal depicted, no duplicated body parts`;
  }

  /** 4. 辅助插画 — 圆形特写、小图标、装饰元素；按 cardIndex 微调特写细节 */
  private static buildAuxiliary(
    templateId: string,
    knowledge: KnowledgeBase,
    cardIndex: number = 0,
    stageName: string = '',
    analysis?: ContentAnalysis,
  ): string {
    const englishTopic = knowledge.englishTopic || this.translateTopic(knowledge.topic);

    // 按 cardIndex 轮换特写细节 —— 必须是局部特征，绝不能是完整动物
    const lifecycleDetails = [
      'a patch of downy feather texture',
      'a single wing feather detail',
      'a close-up of the beak and eye area',
      'a section of adult plumage pattern',
      'a detailed eye with surrounding feathers',
      'a single tail feather or crest feather detail',
    ];

    if (templateId === 'lifecycle') {
      const detail = lifecycleDetails[cardIndex % lifecycleDetails.length];

      // === 智能辅助元素：根据当前阶段名称选择合适的装饰，绝不出现与阶段冲突的元素 ===
      // 阶段判断逻辑：
      //   卵/蛋/seed/egg 类 → 可以有蛋
      //   幼体/幼虫/juvenile/larva/nymph 类 → 不能有蛋，不能有成年器官
      //   成虫/成体/adult 类 → 绝不能有蛋（避免知了成虫里出现蛋的尴尬）
      //   老年/衰老/elderly 类 → 可有落叶、枯枝等
      //   通用/未知 → 仅环境元素，不放可能与阶段冲突的内容
      const lower = stageName.toLowerCase();
      const stageDecorations: string[] = [];

      const isEggStage = lower.includes('卵') || lower.includes('蛋') ||
        lower.includes('seed') || lower.includes('egg') || lower.includes('embryo');
      const isLarvaStage = lower.includes('若虫') || lower.includes('幼虫') || lower.includes('幼体') ||
        lower.includes('larva') || lower.includes('nymph') || lower.includes('juvenile') || lower.includes('pupa');
      const isAdultStage = lower.includes('成虫') || lower.includes('成体') || lower.includes('成鸟') ||
        lower.includes('adult') || lower.includes('mature');
      const isOldStage = lower.includes('老年') || lower.includes('衰老') || lower.includes('elderly') ||
        lower.includes('senile') || lower.includes('old age');

      if (isEggStage) {
        stageDecorations.push('a small egg cluster decoration');
        stageDecorations.push('subtle nest texture in a corner');
      } else if (isLarvaStage) {
        stageDecorations.push('2-3 small leaf icons in corners');
        stageDecorations.push('subtle soil or bark texture in a corner');
      } else if (isAdultStage) {
        stageDecorations.push('2-3 small flower or branch icons in corners');
        stageDecorations.push('subtle habitat texture like bark or leaves in a corner');
      } else if (isOldStage) {
        stageDecorations.push('a few falling leaf icons in corners');
        stageDecorations.push('subtle withered branch texture in a corner');
      } else {
        // 未知阶段：仅放安全的环境元素，绝不出现蛋/成虫器官等冲突内容
        stageDecorations.push('2-3 small leaf or branch icons in corners');
        stageDecorations.push('subtle natural habitat texture in a corner');
      }

      return `a small circular inset showing only ${detail} of ${englishTopic} (partial detail only, not a complete animal), ${stageDecorations.join(', ')}, no second animal in the circular frame, no eggs (unless this is the egg stage), no juvenile features (unless this is the juvenile stage), no adult organs (unless this is the adult stage)`;
    }
    if (templateId === 'timeline') {
      return `small circular icons at each timeline node representing key events, decorative scroll or banner elements, 2-3 small cultural motif icons`;
    }
    if (templateId === 'process') {
      return `small numbered circle badges (blank, no text) at each step, arrow connectors between steps, 2-3 small tool or gear icons as decoration`;
    }
    if (templateId === 'compare-card') {
      return `small badge circles at top of each column, checkmark and cross icons as decorative elements, balance scale icon`;
    }
    return `2-3 small decorative icons related to ${englishTopic}, a circular detail frame showing a close-up feature, subtle corner ornaments`;
  }

  /** 5. 留白区定义 — 仅保留文字叠加必需的最小留白 */
  private static buildWhitespace(templateId: string): string {
    const zones: Record<string, string> = {
      lifecycle: 'keep the illustration filling the full canvas; only maintain a subtle lighter gradient at the very bottom 15% for text readability, do NOT leave large blank areas anywhere',
      timeline: 'keep the illustration filling the full canvas; only maintain subtle lighter zones beside each timeline node for text readability, do NOT leave large blank areas',
      process: 'keep the illustration filling the full canvas; only maintain subtle lighter gradient strips at each step transition for text readability, do NOT leave large blank areas',
      'quick-knowledge': 'keep the illustration filling the full canvas; only maintain a subtle lighter overlay at the bottom 25% for text readability, do NOT leave large blank areas',
      encyclopedia: 'keep the illustration filling the full canvas; only maintain a subtle lighter overlay on the right 35% for text readability, illustration should still be visible behind it',
      'compare-card': 'keep the illustration filling the full canvas; only maintain subtle lighter card-shaped overlays at the bottom 35% for text readability, do NOT leave large blank areas',
    };
    return zones[templateId] || 'keep the illustration filling the full canvas; only maintain a subtle lighter gradient at the bottom 20% for text readability, do NOT leave large blank areas';
  }

  /** 6. 装饰收尾 */
  private static buildDecoration(preset: StylePreset, templateId: string): string {
    const baseDecorations: Record<string, string> = {
      'watercolor-nature': 'soft watercolor edge bleeding, delicate botanical line borders, a small circular seal stamp in bottom-right corner',
      'clay-art': 'rounded clay texture edges, small clay flower or star ornaments, soft shadow underlay',
      'cyberpunk-neon': 'glowing neon border lines, circuit pattern corners, subtle scanline overlay',
      'minimal-flat': 'clean thin border lines, minimal geometric corner accents, subtle gradient overlay at edges',
      'chinese-ink': 'traditional Chinese seal stamp in red at bottom-right, ink wash border decoration, subtle rice paper texture overlay',
    };

    const decoration = baseDecorations[preset.id] || 'subtle decorative border, corner ornaments, clean frame edges';
    const templateExtra = templateId === 'lifecycle' ? ', a small decorative banner at the very bottom' : '';
    return `${decoration}${templateExtra}, high quality, 8K, masterpiece, detailed, professional illustration`;
  }

  // ============================================================
  // 氛围与构图（按卡片序号变化，使每张卡片氛围各异）
  // ============================================================

  /** 按模板、卡片序号和内容关系分析返回阶段专属的氛围 / 光线 / 构图角度 */
  private static buildAtmosphere(templateId: string, cardIndex: number, analysis?: ContentAnalysis): string {
    // P0: 优先使用内容关系分析中的氛围描述
    if (analysis?.sceneMood) {
      return analysis.sceneMood;
    }

    // Fallback: 按卡片序号轮转（原有逻辑）
    if (templateId === 'lifecycle') {
      const atmospheres = [
        'soft dawn light with gentle pink and pale blue sky, dewdrops glistening, serene and tender mood conveying birth and fragility, top-down protective viewpoint',
        'morning light with warm golden rays filtering through, fresh and energetic mood, side profile viewpoint, crisp clean shadows, sense of growth and vitality',
        'bright midday sunlight, vivid saturated colors, energetic and curious mood, three-quarter viewpoint, dynamic lively atmosphere',
        'golden afternoon light with long soft shadows, calm and confident mood, wide habitat viewpoint, warm amber tones, sense of maturity',
        'warm sunset glow with orange and magenta hues, dramatic and majestic mood, environmental portrait viewpoint, rich golden rim light, peak vitality',
        'cool twilight with muted blue and lavender tones, tranquil and reflective mood, soft diffused light, gentle and dignified atmosphere',
      ];
      return atmospheres[cardIndex % atmospheres.length];
    }

    if (templateId === 'timeline') {
      const atmospheres = [
        'dawn light over an ancient landscape, solemn origins mood, wide establishing viewpoint',
        'rising morning light, hopeful and progressive mood, mid-range viewpoint',
        'bright daylight, vibrant and prosperous mood, bustling scene viewpoint',
        'golden afternoon light, reflective and transitional mood, panoramic viewpoint',
        'warm sunset light, dramatic and climactic mood, focused viewpoint',
        'cool twilight, reflective legacy mood, distant retrospective viewpoint',
      ];
      return atmospheres[cardIndex % atmospheres.length];
    }

    if (templateId === 'process') {
      const atmospheres = [
        'clean bright starting light, fresh and anticipatory mood, overhead preparation viewpoint',
        'clear working light, focused and active mood, close-up action viewpoint',
        'warm building light, energetic and constructive mood, three-quarter viewpoint',
        'golden refining light, attentive and refining mood, side viewpoint',
        'soft completion light, satisfying and accomplished mood, wide viewpoint',
        'gentle showcase light, proud and finished mood, presentation viewpoint',
      ];
      return atmospheres[cardIndex % atmospheres.length];
    }

    // 通用：按序号轮换光线 / 情绪 / 视角
    const generic = [
      'soft natural lighting, gentle and balanced mood, eye-level viewpoint',
      'warm directional light, energetic mood, slight high-angle viewpoint',
      'bright even lighting, vibrant mood, three-quarter viewpoint',
      'golden hour light, calm mood, wide environmental viewpoint',
      'dramatic side lighting, intense mood, close-up viewpoint',
      'soft diffused light, serene mood, low-angle viewpoint',
    ];
    return generic[cardIndex % generic.length];
  }

  // ============================================================
  // 模板专用描述方法
  // ============================================================

  private static describeLifecycleStage(
    topic: string,
    stage: LifecycleStage,
    content: CardContent,
    cardIndex: number,
  ): string {
    // 阶段名称翻译为英文（未知阶段回退为通用英文，绝不泄露中文）
    const stageName = this.translateStageName(stage.name);
    // 特征翻译为英文（未知特征返回通用英文，绝不泄露中文）
    const featureDesc = (stage.features.length > 0
      ? stage.features.map(f => this.translateFeature(f))
      : []
    ).join(', ');

    // 从正文与模块要点中提取额外的可视细节（英文）
    const contentDetails = this.extractContentVisualDetails(content);

    // 该阶段主体正在做什么（按 cardIndex 变化）
    const behaviors = [
      'newly emerged and resting quietly in the nest',
      'growing and beginning to explore its surroundings',
      'actively exploring and practicing new skills',
      'fully developed and moving with confidence',
      'at peak vitality, displaying mature characteristic behavior',
      'calm and seasoned, moving with quiet dignity',
    ];
    const behavior = behaviors[cardIndex % behaviors.length];

    const parts: string[] = [`realistic illustration of ONE SINGLE ${topic} in its ${stageName} life stage`];
    if (featureDesc) parts.push(`showing observable features such as ${featureDesc}`);
    if (contentDetails) parts.push(`with visual details including ${contentDetails}`);
    parts.push(behavior);
    parts.push('photorealistic anatomy with exactly one head, correct number of legs and wings, properly connected body parts, natural realistic proportions, no extra or duplicated limbs');
    parts.push('natural habitat background, the ONE subject is the sole focal point in a dynamic natural pose, scientifically accurate depiction, no other animals, no cloned or repeated subjects');
    return parts.join(', ');
  }

  private static describeTimelineEvent(
    topic: string,
    event: TimelineEvent,
    content: CardContent,
  ): string {
    const contentDetails = this.extractContentVisualDetails(content);
    const parts: string[] = [
      `realistic historical scene illustration depicting one key event from the topic of ${topic}`,
      'set in the appropriate historical period',
      'anatomically correct human figures with exactly one head per person, proper number of limbs, natural body proportions, no extra or duplicated body parts',
    ];
    if (contentDetails) parts.push(`with scene details including ${contentDetails}`);
    parts.push('dramatic lighting, atmospheric environment, characters and setting rendered in period-accurate detail, no cloned or repeated figures');
    return parts.join(', ');
  }

  private static describeProcessStep(
    topic: string,
    step: ProcessStepData,
    content: CardContent,
  ): string {
    const contentDetails = this.extractContentVisualDetails(content);
    const parts: string[] = [
      `realistic illustration showing one clear stage in the process of ${topic}`,
      'clear action depiction, focused on the key action or transformation',
      'anatomically correct subject with exactly one head, proper number of limbs, natural body structure and proportions, no extra or duplicated body parts',
    ];
    if (contentDetails) parts.push(`with visible details including ${contentDetails}`);
    parts.push('instructional clarity, clean background, one subject only, no cloned or repeated subjects');
    return parts.join(', ');
  }

  // ============================================================
  // 内容可视细节提取（将中文正文 / 要点转为英文画面细节，绝不泄露中文）
  // ============================================================

  /** 从 content.body 与 content.modules 要点中提取英文可视细节短语 */
  private static extractContentVisualDetails(content: CardContent): string {
    const keywords = new Set<string>();

    // 1. 正文中的关键词
    if (content.body) {
      this.extractVisualKeywords(content.body).forEach(k => keywords.add(k));
    }
    // 2. 模块要点（bullets）与模块内容
    if (content.modules && content.modules.length > 0) {
      for (const mod of content.modules) {
        if (mod.content) this.extractVisualKeywords(mod.content).forEach(k => keywords.add(k));
        if (mod.bullets) {
          for (const b of mod.bullets) {
            // 先尝试 translateFeature（覆盖精确映射 + 关键词），再补充关键词扫描
            const translated = this.translateFeature(b);
            if (translated && translated !== 'characteristic detail') {
              keywords.add(translated);
            }
            this.extractVisualKeywords(b).forEach(k => keywords.add(k));
          }
        }
      }
    }
    // 3. 标签
    if (content.tags && content.tags.length > 0) {
      for (const t of content.tags) {
        this.extractVisualKeywords(t).forEach(k => keywords.add(k));
      }
    }

    if (keywords.size === 0) return '';
    // 去重并截断，避免过长
    return Array.from(keywords).slice(0, 8).join(', ');
  }

  /** 扫描中文文本，返回其中命中的英文可视关键词列表 */
  private static extractVisualKeywords(text: string): string[] {
    if (!text) return [];
    const hits: string[] = [];
    for (const [zh, en] of this.VISUAL_KEYWORDS) {
      if (text.includes(zh)) hits.push(en);
    }
    return hits;
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 通用负面提示词 — 排除文字 + 排除解剖学错误
   * 重点防止：多头、多脚、肢体错位、重复主体等AI常见问题
   * 按类别分层，确保覆盖AI绘画最常见的解剖学错误
   */
  static getNegativePrompt(): string {
    // 1. 文字类（必须排除，防止画面出现字符）
    const textNeg = 'text, words, letters, numbers, Chinese characters, Japanese characters, watermark, signature, slogan, logo, any language text, speech bubble, caption, label, stamp text, typography, writing, alphabet, calligraphy';

    // 2. 质量类（排除低质量绘制）
    const qualityNeg = 'blurry, low quality, poorly drawn, amateur, ugly, oversaturated, jpeg artifacts, compression artifacts, grainy, noisy, pixelated, out of focus';

    // 3. 解剖学错误类（核心：防止多头多脚肢体错位）
    const anatomyNeg = 'extra limbs, extra legs, extra feet, extra heads, extra wings, extra beaks, extra tails, extra eyes, extra ears, extra nose, extra mouth, extra body parts, multiple heads, multiple legs, multiple feet, multiple wings, multiple beaks, multiple tails, multiple eyes, multiple mouths, multiple noses, duplicate animals, cloned subjects, repeated subjects, merged bodies, fused bodies, conjoined bodies, disconnected limbs, floating body parts, floating head, floating hands, bad anatomy, incorrect anatomy, anatomically incorrect, malformed body, malformed face, malformed hands, malformed feet, wrong proportions, deformed body, deformed face, deformed hands, deformed feet, twisted body, broken body, mutant, mutated, mutation, genetic defect, birth defect, abnormal body structure, asymmetrical face, asymmetrical body, crooked face, crooked body';

    // 4. 面部/细节错误类（防止五官错位、表情怪异）
    const faceNeg = 'bad face, poorly drawn face, disfigured face, blank eyes, crossed eyes, mismatched eyes, asymmetrical eyes, lazy eye, bad teeth, bad nose, bad mouth, bad lips, bad chin, bad jaw, bad ears, long neck, short neck, no neck, double chin, triple chin, weird smile, creepy smile, unnatural expression';

    // 5. 肢体/手脚错误类（防止手指脚趾异常）
    const limbNeg = 'extra fingers, extra toes, missing fingers, missing toes, fused fingers, fused toes, too many fingers, too many toes, poorly drawn hands, poorly drawn feet, malformed hands, malformed feet, abnormal hands, abnormal feet, claw-like hands, claw-like feet, blurry hands, blurry feet';

    // 6. 现实感错误类（防止卡通化、塑料感、不自然）
    const realismNeg = 'surreal, impossible, physically impossible, unrealistic body structure, cartoonish, 3D render, CGI, plastic look, doll-like, mannequin, rubber skin, wax figure, uncanny valley, fake, artificial, synthetic, unrealistic pose, impossible pose, contorted pose, twisted pose, gravity defying';

    // 7. 构图/重复类（防止重复主体、画面混乱）
    const compositionNeg = 'duplicate, cloned, mirrored, tiled pattern, repeated pattern, crowd, multiple subjects, second animal, third animal, group of animals, herd, flock, swarm, copy paste, collage, split image, diptych, triptych, panel layout, comic strip';

    return [textNeg, qualityNeg, anatomyNeg, faceNeg, limbNeg, realismNeg, compositionNeg].join(', ');
  }

  /** 主题中英文翻译表 */
  private static translateTopic(topic: string): string {
    const map: Record<string, string> = {
      '夜鹭': 'night heron',
      '向日葵': 'sunflower',
      '大熊猫': 'giant panda',
      '王安石变法': 'Wang Anshi Reform',
      '丝绸之路': 'Silk Road',
      '造纸术': 'papermaking',
      '立春': 'beginning of spring',
      '雨水': 'rain water solar term',
      '惊蛰': 'awakening of insects',
      '茶文化': 'Chinese tea culture',
      '书法': 'Chinese calligraphy',
      '人工智能': 'artificial intelligence',
      '量子计算': 'quantum computing',
      '区块链': 'blockchain technology',
      '深海': 'deep ocean',
      '极光': 'aurora borealis',
      '睡眠': 'science of sleep',
      '敦煌': 'Dunhuang Mogao Caves',
      '长城': 'Great Wall of China',
      '国画': 'Chinese painting',
      '京剧': 'Peking Opera',
      '火山': 'volcano',
      '沙漠': 'desert',
    };
    for (const key of Object.keys(map)) {
      if (topic.includes(key)) return map[key];
    }
    return topic;
  }

  /** 中文阶段名称翻译为英文（未知阶段回退为通用英文，绝不泄露中文） */
  private static translateStageName(name: string): string {
    const map: Record<string, string> = {
      '新生期': 'neonatal',
      '雏鸟期': 'nestling',
      '幼鸟期': 'juvenile',
      '亚成鸟期': 'sub-adult',
      '成鸟期': 'adult',
      '繁殖期': 'breeding',
      '老年期': 'elderly',
      '种子期': 'seed',
      '幼苗期': 'seedling',
      '生长期': 'growing',
      '花蕾期': 'budding',
      '开花期': 'flowering',
      '结实期': 'fruiting',
    };
    for (const key of Object.keys(map)) {
      if (name.includes(key)) return map[key];
    }
    // 未知阶段名称：回退为通用英文，避免在 prompt 中泄露中文
    return 'this stage';
  }

  /**
   * 特征描述翻译（将中文特征关键词转为英文画面描述）
   * 1. 精确映射；2. 关键词扫描；3. 完全未知返回通用英文 'characteristic detail'
   * 绝不将原始中文透传到 prompt 中。
   */
  private static translateFeature(feature: string): string {
    if (!feature) return '';
    // 1. 精确映射
    const map: Record<string, string> = {
      '绒羽稀疏': 'sparse downy feathers',
      '稚嫩短喙': 'tender short beak',
      '眼睛半开': 'half-open eyes',
      '紧依巢中': 'clinging to the nest',
      '羽毛渐密': 'growing denser feathers',
      '喙变尖细': 'beak becoming sharp and slender',
      '好奇心强': 'curious expression',
      '等待喂食': 'waiting to be fed',
      '羽翼丰满': 'fully feathered wings',
      '体态轻盈': 'lightweight body',
      '开始练习飞行': 'practicing flight',
      '独立觅食': 'foraging independently',
      '成鸟羽色': 'adult plumage colors',
      '冠羽明显': 'prominent crest feathers',
      '静立伺猎': 'standing still hunting posture',
      '夜行活跃': 'active at night',
      // 扩展条目
      '破壳而出': 'breaking out of the shell',
      '全身湿漉': 'wet and damp body',
      '眼未睁开': 'eyes still closed',
      '叫声尖细': 'thin high-pitched call',
      '生长迅速': 'rapid growth',
      '羽管萌发': 'pin feathers emerging',
      '扑翅试探': 'fluttering wings tentatively',
      '短距离飞行': 'short-distance flight',
      '模仿成鸟': 'imitating adult behavior',
      '羽色鲜艳': 'vivid plumage colors',
      '体型匀称': 'well-proportioned body',
      '独占领地': 'holding territory',
      '求偶展示': 'courtship display',
      '筑巢繁殖': 'nesting and breeding',
      '行动迟缓': 'slow deliberate movement',
      '羽毛略显斑驳': 'slightly mottled feathers',
      '眼神沉稳': 'calm steady gaze',
      '种子吸水膨胀': 'seed swelling with water',
      '胚根突破种皮': 'radicle breaking through the seed coat',
      '子叶展开': 'cotyledons unfolding',
      '茎秆伸长': 'stem elongating',
      '叶片舒展': 'leaves unfurling',
      '花蕾膨大': 'buds swelling',
      '花萼裂开': 'calyx splitting open',
      '花瓣完全展开': 'petals fully spread',
      '花蕊显露': 'stamens visible',
      '授粉完成': 'pollination completed',
      '果实膨大': 'fruit enlarging',
      '果皮变色': 'skin changing color',
      '种子成熟': 'seeds ripening',
    };
    if (map[feature]) return map[feature];

    // 2. 关键词扫描：从特征文本中提取已知英文可视关键词
    const keywords = this.extractVisualKeywords(feature);
    if (keywords.length > 0) return keywords.join(', ');

    // 3. 完全未知：返回通用英文，绝不泄露中文
    return 'characteristic detail';
  }

  // ============================================================
  // V1 兼容方法（保留旧接口，内部转换）
  // ============================================================

  /** @deprecated V1兼容 — 使用 buildVisualPrompt 替代 */
  static build(config: PromptConfig, content: CardContent): string {
    const subject = this.extractSubject(content);
    const filledSubject = config.subject.replace('{{subject}}', subject);
    return [config.style, filledSubject, config.composition, config.atmosphere, config.quality]
      .filter(Boolean).join('，');
  }

  /** @deprecated V1兼容 */
  static buildFromAIContent(
    config: PromptConfig,
    content: CardContent,
    aiContent?: AIGeneratedContent,
  ): { prompt: string; negative: string; source: 'ai' | 'template' } {
    if (aiContent?.imagePrompt && aiContent.imagePrompt.trim().length > 10) {
      const parts = [aiContent.imagePrompt, config.composition, config.quality].filter(Boolean);
      return { prompt: parts.join('，'), negative: config.negative, source: 'ai' };
    }
    return { prompt: this.build(config, content), negative: this.getNegativePrompt(), source: 'template' };
  }

  /** @deprecated V1兼容 */
  static rebuildFromEditedContent(
    config: PromptConfig,
    content: CardContent,
    template: CardTemplate,
    baseImagePrompt?: string,
  ): { prompt: string; negative: string } {
    if (baseImagePrompt) {
      return { prompt: `${baseImagePrompt}, ${this.contentToImageKeywords(content)}`, negative: config.negative };
    }
    const keywords = this.contentToImageKeywords(content);
    const parts = [config.style, keywords, config.composition, config.atmosphere, config.quality].filter(Boolean);
    return { prompt: parts.join('，'), negative: config.negative };
  }

  /** @deprecated V1兼容 */
  static contentToImageKeywords(content: CardContent): string {
    const parts: string[] = [];
    if (content.title) parts.push(content.title);
    if (content.tags?.length) parts.push(content.tags.join('，'));
    if (content.subtitle) parts.push(content.subtitle.slice(0, 20));
    return parts.join('，') || 'knowledge card illustration';
  }

  /** @deprecated V1兼容 */
  static getNegativePromptFromConfig(config: PromptConfig): string {
    return config.negative;
  }

  static extractSubject(content: CardContent): string {
    if (content.tags?.length) return `${content.tags[0]} ${content.title}`;
    if (content.title) return content.title;
    if (content.subtitle) return content.subtitle;
    if (content.body) return content.body.slice(0, 30);
    return 'knowledge card illustration';
  }

  /** @deprecated */
  static buildForTongyi(config: PromptConfig, content: CardContent) {
    return this.buildForOpenAI(config, content);
  }
  /** @deprecated */
  static buildForWenxin(config: PromptConfig, content: CardContent) {
    return this.buildForOpenAI(config, content);
  }
  /** @deprecated */
  static buildForOpenAI(config: PromptConfig, content: CardContent) {
    return { prompt: this.build(config, content), negative_prompt: this.getNegativePrompt(), n: 1, size: '1024x1024' };
  }
}
