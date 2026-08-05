import type {
  AIConfig,
  AIGeneratedContent,
  CardTemplate,
  CardContent,
  KnowledgeBase,
  KnowledgeModule,
  ProcessStep,
  CompareItem,
  ContentSection,
  LifecycleStage,
  TimelineEvent,
  ProcessStepData,
} from '../types';

/**
 * AI 内容生成服务 (V2)
 * Stage 2: 基于知识库（Stage 1 产物）生成结构化卡片内容
 *
 * 工作流：KnowledgeBase → contentService.generate() → CardContent
 * 系列模板（lifecycle/timeline/process）按 cardIndex 生成单张卡片内容
 * 单卡模板（quick/encyclopedia/compare）生成完整结构化内容
 */
export class ContentGenerationService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * V2 主接口：基于知识库生成卡片内容
   * @param knowledge Stage 1 检索的知识库
   * @param template 卡片模板
   * @param cardIndex 系列模板中的卡片序号（从0开始），单卡模板忽略
   */
  async generate(
    knowledge: KnowledgeBase,
    template: CardTemplate,
    cardIndex: number = 0,
  ): Promise<CardContent> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      return this.generateMock(knowledge, template, cardIndex);
    }
    return this.generateWithAI(knowledge, template, cardIndex);
  }

  /**
   * @deprecated V1兼容接口：直接从主题生成内容
   * 内部创建简易知识库后调用 V2 接口
   */
  async generateFromTopic(topic: string, template?: CardTemplate): Promise<AIGeneratedContent> {
    const tpl = template || { id: 'default', name: '默认', description: '', category: 'quick', canvas: { width: 1080, height: 1440, backgroundColor: '#fff' }, promptTemplate: { style: '', subject: '', composition: '', negative: '', atmosphere: '', quality: '' }, renderer: 'knowledge' };
    const knowledge: KnowledgeBase = {
      topic,
      summary: `关于${topic}的知识`,
      category: '通用',
      tags: ['知识分享'],
      facts: [],
      keyPoints: [],
      englishTopic: topic,
    };
    const content = await this.generate(knowledge, tpl, 0);
    return {
      ...content,
      imagePrompt: '',
      summary: knowledge.summary,
    };
  }

  // ============================================================
  // Mock 模式
  // ============================================================

  private async generateMock(
    knowledge: KnowledgeBase,
    template: CardTemplate,
    cardIndex: number,
  ): Promise<CardContent> {
    await this.delay(600 + Math.random() * 400);
    const templateId = template.htmlTemplateId || template.id;

    // 系列模板：按 cardIndex 生成对应阶段的内容
    if (templateId === 'lifecycle' && knowledge.lifecycleStages) {
      return this.generateLifecycleCard(knowledge, cardIndex);
    }
    if (templateId === 'timeline' && knowledge.timelineEvents) {
      return this.generateTimelineCard(knowledge, cardIndex);
    }
    if (templateId === 'process' && knowledge.processSteps) {
      return this.generateProcessCard(knowledge, cardIndex);
    }

    // 单卡模板：生成完整结构化内容
    if (templateId === 'quick-knowledge') {
      return this.generateQuickKnowledgeCard(knowledge);
    }
    if (templateId === 'encyclopedia') {
      return this.generateEncyclopediaCard(knowledge);
    }
    if (templateId === 'compare-card') {
      return this.generateCompareCard(knowledge);
    }

    // 通用默认
    return this.generateGenericCard(knowledge);
  }

  // ===== 系列模板内容生成 =====

  private generateLifecycleCard(knowledge: KnowledgeBase, cardIndex: number): CardContent {
    const stages = knowledge.lifecycleStages || [];
    const stage = stages[cardIndex] || stages[0];
    const topic = knowledge.topic;
    const episode = String(cardIndex + 1).padStart(2, '0');
    const total = String(stages.length).padStart(2, '0');

    // PPT式精简：关键词标签，每条≤8字
    const observations = stage.features.slice(0, 3).map(f => f.length > 8 ? f.slice(0, 7) + '…' : f);
    // 核心概念≤20字
    const shortBody = stage.description.length > 20 ? stage.description.slice(0, 19) + '…' : stage.description;

    return {
      title: `${episode} ${stage.name}`,
      subtitle: `${stage.period} · ${this.getStageSubtitle(stage.name)}`,
      body: shortBody,
      footer: `${topic}图鉴 · ${episode}/${total}`,
      tags: knowledge.tags.slice(0, 3),
      seriesName: `${topic}图鉴`,
      episode,
      totalEpisodes: total,
      topicNumber: episode,
      englishSubtitle: `${knowledge.englishTopic || topic} - ${stage.name}`,
      definition: shortBody,
      modules: [
        { id: 'm1', type: 'concept', title: '特征', icon: '🔬', content: stage.description.slice(0, 15), bullets: observations.slice(0, 2) },
        { id: 'm2', type: 'points', title: '观察', icon: '👀', content: '', bullets: observations },
        { id: 'm3', type: 'tip', title: '冷知识', icon: '💡', content: (stage.trivia || `${stage.name}的关键阶段`).slice(0, 15) },
      ],
      highlights: observations.slice(0, 4),
      quote: this.getStageQuote(stage.name, topic),
      handwrittenNote: this.getStageNote(stage.name, topic),
    };
  }

  private generateTimelineCard(knowledge: KnowledgeBase, cardIndex: number): CardContent {
    const events = knowledge.timelineEvents || [];
    const event = events[cardIndex] || events[0];
    const topic = knowledge.topic;
    const episode = String(cardIndex + 1).padStart(2, '0');
    const total = String(events.length).padStart(2, '0');

    // PPT式精简
    const shortBody = event.description.length > 20 ? event.description.slice(0, 19) + '…' : event.description;
    const shortSignificance = (event.significance || '重要里程碑').slice(0, 12);

    return {
      title: event.title,
      subtitle: `${event.year} · ${this.getEventSubtitle(event)}`,
      body: shortBody,
      footer: `${topic}时间线 · ${episode}/${total}`,
      tags: knowledge.tags.slice(0, 3),
      seriesName: `${topic}图解`,
      episode,
      totalEpisodes: total,
      topicNumber: episode,
      englishSubtitle: `${knowledge.englishTopic || topic} - ${event.title}`,
      definition: shortBody,
      modules: [
        { id: 'm1', type: 'concept', title: '概述', icon: '📜', content: shortBody },
        { id: 'm2', type: 'fact', title: '意义', icon: '⭐', content: shortSignificance },
        { id: 'm3', type: 'note', title: '思考', icon: '🤔', content: `${event.year}年的关键节点`.slice(0, 15) },
      ],
      highlights: [event.year, event.title.slice(0, 6), shortSignificance].filter(Boolean),
      quote: this.getEventQuote(event, topic),
      handwrittenNote: `关注${event.year}年脉络。`,
    };
  }

  private generateProcessCard(knowledge: KnowledgeBase, cardIndex: number): CardContent {
    const steps = knowledge.processSteps || [];
    const step = steps[cardIndex] || steps[0];
    const topic = knowledge.topic;
    const episode = String(cardIndex + 1).padStart(2, '0');
    const total = String(steps.length).padStart(2, '0');

    // PPT式精简
    const shortBody = step.description.length > 20 ? step.description.slice(0, 19) + '…' : step.description;
    const shortTip = (step.tip || `注意${step.title}的细节`).slice(0, 12);

    return {
      title: `${step.title}`,
      subtitle: `${topic}流程 · 第${step.order}步`,
      body: shortBody,
      footer: `${topic}指南 · ${episode}/${total}`,
      tags: knowledge.tags.slice(0, 3),
      seriesName: `${topic}流程图`,
      episode,
      totalEpisodes: total,
      topicNumber: episode,
      englishSubtitle: `${knowledge.englishTopic || topic} - Step ${step.order}`,
      definition: shortBody,
      modules: [
        { id: 'm1', type: 'process', title: '操作', icon: '🔧', content: shortBody },
        { id: 'm2', type: 'tip', title: '贴士', icon: '💡', content: shortTip },
        { id: 'm3', type: 'note', title: '注意', icon: '⚠️', content: `完成前序步骤`.slice(0, 12) },
      ],
      highlights: [step.title.slice(0, 6), shortTip],
      quote: `每步都是关键`,
      handwrittenNote: shortTip,
    };
  }

  // ===== 单卡模板内容生成 =====

  private generateQuickKnowledgeCard(knowledge: KnowledgeBase): CardContent {
    const topic = knowledge.topic;
    // PPT式精简：核心概念≤20字，关键词≤8字
    const shortSummary = knowledge.summary.length > 20 ? knowledge.summary.slice(0, 19) + '…' : knowledge.summary;
    const shortPoints = knowledge.keyPoints.slice(0, 3).map(p => p.length > 8 ? p.slice(0, 7) + '…' : p);
    return {
      title: topic.length > 10 ? topic.slice(0, 9) + '…' : topic,
      subtitle: this.getTopicSubtitle(topic, knowledge),
      body: shortSummary,
      footer: `知识速记`,
      tags: knowledge.tags.slice(0, 3),
      seriesName: 'Knowledge Quick',
      episode: '01',
      totalEpisodes: '09',
      topicNumber: '01',
      englishSubtitle: knowledge.englishTopic || topic,
      definition: shortSummary,
      modules: [
        { id: 'm1', type: 'concept', title: '核心', icon: '💡', content: shortSummary },
        { id: 'm2', type: 'points', title: '要点', icon: '🎯', content: '', bullets: shortPoints },
        { id: 'm3', type: 'tip', title: '建议', icon: '⚡', content: `结合理论与实践` },
      ],
      highlights: shortPoints.slice(0, 3),
      quote: `理解本质胜过记忆`,
      handwrittenNote: `抓核心`,
    };
  }

  private generateEncyclopediaCard(knowledge: KnowledgeBase): CardContent {
    const topic = knowledge.topic;
    // PPT式精简
    const shortSummary = knowledge.summary.length > 20 ? knowledge.summary.slice(0, 19) + '…' : knowledge.summary;
    const shortPoints = knowledge.keyPoints.slice(0, 4).map(p => p.length > 8 ? p.slice(0, 7) + '…' : p);
    return {
      title: topic.length > 10 ? topic.slice(0, 9) + '…' : topic,
      subtitle: knowledge.category,
      body: shortSummary,
      footer: `百科 · ${new Date().toLocaleDateString('zh-CN')}`,
      tags: knowledge.tags.slice(0, 3),
      seriesName: 'Encyclopedia',
      englishSubtitle: knowledge.englishTopic || topic,
      definition: shortSummary,
      modules: [
        { id: 'm1', type: 'points', title: '特征', icon: '🎯', content: '', bullets: shortPoints },
        { id: 'm2', type: 'fact', title: '数据', icon: '📊', content: knowledge.facts.slice(0, 2).map(f => `${f.label}: ${f.value}`).join('；').slice(0, 18) },
        { id: 'm3', type: 'note', title: '延伸', icon: '📚', content: `深入了解${topic.slice(0, 4)}`.slice(0, 15) },
      ],
      highlights: shortPoints.slice(0, 3),
      quote: `知识是钥匙`,
    };
  }

  private generateCompareCard(knowledge: KnowledgeBase): CardContent {
    const topic = knowledge.topic;
    const compareData = knowledge.compareData || [];
    const compareItems: CompareItem[] = compareData.map((d, i) => ({
      id: d.id,
      label: d.label.length > 5 ? d.label.slice(0, 4) + '…' : d.label,
      badge: String.fromCharCode(65 + i),
      features: d.features.slice(0, 2).map(f => f.length > 8 ? f.slice(0, 7) + '…' : f),
      suitableFor: d.suitableFor,
    }));

    // PPT式精简
    const shortSummary = knowledge.summary.length > 20 ? knowledge.summary.slice(0, 19) + '…' : knowledge.summary;
    const shortPoints = knowledge.keyPoints.slice(0, 3).map(p => p.length > 8 ? p.slice(0, 7) + '…' : p);

    return {
      title: `${topic}对比`,
      subtitle: '多维度分析',
      body: shortSummary,
      footer: `对比 · ${new Date().toLocaleDateString('zh-CN')}`,
      tags: knowledge.tags.slice(0, 3),
      seriesName: 'Comparison',
      englishSubtitle: knowledge.englishTopic || topic,
      definition: shortSummary,
      modules: [
        { id: 'm1', type: 'concept', title: '概念', icon: '💡', content: shortSummary },
        { id: 'm2', type: 'points', title: '特点', icon: '⚖️', content: '', bullets: shortPoints },
      ],
      compareItems,
      highlights: shortPoints.slice(0, 3),
      quote: `比较是理解的开始`,
      handwrittenNote: `按需选择`,
    };
  }

  private generateGenericCard(knowledge: KnowledgeBase): CardContent {
    // PPT式精简
    const shortSummary = knowledge.summary.length > 20 ? knowledge.summary.slice(0, 19) + '…' : knowledge.summary;
    const shortPoints = knowledge.keyPoints.slice(0, 3).map(p => p.length > 8 ? p.slice(0, 7) + '…' : p);
    return {
      title: knowledge.topic.length > 10 ? knowledge.topic.slice(0, 9) + '…' : knowledge.topic,
      subtitle: knowledge.category,
      body: shortSummary,
      footer: `知识卡片 · ${new Date().toLocaleDateString('zh-CN')}`,
      tags: knowledge.tags.slice(0, 3),
      englishSubtitle: knowledge.englishTopic,
      definition: shortSummary,
      modules: [
        { id: 'm1', type: 'concept', title: '概述', icon: '📌', content: shortSummary },
        { id: 'm2', type: 'points', title: '要点', icon: '🎯', content: '', bullets: shortPoints },
      ],
      highlights: shortPoints.slice(0, 3),
    };
  }

  // ===== 辅助方法 =====

  private buildInfoCards(stage: LifecycleStage, topic: string): Record<string, string> {
    return {
      '外观': stage.features[0] || '',
      '状态': stage.features[1] || '',
      '需求': stage.features[2] || '',
    };
  }

  private getStageSubtitle(stageName: string): string {
    const map: Record<string, string> = {
      '新生期': '破壳与依偎',
      '雏鸟期': '羽翼渐丰',
      '幼鸟期': '探索世界',
      '亚成鸟期': '独立成长',
      '成鸟期': '成熟与繁衍',
      '繁殖期': '生命延续',
      '种子期': '破土萌芽',
      '幼苗期': '向阳生长',
      '生长期': '枝繁叶茂',
      '花蕾期': '含苞待放',
      '开花期': '绚丽绽放',
      '结实期': '硕果累累',
    };
    return map[stageName] || '成长阶段';
  }

  private getStageQuote(stageName: string, topic: string): string {
    return `每一个阶段，都是生命的诗篇。`;
  }

  private getStageNote(stageName: string, topic: string): string {
    return `注意观察${stageName}的典型特征。`;
  }

  private getEventSubtitle(event: TimelineEvent): string {
    return event.significance?.slice(0, 12) || '历史事件';
  }

  private getEventQuote(event: TimelineEvent, topic: string): string {
    return `历史是一面镜子，照亮前行的路。`;
  }

  private getTopicSubtitle(topic: string, knowledge: KnowledgeBase): string {
    return knowledge.tags[0] || '知识探索';
  }

  // ============================================================
  // AI 模式
  // ============================================================

  private async generateWithAI(
    knowledge: KnowledgeBase,
    template: CardTemplate,
    cardIndex: number,
  ): Promise<CardContent> {
    const templateId = template.htmlTemplateId || template.id;
    const systemPrompt = this.buildSystemPrompt(templateId);
    const userPrompt = this.buildUserPrompt(knowledge, templateId, cardIndex);

    const response = await fetch('/ai-api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.textModel || 'agnes-2.0-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`AI内容生成失败: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return await this.parseAIResponse(text, knowledge, templateId, cardIndex);
  }

  private buildSystemPrompt(templateId: string): string {
    return `你是一个信息图卡片内容设计专家，擅长将复杂知识拆解为PPT式的视觉化卡片内容。

核心设计原则（像设计PPT一样设计卡片内容）：
1. 极简文字：绝不出现大段文字。正文不超过30字，用短句或关键词组合
2. 信息拆解：把复杂概念拆成3-4个关键点，每个关键点用5-12字概括
3. 视觉化语言：每个模块配一个emoji图标，用短标题（2-6字）
4. 层级分明：标题(≤12字) → 一句话总结(≤20字) → 3-4个关键要点(每个≤12字) → 标签
5. 要点精炼：highlights每个不超过8字，用「关键词：简述」格式
6. 金句感：quote要有记忆点，不超过15字

禁止：
- 禁止正文超过40字
- 禁止modules的content超过25字
- 禁止bullets每条超过15字
- 禁止使用长句和复杂从句

模板类型：${templateId}`;
  }

  private buildUserPrompt(knowledge: KnowledgeBase, templateId: string, cardIndex: number): string {
    const knowledgeJSON = JSON.stringify({
      topic: knowledge.topic,
      summary: knowledge.summary,
      tags: knowledge.tags,
      facts: knowledge.facts,
      keyPoints: knowledge.keyPoints,
      lifecycleStages: knowledge.lifecycleStages?.[cardIndex],
      timelineEvents: knowledge.timelineEvents?.[cardIndex],
      processSteps: knowledge.processSteps?.[cardIndex],
    }, null, 2);

    const cardNum = String(cardIndex + 1).padStart(2, '0');
    const total = knowledge.lifecycleStages?.length || knowledge.timelineEvents?.length || knowledge.processSteps?.length || 1;
    const totalStr = String(total).padStart(2, '0');

    return `知识库数据：
${knowledgeJSON}

请为第${cardIndex + 1}张卡片（共${total}张）生成PPT式精简内容。

返回JSON格式（所有文字必须精简，像PPT一样）：
{
  "title": "主标题（≤12字，简短有力）",
  "subtitle": "副标题（≤15字，一句话概括）",
  "body": "核心总结（≤25字，一句话说清楚核心概念）",
  "footer": "底部信息（≤10字）",
  "tags": ["标签1（≤4字）", "标签2"],
  "definition": "概念定义（≤20字）",
  "modules": [
    {"id":"m1","type":"concept","title":"短标题（2-4字）","icon":"💡","content":"一句话说明（≤20字）","bullets":["要点1（≤12字）","要点2（≤12字）"]},
    {"id":"m2","type":"points","title":"短标题","icon":"🎯","content":"一句话说明","bullets":["要点1","要点2"]},
    {"id":"m3","type":"tip","title":"短标题","icon":"⚡","content":"一句话说明","bullets":[]}
  ],
  "highlights": ["关键词1（≤8字）", "关键词2", "关键词3"],
  "quote": "金句（≤15字，有记忆点）",
  "handwrittenNote": "批注（≤12字）",
  "seriesName": "系列名",
  "episode": "${cardNum}",
  "totalEpisodes": "${totalStr}",
  "topicNumber": "${cardNum}",
  "englishSubtitle": "English Subtitle"
}`;
  }

  private async parseAIResponse(
    text: string,
    knowledge: KnowledgeBase,
    templateId: string,
    cardIndex: number,
  ): Promise<CardContent> {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const p = JSON.parse(jsonMatch[0]);
        return {
          title: p.title || knowledge.topic,
          subtitle: p.subtitle || '',
          body: p.body || knowledge.summary,
          footer: p.footer || `知识卡片 · ${new Date().toLocaleDateString('zh-CN')}`,
          tags: Array.isArray(p.tags) ? p.tags : knowledge.tags,
          seriesName: p.seriesName,
          episode: p.episode,
          totalEpisodes: p.totalEpisodes,
          topicNumber: p.topicNumber,
          englishSubtitle: p.englishSubtitle || knowledge.englishTopic,
          definition: p.definition || knowledge.summary,
          modules: p.modules,
          compareItems: p.compareItems,
          highlights: p.highlights,
          quote: p.quote,
          handwrittenNote: p.handwrittenNote,
        };
      } catch {
        // JSON解析失败，降级
      }
    }

    // 降级到 Mock
    return await this.generateMock(knowledge, { id: templateId, name: '', description: '', category: 'quick', canvas: { width: 1080, height: 1440, backgroundColor: '#fff' }, promptTemplate: { style: '', subject: '', composition: '', negative: '', atmosphere: '', quality: '' }, renderer: 'knowledge', htmlTemplateId: templateId }, cardIndex);
  }

  updateConfig(config: Partial<AIConfig>) {
    this.config = { ...this.config, ...config };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
