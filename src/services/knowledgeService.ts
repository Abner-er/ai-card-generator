import type {
  AIConfig,
  KnowledgeBase,
  KnowledgeFact,
  LifecycleStage,
  TimelineEvent,
  ProcessStepData,
  CompareData,
} from '../types';

/**
 * Mock 知识库条目内部结构
 */
interface MockKnowledgeEntry {
  topic: string;
  summary: string;
  category: string;
  tags: string[];
  facts: KnowledgeFact[];
  keyPoints: string[];
  englishTopic: string;
  lifecycleStages?: LifecycleStage[];
  timelineEvents?: TimelineEvent[];
  processSteps?: ProcessStepData[];
  compareData?: CompareData[];
}

/**
 * 知识检索服务 (Stage 1)
 *
 * 根据主题和模板类型检索结构化知识：
 * - Mock 模式：使用内置知识库（自然科普、历史人文等主题）
 * - AI 模式：调用 Agnes AI（POST /ai-api/chat/completions）联网搜索并结构化输出 JSON
 *
 * 与 contentService 的区别：
 * 本服务专注于 Stage 1 知识检索，只返回结构化的 KnowledgeBase，
 * 不做内容生成（标题/正文/imagePrompt 等由 contentService 在 Stage 2 完成）。
 */
export class KnowledgeService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * 根据主题和模板类型检索知识
   */
  async retrieve(topic: string, templateId: string): Promise<KnowledgeBase> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      return this.retrieveMock(topic, templateId);
    }
    return this.retrieveWithAI(topic, templateId);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AIConfig>) {
    this.config = { ...this.config, ...config };
  }

  // ==================== Mock 模式（内置知识库） ====================

  /**
   * Mock 模式：从内置知识库检索，模拟 800-1500ms 延迟
   */
  private async retrieveMock(topic: string, templateId: string): Promise<KnowledgeBase> {
    await this.delay(800 + Math.random() * 700);
    const entry = this.searchKnowledgeBase(topic);
    return this.assembleKnowledge(topic, templateId, entry);
  }

  /**
   * 根据模板类型组装知识库
   * - lifecycle 模板 → lifecycleStages（6 个阶段）
   * - timeline 模板 → timelineEvents（4-6 个事件）
   * - process 模板 → processSteps（4-6 个步骤）
   * - compare/encyclopedia 模板 → facts + keyPoints（+ compareData）
   */
  private assembleKnowledge(
    topic: string,
    templateId: string,
    entry: MockKnowledgeEntry
  ): KnowledgeBase {
    const base: KnowledgeBase = {
      topic: entry.topic,
      summary: entry.summary,
      category: entry.category,
      tags: entry.tags,
      facts: entry.facts,
      keyPoints: entry.keyPoints,
      englishTopic: entry.englishTopic,
    };

    const tid = templateId.toLowerCase();

    if (tid.includes('lifecycle')) {
      base.lifecycleStages = entry.lifecycleStages || this.generateGenericLifecycle(topic);
    } else if (tid.includes('timeline')) {
      base.timelineEvents = entry.timelineEvents || this.generateGenericTimeline(topic);
    } else if (tid.includes('process')) {
      base.processSteps = entry.processSteps || this.generateGenericProcess(topic);
    } else if (tid.includes('compare')) {
      base.compareData = entry.compareData || this.generateGenericCompare(topic);
    }
    // encyclopedia 及其他模板：仅使用 facts + keyPoints（已在 base 中）

    return base;
  }

  // ==================== 内置知识库 ====================

  /**
   * 从内置知识库搜索，支持精确匹配与模糊匹配
   */
  private searchKnowledgeBase(topic: string): MockKnowledgeEntry {
    const lowerTopic = topic.toLowerCase().trim();

    // 精确 / 包含匹配
    for (const key of Object.keys(MOCK_KNOWLEDGE)) {
      if (lowerTopic.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerTopic)) {
        return MOCK_KNOWLEDGE[key];
      }
    }

    // 模糊匹配：按字符重叠度
    for (const key of Object.keys(MOCK_KNOWLEDGE)) {
      const keywords = key.split('');
      const matchCount = keywords.filter(k => lowerTopic.includes(k.toLowerCase())).length;
      if (matchCount >= Math.ceil(keywords.length / 2)) {
        return MOCK_KNOWLEDGE[key];
      }
    }

    // 未命中：生成通用知识
    return this.generateGenericEntry(topic);
  }

  // ==================== 通用知识生成（未命中知识库时） ====================

  private generateGenericEntry(topic: string): MockKnowledgeEntry {
    return {
      topic,
      summary: `"${topic}"是一个值得深入了解的主题，涉及多个维度的知识体系。`,
      category: '综合知识',
      tags: ['知识科普'],
      facts: [
        { label: '主题', value: topic },
        { label: '分类', value: '综合知识' },
        { label: '信息来源', value: '内置知识库（通用）' },
      ],
      keyPoints: [
        `${topic}的基本概念与定义`,
        `${topic}的主要特征与表现`,
        `${topic}的实际应用与意义`,
      ],
      englishTopic: topic,
    };
  }

  private generateGenericLifecycle(topic: string): LifecycleStage[] {
    const stageNames = ['萌芽期', '成长期', '发展期', '成熟期', '繁盛期', '衰退期'];
    const periods = ['初期', '早期', '中期', '中后期', '后期', '末期'];
    return stageNames.map((name, i) => ({
      id: `s${i + 1}`,
      name,
      period: periods[i],
      description: `${topic}的${name}，展现了其发展过程中的重要特征与变化。`,
      features: [`${name}特征一`, `${name}特征二`, `${name}特征三`],
      trivia: `${topic}在${name}有其独特的表现规律。`,
    }));
  }

  private generateGenericTimeline(topic: string): TimelineEvent[] {
    const events = ['起源', '发展', '鼎盛', '转型'];
    return events.map((title, i) => ({
      id: `e${i + 1}`,
      year: `阶段${i + 1}`,
      title: `${topic}${title}`,
      description: `${topic}的${title}阶段，具有重要的历史意义。`,
      significance: `这是${topic}发展历程中的关键节点。`,
    }));
  }

  private generateGenericProcess(topic: string): ProcessStepData[] {
    const steps = ['准备阶段', '实施阶段', '检验阶段', '完成阶段'];
    return steps.map((title, i) => ({
      id: `p${i + 1}`,
      order: i + 1,
      title: `${title}`,
      description: `${topic}的${title}，需要仔细操作确保质量。`,
      tip: `注意在${title}中把控关键细节。`,
    }));
  }

  private generateGenericCompare(topic: string): CompareData[] {
    return [
      {
        id: 'c1',
        label: `${topic} 方式A`,
        features: ['特征一', '特征二', '特征三'],
        pros: ['优势一', '优势二'],
        cons: ['局限一', '局限二'],
        suitableFor: '初学者',
      },
      {
        id: 'c2',
        label: `${topic} 方式B`,
        features: ['特征一', '特征二', '特征三'],
        pros: ['优势一', '优势二'],
        cons: ['局限一', '局限二'],
        suitableFor: '进阶者',
      },
    ];
  }

  // ==================== AI 模式（Agnes AI 联网搜索） ====================

  /**
   * 调用 Agnes AI 联网搜索并结构化输出 JSON
   * 端点：POST /ai-api/chat/completions（Vite 代理到 https://api.agnes-ai.cn/v1/chat/completions）
   */
  private async retrieveWithAI(topic: string, templateId: string): Promise<KnowledgeBase> {
    const systemPrompt = this.buildSystemPrompt(templateId);
    const userPrompt = this.buildUserPrompt(topic, templateId);

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
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`知识检索失败: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return this.parseAIResponse(text, topic, templateId);
  }

  /**
   * 构建系统提示词 — 要求 LLM 联网搜索并结构化输出
   */
  private buildSystemPrompt(templateId: string): string {
    const templateDesc = this.getTemplateDescription(templateId);

    return `你是一个专业的知识检索专家，擅长联网搜索并整理结构化知识。

任务：根据用户提供的主题，联网搜索最新、最准确的信息，并严格按照 JSON 格式返回结构化知识数据。${templateDesc}

要求：
1. 必须联网搜索，确保信息准确、权威、有知识深度
2. 严格按 JSON 格式返回，不要包含 markdown 代码块标记（\`\`\`json）
3. 所有文本使用中文（englishTopic 字段除外，使用英文）
4. facts 至少 4 条，keyPoints 至少 3 条
5. summary 控制在 50-100 字
6. 根据模板类型生成相应的专用结构化数据
7. 内容应具有科普价值，适合制作信息图卡片`;
  }

  /**
   * 构建用户提示词 — 指定 JSON 输出结构
   */
  private buildUserPrompt(topic: string, templateId: string): string {
    const templateData = this.getTemplateJSONSchema(templateId);

    return `请联网搜索主题"${topic}"的相关知识，按以下 JSON 格式返回结构化数据：

{
  "topic": "${topic}",
  "summary": "一句话概述（50-100字）",
  "category": "分类标签（如：生命观察、自然科普、历史人文、科技前沿）",
  "tags": ["标签1", "标签2", "标签3"],
  "facts": [
    { "label": "属性名", "value": "属性值" }
  ],
  "keyPoints": ["要点1", "要点2", "要点3"],
  "englishTopic": "English translation of the topic"${templateData}
}`;
  }

  /**
   * 根据模板类型返回 JSON schema 中的专用字段描述
   */
  private getTemplateDescription(templateId: string): string {
    const tid = templateId.toLowerCase();

    if (tid.includes('lifecycle')) {
      return '当前使用"生命周期"模板，需要生成 lifecycleStages（6个阶段，每个阶段包含 name/period/description/features/trivia）。';
    }
    if (tid.includes('timeline')) {
      return '当前使用"时间线"模板，需要生成 timelineEvents（4-6个时间线事件，每个事件包含 year/title/description/significance）。';
    }
    if (tid.includes('process')) {
      return '当前使用"流程"模板，需要生成 processSteps（4-6个步骤，每个步骤包含 order/title/description/tip）。';
    }
    if (tid.includes('compare')) {
      return '当前使用"对比"模板，需要生成 compareData（2-3个对比项，每个包含 label/features/pros/cons/suitableFor）。';
    }
    return '当前使用"百科"模板，重点生成详实的 facts 和 keyPoints。';
  }

  private getTemplateJSONSchema(templateId: string): string {
    const tid = templateId.toLowerCase();

    if (tid.includes('lifecycle')) {
      return `,
  "lifecycleStages": [
    {
      "id": "s1",
      "name": "阶段名称",
      "period": "时间段",
      "description": "阶段描述（30-60字）",
      "features": ["特征1", "特征2", "特征3", "特征4"],
      "trivia": "趣味小知识"
    }
  ]
// lifecycleStages 需包含 6 个阶段`;
    }

    if (tid.includes('timeline')) {
      return `,
  "timelineEvents": [
    {
      "id": "e1",
      "year": "年份",
      "title": "事件标题",
      "description": "事件描述（30-60字）",
      "significance": "历史意义"
    }
  ]
// timelineEvents 需包含 4-6 个事件`;
    }

    if (tid.includes('process')) {
      return `,
  "processSteps": [
    {
      "id": "p1",
      "order": 1,
      "title": "步骤名称",
      "description": "步骤描述（30-60字）",
      "tip": "操作提示"
    }
  ]
// processSteps 需包含 4-6 个步骤`;
    }

    if (tid.includes('compare')) {
      return `,
  "compareData": [
    {
      "id": "c1",
      "label": "对比项A",
      "features": ["特征1", "特征2", "特征3"],
      "pros": ["优点1", "优点2"],
      "cons": ["缺点1", "缺点2"],
      "suitableFor": "适用对象"
    }
  ]
// compareData 需包含 2-3 个对比项`;
    }

    return '';
  }

  /**
   * 解析 AI 返回的 JSON
   */
  private parseAIResponse(text: string, topic: string, templateId: string): KnowledgeBase {
    // 去除可能的 markdown 代码块标记
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        const result: KnowledgeBase = {
          topic: parsed.topic || topic,
          summary: parsed.summary || '',
          category: parsed.category || '综合知识',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          facts: Array.isArray(parsed.facts) ? parsed.facts : [],
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
          englishTopic: parsed.englishTopic || topic,
        };

        // 模板专用数据
        if (Array.isArray(parsed.lifecycleStages)) {
          result.lifecycleStages = parsed.lifecycleStages;
        }
        if (Array.isArray(parsed.timelineEvents)) {
          result.timelineEvents = parsed.timelineEvents;
        }
        if (Array.isArray(parsed.processSteps)) {
          result.processSteps = parsed.processSteps;
        }
        if (Array.isArray(parsed.compareData)) {
          result.compareData = parsed.compareData;
        }

        return result;
      } catch {
        // JSON 解析失败，降级到 Mock 知识库
      }
    }

    // 降级：使用内置知识库
    const entry = this.searchKnowledgeBase(topic);
    return this.assembleKnowledge(topic, templateId, entry);
  }

  // ==================== 工具方法 ====================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 内置 Mock 知识库
// ============================================================

const MOCK_KNOWLEDGE: Record<string, MockKnowledgeEntry> = {
  // ==================== 自然科普 — 生命周期主题 ====================

  '夜鹭': {
    topic: '夜鹭',
    summary: '夜鹭是鹈形目鹭科的中型涉禽，夜行性，广泛分布于欧亚大陆和非洲。',
    category: '生命观察',
    tags: ['鸟类', '涉禽', '夜行性'],
    facts: [
      { label: '学名', value: 'Nycticorax nycticorax' },
      { label: '体长', value: '58-65厘米' },
      { label: '翼展', value: '105-110厘米' },
      { label: '寿命', value: '10-15年' },
    ],
    keyPoints: ['夜行性涉禽', '幼鸟与成鸟羽色差异大', '广泛分布于温带和热带'],
    englishTopic: 'night heron',
    lifecycleStages: [
      {
        id: 's1',
        name: '新生期',
        period: '0-2周',
        description: '雏鸟破壳而出，全身覆盖稀疏绒羽，眼睛半开，紧依巢中。',
        features: ['绒羽稀疏', '稚嫩短喙', '眼睛半开', '紧依巢中'],
        trivia: '夜鹭雏鸟需要亲鸟持续保暖才能存活',
      },
      {
        id: 's2',
        name: '雏鸟期',
        period: '2-4周',
        description: '羽翼渐丰，开始探出巢外张望，亲鸟喂食频率高。',
        features: ['羽毛渐密', '喙变尖细', '好奇心强', '等待喂食'],
        trivia: '此阶段雏鸟食量可达体重的30%',
      },
      {
        id: 's3',
        name: '幼鸟期',
        period: '1-3月',
        description: '离巢学飞，体羽呈栗褐色带白斑，独立觅食能力逐渐增强。',
        features: ['栗褐羽色', '白色斑纹', '离巢学飞', '浅水觅食'],
        trivia: '幼鸟羽色与成鸟截然不同，曾被误认为不同物种',
      },
      {
        id: 's4',
        name: '亚成鸟期',
        period: '3月-1年',
        description: '独立生活，羽色逐渐从栗褐向灰蓝转变，活动范围扩大。',
        features: ['羽色渐变', '灰蓝初现', '独立觅食', '夜行习性'],
        trivia: '亚成鸟需经历近一年的羽色过渡才接近成鸟外观',
      },
      {
        id: 's5',
        name: '成鸟期',
        period: '1-3年',
        description: '羽色定型，头背灰蓝，翼展可达110厘米，建立固定觅食领地。',
        features: ['灰蓝羽衣', '黑色冠羽', '红色虹膜', '领地意识'],
        trivia: '成鸟头顶的2-3根白色细羽是求偶的重要标志',
      },
      {
        id: 's6',
        name: '繁殖期',
        period: '2年以上',
        description: '性成熟后参与繁殖，集群筑巢于树冠，雌雄共同孵卵育雏。',
        features: ['集群筑巢', '共同孵卵', '求偶展示', '育雏分工'],
        trivia: '夜鹭常与白鹭、池鹭混群繁殖，形成庞大的鹭鸟群落',
      },
    ],
  },

  '向日葵': {
    topic: '向日葵',
    summary: '向日葵是菊科向日葵属一年生草本植物，以花盘追随太阳的特性闻名。',
    category: '自然科普',
    tags: ['植物', '菊科', '向光性'],
    facts: [
      { label: '学名', value: 'Helianthus annuus' },
      { label: '株高', value: '1-5米' },
      { label: '花盘直径', value: '15-35厘米' },
      { label: '原产地', value: '北美洲' },
    ],
    keyPoints: ['幼株具有向光性', '花盘螺旋排列遵循斐波那契数列', '既是观赏植物也是油料作物'],
    englishTopic: 'sunflower',
    lifecycleStages: [
      {
        id: 's1',
        name: '萌芽期',
        period: '0-7天',
        description: '种子在土壤中吸水膨胀，胚根突破种皮向下生长，子叶尚未出土。',
        features: ['胚根下扎', '种皮裂开', '吸水膨胀', '土下发育'],
        trivia: '向日葵种子在5°C以上即可萌发，最适温度25-30°C',
      },
      {
        id: 's2',
        name: '幼苗期',
        period: '1-3周',
        description: '子叶破土展开，真叶陆续长出，茎秆矮壮，根系迅速向下扩展。',
        features: ['子叶展开', '真叶初生', '茎秆矮壮', '根系深扎'],
        trivia: '幼苗期的向日葵已开始追随阳光，展现向光性',
      },
      {
        id: 's3',
        name: '生长期',
        period: '3-7周',
        description: '茎秆快速拔高，叶片增大增多，植株进入营养生长旺盛期。',
        features: ['茎秆拔高', '叶片增大', '生长迅速', '需水量大'],
        trivia: '现代品种向日葵可长至3-5米高，茎秆粗壮如小树',
      },
      {
        id: 's4',
        name: '现蕾期',
        period: '7-9周',
        description: '顶端形成花蕾，茎顶膨大，花盘内部小花开始分化，植株停止长高。',
        features: ['顶端现蕾', '花盘分化', '停止长高', '养分集中'],
        trivia: '花蕾期花盘内部的管状小花可达上千朵',
      },
      {
        id: 's5',
        name: '开花期',
        period: '9-11周',
        description: '舌状花率先开放，花盘金黄灿烂，管状花由外向内依次开放。',
        features: ['金色舌状花', '管状花绽放', '花盘硕大', '花粉散发'],
        trivia: '向日葵花盘的螺旋排列遵循斐波那契数列',
      },
      {
        id: 's6',
        name: '结实期',
        period: '11-16周',
        description: '花瓣凋谢，花盘下垂，种子在花盘中逐渐饱满成熟，葵盘变褐。',
        features: ['花瓣凋落', '花盘下垂', '籽粒饱满', '葵盘转褐'],
        trivia: '成熟向日葵不再追随太阳，而是固定朝向东方',
      },
    ],
  },

  '大熊猫': {
    topic: '大熊猫',
    summary: '大熊猫是中国特有珍稀物种，被誉为"国宝"，以竹子为主食的熊科动物。',
    category: '自然科普',
    tags: ['哺乳动物', '熊科', '濒危物种'],
    facts: [
      { label: '学名', value: 'Ailuropoda melanoleuca' },
      { label: '体重', value: '80-120公斤' },
      { label: '体长', value: '120-180厘米' },
      { label: '寿命', value: '野生15-20年，圈养30年以上' },
    ],
    keyPoints: ['中国特有国宝', '以竹子为主食的食肉目动物', '繁殖率极低，每胎通常1仔'],
    englishTopic: 'giant panda',
    lifecycleStages: [
      {
        id: 's1',
        name: '新生期',
        period: '0-2周',
        description: '初生幼崽仅90-130克，全身粉嫩稀疏白毛，双眼紧闭，完全依赖母亲。',
        features: ['极小粉嫩', '白毛稀疏', '双眼紧闭', '完全依赖'],
        trivia: '大熊猫初生幼崽重量仅为母亲的千分之一',
      },
      {
        id: 's2',
        name: '婴幼期',
        period: '2周-6月',
        description: '黑白毛色逐渐显现，双眼睁开，开始学习爬行，以母乳为主食。',
        features: ['黑白显现', '双眼睁开', '学习爬行', '母乳喂养'],
        trivia: '幼崽约40天睁眼，3个月才能勉强站立',
      },
      {
        id: 's3',
        name: '幼体期',
        period: '6月-1.5岁',
        description: '开始采食竹子，乳牙换为恒牙，跟随母亲学习觅食和攀爬技能。',
        features: ['采食竹子', '换牙期', '学习攀爬', '随母活动'],
        trivia: '幼崽6个月大时开始尝试竹子，但一岁前仍以母乳为主',
      },
      {
        id: 's4',
        name: '亚成体',
        period: '1.5-5岁',
        description: '离开母亲独立生活，体型接近成体，建立自己的活动领地。',
        features: ['独立生活', '体型渐大', '建立领地', '独居习性'],
        trivia: '大熊猫亚成体期会四处游荡，寻找合适的栖息领地',
      },
      {
        id: 's5',
        name: '成体期',
        period: '5-18岁',
        description: '身体发育成熟，体重可达80-120公斤，进入繁殖年龄，每年发情一次。',
        features: ['发育成熟', '体型定型', '每年发情', '独居生活'],
        trivia: '雌性大熊猫每年仅发情24-72小时，是繁殖率低的主因',
      },
      {
        id: 's6',
        name: '老年期',
        period: '18岁以上',
        description: '活动量减少，采食效率下降，牙齿磨损，消化能力减弱。',
        features: ['活动减少', '牙齿磨损', '消化减弱', '行动迟缓'],
        trivia: '野生大熊猫寿命约15-20年，圈养个体可达30年以上',
      },
    ],
  },

  // ==================== 历史人文 — 时间线主题 ====================

  '王安石变法': {
    topic: '王安石变法',
    summary: '北宋熙宁年间王安石主持的政治改革，以"富国强兵"为目标，涉及财政、军事、教育等多领域。',
    category: '历史人文',
    tags: ['北宋', '改革', '王安石'],
    facts: [
      { label: '起始时间', value: '1069年（熙宁二年）' },
      { label: '核心人物', value: '王安石、宋神宗' },
      { label: '主要法条', value: '青苗法、募役法、保甲法等' },
      { label: '结束时间', value: '1085年（元丰八年）' },
    ],
    keyPoints: ['以富国强兵为目标的系统性改革', '涉及财政、军事、教育多领域', '因保守派反对最终被废除'],
    englishTopic: "Wang Anshi's Reforms",
    timelineEvents: [
      {
        id: 'e1',
        year: '1069年',
        title: '设立制置三司条例司',
        description: '宋神宗任命王安石为参知政事，设立制置三司条例司作为变法核心机构，统筹全国财政改革。',
        significance: '标志着熙宁变法正式启动，王安石开始系统推行新政',
      },
      {
        id: 'e2',
        year: '1069年秋',
        title: '颁布青苗法',
        description: '在青黄不接时官府向农民贷款，秋收后偿还，旨在抑制高利贷、减轻农民负担。',
        significance: '新法中最具争议的法案，既惠农也引发官员贪腐争议',
      },
      {
        id: 'e3',
        year: '1070年',
        title: '推行募役法',
        description: '以交钱代役取代差役制度，原来服役的人丁改为缴纳免役钱，由官府雇人服役。',
        significance: '解放了农村劳动力，但加重了原本无役的下户负担',
      },
      {
        id: 'e4',
        year: '1071年',
        title: '推行保甲法与农田水利法',
        description: '农户十家为一保，五保为一大保，维护治安兼军事训练；同时大兴水利，开垦荒田。',
        significance: '兼顾治安与农业生产，强化基层控制',
      },
      {
        id: 'e5',
        year: '1073年',
        title: '设立市易法与方田均税法',
        description: '设市易司管理市场贸易，平抑物价；方田均税法清丈土地，按实亩征税。',
        significance: '打击商人垄断，增加国家财政收入',
      },
      {
        id: 'e6',
        year: '1076年',
        title: '王安石第二次罢相',
        description: '因保守派激烈反对及变法派内部分裂，王安石再次辞相退居江宁，新法由神宗独自维持。',
        significance: '王安石退出政坛，变法失去核心推动力，最终在神宗去世后被废除',
      },
    ],
  },

  '丝绸之路': {
    topic: '丝绸之路',
    summary: '古代连接亚欧大陆的贸易与文化交流网络，始于汉代，促进了东西方文明的深度交融。',
    category: '历史人文',
    tags: ['古代贸易', '文化交流', '汉代'],
    facts: [
      { label: '全长', value: '约7000公里' },
      { label: '起始时间', value: '公元前138年（张骞出使西域）' },
      { label: '主要货物', value: '丝绸、瓷器、茶叶、香料' },
      { label: '世界遗产', value: '2014年列入' },
    ],
    keyPoints: ['东西方文明交流的桥梁', '始于汉代张骞通西域', '贸易与文化双重通道'],
    englishTopic: 'Silk Road',
    timelineEvents: [
      {
        id: 'e1',
        year: '公元前138年',
        title: '张骞首次出使西域',
        description: '汉武帝派张骞出使大月氏，虽未达成军事同盟，但打通了中原通往西域的道路。',
        significance: '丝绸之路的开端，开启了东西方交流的新纪元',
      },
      {
        id: 'e2',
        year: '公元前60年',
        title: '设立西域都护府',
        description: '汉宣帝设立西域都护府，正式将西域纳入汉朝管辖，保障了丝路畅通。',
        significance: '丝绸之路进入官方保护时代，贸易往来更加频繁',
      },
      {
        id: 'e3',
        year: '公元73年',
        title: '班超经营西域',
        description: '东汉班超重新打通丝路，并派甘英出使大秦（罗马帝国），抵达波斯湾。',
        significance: '丝绸之路延伸至更远的西方，达到鼎盛时期',
      },
      {
        id: 'e4',
        year: '公元629年',
        title: '玄奘西行取经',
        description: '唐代高僧玄奘经由丝路前往天竺取经，历时17年，著《大唐西域记》。',
        significance: '丝路成为宗教文化交流的重要通道',
      },
      {
        id: 'e5',
        year: '公元1271年',
        title: '马可·波罗东游',
        description: '意大利旅行家马可·波罗沿丝路东行抵达元大都，在华居住17年后著《马可·波罗游记》。',
        significance: '丝路文化交流的巅峰，激发了欧洲对东方的向往',
      },
    ],
  },

  // ==================== 科技人文 — 流程主题 ====================

  '造纸术': {
    topic: '造纸术',
    summary: '中国四大发明之一，以植物纤维为原料经过多道工序制成纸张，彻底改变了人类知识传播方式。',
    category: '科技人文',
    tags: ['四大发明', '古代科技', '汉代'],
    facts: [
      { label: '发明者', value: '蔡伦（改进）' },
      { label: '改进时间', value: '公元105年（东汉）' },
      { label: '主要原料', value: '树皮、麻头、破布、旧渔网' },
      { label: '传播时间', value: '8世纪传至阿拉伯，12世纪传至欧洲' },
    ],
    keyPoints: ['中国四大发明之一', '蔡伦改进造纸术使其普及', '推动了人类文明的知识传播'],
    englishTopic: 'papermaking',
    processSteps: [
      {
        id: 'p1',
        order: 1,
        title: '选材备料',
        description: '选取构树皮、麻、竹等植物纤维为原料，浸泡、清洗去除杂质。',
        tip: '不同原料决定纸张质地，构树皮最佳',
      },
      {
        id: 'p2',
        order: 2,
        title: '石灰浸沤',
        description: '将原料浸入石灰水中沤制数月，使纤维软化分离，去除木质素和果胶。',
        tip: '浸沤时间影响纤维纯度，一般需3-6个月',
      },
      {
        id: 'p3',
        order: 3,
        title: '舂捣成浆',
        description: '将沤好的纤维放入石臼反复舂捣，使其成为细腻均匀的纸浆悬浮液。',
        tip: '舂捣越充分，纸质越细腻均匀',
      },
      {
        id: 'p4',
        order: 4,
        title: '抄纸成型',
        description: '用竹帘从纸浆槽中捞起一层薄薄的纤维，滤水后形成湿纸页，覆于湿纸堆上。',
        tip: '抄纸手法决定纸张厚薄与均匀度',
      },
      {
        id: 'p5',
        order: 5,
        title: '压榨干燥',
        description: '将湿纸堆压去多余水分，再逐张揭起贴于火墙或晒板上烘干，即成纸张。',
        tip: '烘干温度需均匀，否则纸张易皱缩开裂',
      },
    ],
  },

  // ==================== 生活文化 — 对比主题 ====================

  '绿茶与红茶': {
    topic: '绿茶与红茶',
    summary: '绿茶与红茶是两大主流茶类，因发酵程度不同而各具特色，适合不同体质与场景。',
    category: '生活文化',
    tags: ['茶文化', '饮品对比', '健康'],
    facts: [
      { label: '绿茶发酵度', value: '0%（不发酵）' },
      { label: '红茶发酵度', value: '80-90%（全发酵）' },
      { label: '绿茶代表', value: '龙井、碧螺春、毛峰' },
      { label: '红茶代表', value: '祁门红茶、正山小种、滇红' },
    ],
    keyPoints: ['发酵程度是两者核心区别', '绿茶性寒适合清热提神', '红茶性温适合暖胃护胃'],
    englishTopic: 'green tea vs black tea',
    compareData: [
      {
        id: 'c1',
        label: '绿茶',
        features: ['不发酵茶', '清汤绿叶', '茶多酚含量高', '口感鲜爽回甘'],
        pros: ['抗氧化能力强', '提神醒脑', '清热降火', '有助减脂'],
        cons: ['性寒伤胃', '不宜空腹饮用', '影响铁元素吸收', '咖啡因敏感者慎饮'],
        suitableFor: '体质偏热、需提神醒脑的人群',
      },
      {
        id: 'c2',
        label: '红茶',
        features: ['全发酵茶', '红汤红叶', '茶黄素含量高', '口感醇厚甘甜'],
        pros: ['暖胃护胃', '促进消化', '性质温和', '适合加奶调饮'],
        cons: ['咖啡因含量较高', ' evening饮用影响睡眠', '不宜冷饮', '易染色牙齿'],
        suitableFor: '体质偏寒、胃肠敏感的人群',
      },
    ],
  },

  // ==================== 百科主题 ====================

  '敦煌': {
    topic: '敦煌莫高窟',
    summary: '始建于公元366年的佛教艺术宝库，以壁画和彩塑闻名于世，是丝绸之路上的文化明珠。',
    category: '历史人文',
    tags: ['世界遗产', '佛教艺术', '壁画'],
    facts: [
      { label: '始建时间', value: '公元366年' },
      { label: '现存洞窟', value: '735个' },
      { label: '壁画面积', value: '45000平方米' },
      { label: '列入世遗', value: '1987年' },
    ],
    keyPoints: ['千年佛教艺术宝库', '壁画面积达45000平方米', '藏经洞出土5万余件文献催生敦煌学'],
    englishTopic: 'Dunhuang Mogao Caves',
  },
};
