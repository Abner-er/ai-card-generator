import type { AITextConfig, AIGeneratedContent, CardTemplate } from '../types';

/**
 * AI内容生成服务
 * 根据用户输入的主题，自动生成知识卡片所需的内容
 * 支持 Mock 模式（内置知识库）和真实大模型API
 */
export class ContentGenerationService {
  private config: AITextConfig;

  constructor(config: AITextConfig) {
    this.config = config;
  }

  /**
   * 根据主题生成知识卡片内容
   */
  async generate(topic: string, template?: CardTemplate): Promise<AIGeneratedContent> {
    switch (this.config.provider) {
      case 'mock':
        return this.generateMock(topic, template);
      case 'qianwen':
        return this.generateWithQianwen(topic, template);
      case 'deepseek':
        return this.generateWithDeepseek(topic, template);
      case 'zhipu':
        return this.generateWithZhipu(topic, template);
      default:
        return this.generateMock(topic, template);
    }
  }

  /**
   * Mock模式：内置知识库生成内容
   */
  private async generateMock(topic: string, template?: CardTemplate): Promise<AIGeneratedContent> {
    // 模拟AI思考延迟
    await this.delay(800 + Math.random() * 600);

    const knowledge = this.searchKnowledgeBase(topic);
    const imagePrompt = this.buildImagePrompt(topic, knowledge, template);

    return {
      title: knowledge.title,
      subtitle: knowledge.subtitle,
      body: knowledge.body,
      tags: knowledge.tags,
      imagePrompt,
      summary: knowledge.summary,
    };
  }

  /**
   * 内置知识库（模拟AI搜索知识图谱）
   */
  private searchKnowledgeBase(topic: string) {
    const lowerTopic = topic.toLowerCase().trim();

    // 二十四节气系列
    const solarTerms: Record<string, any> = {
      '立春': {
        title: '二十四节气之立春',
        subtitle: '万物复苏，春意盎然',
        body: '立春，为二十四节气之首。立，是"开始"之意；春，代表着温暖、生长。立春标志着万物闭藏的冬季已过去，开始进入风和日暖、万物生长的春季。此时气温逐渐回升，日照渐长，雨水增多，大自然开始焕发生机。',
        tags: ['传统文化', '节气', '立春'],
        summary: '立春是二十四节气之首，标志着春季的开始，万物复苏。',
      },
      '雨水': {
        title: '二十四节气之雨水',
        subtitle: '春风化雨，润物无声',
        body: '雨水，是二十四节气中的第二个节气。此时气温回升、冰雪融化、降水增多，故取名为雨水。雨水节气意味着进入气象意义的春天，此后春暖花开，万物萌芽，一派生机勃勃的景象。',
        tags: ['传统文化', '节气', '雨水'],
        summary: '雨水节气气温回升、降水增多，标志着气象意义上的春天到来。',
      },
      '惊蛰': {
        title: '二十四节气之惊蛰',
        subtitle: '春雷乍响，万物萌动',
        body: '惊蛰，是二十四节气中的第三个节气。惊蛰反映的是自然生物受节律变化影响而出现萌发生长的现象。时至惊蛰，阳气上升、气温回暖、春雷乍动、雨水增多，万物生机盎然。',
        tags: ['传统文化', '节气', '惊蛰'],
        summary: '惊蛰时节春雷乍响，蛰伏的动物开始苏醒，万物萌动生长。',
      },
    };

    // 传统文化系列
    const culture: Record<string, any> = {
      '茶文化': {
        title: '中国茶文化',
        subtitle: '一片树叶的故事',
        body: '中国是茶的故乡，茶文化源远流长。从神农尝百草开始，茶已有数千年历史。茶不仅是一种饮品，更是一种文化符号，承载着中国人"和、静、怡、真"的精神追求。绿茶清香、红茶醇厚、乌龙悠长、普洱陈香，各有千秋。',
        tags: ['传统文化', '茶道', '生活方式'],
        summary: '中国茶文化源远流长，涵盖茶的种类、泡茶技艺和精神内涵。',
      },
      '书法': {
        title: '中国书法艺术',
        subtitle: '笔墨之间的千年传承',
        body: '中国书法是以汉字为载体的独特艺术形式，至今已有三千多年历史。从甲骨文、金文到篆、隶、楷、行、草，书法风格不断演变。书法不仅是书写文字的工具，更是表达情感、展现人格境界的一种艺术。',
        tags: ['传统文化', '书法', '艺术'],
        summary: '中国书法以汉字为载体，历经三千年演变，是独特的视觉艺术。',
      },
    };

    // 科技系列
    const tech: Record<string, any> = {
      '人工智能': {
        title: '人工智能的演进',
        subtitle: '从图灵测试到大模型时代',
        body: '人工智能（AI）的研究始于1950年代。从早期的专家系统、机器学习，到深度学习的突破，再到如今大语言模型（LLM）的爆发，AI正在深刻改变人类的生活方式。GPT、Claude等大模型展现了强大的自然语言理解和生成能力。',
        tags: ['科技', 'AI', '前沿技术'],
        summary: '人工智能从1950年代发展至今，经历了从规则系统到大模型的演进。',
      },
      '量子计算': {
        title: '量子计算前沿',
        subtitle: '颠覆性的计算范式',
        body: '量子计算利用量子叠加和量子纠缠原理进行计算，理论上可以在特定问题上实现指数级加速。量子比特（Qubit）是量子计算的基本单位。目前Google、IBM等科技巨头正在竞相研发实用化量子计算机。',
        tags: ['科技', '量子计算', '前沿技术'],
        summary: '量子计算利用量子力学原理，有望在特定问题上实现指数级加速。',
      },
      '区块链': {
        title: '区块链技术解析',
        subtitle: '去中心化的信任机制',
        body: '区块链是一种分布式账本技术，通过密码学保证数据的不可篡改性。每个区块包含交易记录，通过哈希值链接成链。区块链的去中心化、透明、可追溯特性，使其在金融、供应链、数字身份等领域有广泛应用前景。',
        tags: ['科技', '区块链', 'Web3'],
        summary: '区块链是分布式账本技术，通过密码学保证数据不可篡改。',
      },
    };

    // 自然系列
    const nature: Record<string, any> = {
      '深海': {
        title: '深海探索奥秘',
        subtitle: '地球最后的未知 frontier',
        body: '深海是指海洋中水深超过200米的区域，占海洋总体积的95%以上。深海环境极端恶劣：高压、低温、黑暗。然而深海中存在着丰富的生物多样性，包括发光生物、热泉生态系等。人类对深海的探索还不到5%，它被称为"地球最后的未知领域"。',
        tags: ['自然', '海洋', '探索'],
        summary: '深海占海洋体积95%以上，环境极端但生物多样性丰富，人类探索不足5%。',
      },
      '极光': {
        title: '极光的科学之美',
        subtitle: '太阳风与地球磁场的邂逅',
        body: '极光是地球极区上空出现的一种绚丽发光现象。当太阳风中的带电粒子进入地球磁场后，与高层大气中的氧、氮等分子碰撞，释放出不同颜色的光。绿色极光由氧分子产生，红色和紫色则来自氮分子。',
        tags: ['自然', '极光', '天文'],
        summary: '极光是太阳风粒子与地球大气分子碰撞产生的发光现象。',
      },
    };

    // 健康系列
    const health: Record<string, any> = {
      '睡眠': {
        title: '睡眠的科学密码',
        subtitle: '你不知道的睡眠真相',
        body: '人一生约有三分之一时间在睡眠中度过。睡眠分为快速眼动期（REM）和非快速眼动期（NREM），一个完整周期约90分钟。深度睡眠期间身体修复细胞、巩固记忆；REM睡眠则与梦境和情绪调节密切相关。成年人每天需要7-9小时优质睡眠。',
        tags: ['健康', '睡眠', '科学'],
        summary: '睡眠分为REM和NREM周期，对记忆巩固和身体修复至关重要。',
      },
    };

    // 搜索匹配
    const allKnowledge = { ...solarTerms, ...culture, ...tech, ...nature, ...health };

    // 精确匹配
    for (const key of Object.keys(allKnowledge)) {
      if (lowerTopic.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerTopic)) {
        return allKnowledge[key];
      }
    }

    // 模糊匹配
    for (const key of Object.keys(allKnowledge)) {
      const keywords = key.split('');
      const matchCount = keywords.filter(k => lowerTopic.includes(k.toLowerCase())).length;
      if (matchCount >= Math.ceil(keywords.length / 2)) {
        return allKnowledge[key];
      }
    }

    // 默认生成（未命中知识库时的通用模板）
    return this.generateGenericContent(topic);
  }

  /**
   * 通用内容生成（未命中知识库时）
   */
  private generateGenericContent(topic: string) {
    return {
      title: topic,
      subtitle: '探索与发现',
      body: `${topic}是一个值得深入了解的话题。它涉及多个维度的知识体系，从基础概念到实际应用，都蕴含着丰富的内涵。通过系统性的学习，我们可以更好地理解其本质，并将其运用到实际生活中。`,
      tags: ['知识分享'],
      summary: `关于"${topic}"的通用知识卡片，涵盖基本概念和要点。`,
    };
  }

  /**
   * 根据内容和模板构建图片生成提示词（英文）
   */
  private buildImagePrompt(topic: string, knowledge: any, template?: CardTemplate): string {
    const styleMap: Record<string, string> = {
      guofeng: 'Chinese traditional ink painting style, rice paper texture, warm earth tones, elegant brushwork, traditional Chinese aesthetics',
      modern: 'modern futuristic digital art, dark background, neon glow, cyberpunk style, blue and purple color palette, sci-fi atmosphere',
      minimal: 'minimal flat illustration style, soft pastel colors, clean composition, hand-drawn feel, warm and bright tones',
    };

    const style = template ? (styleMap[template.category] || styleMap.minimal) : styleMap.minimal;
    const subject = this.translateSubject(topic);

    return `${subject}, ${style}, no text, no words, no letters, no watermark, no signature, centered composition, upper portion of frame, leaving space at bottom, high quality, 8K, detailed, masterpiece`;
  }

  /**
   * 简单的主题翻译（实际应用中应调用翻译API）
   */
  private translateSubject(topic: string): string {
    const translations: Record<string, string> = {
      '立春': 'spring blossoms, blooming flowers, willow branches, gentle spring breeze',
      '雨水': 'spring rain, raindrops on leaves, fresh green sprouts, misty landscape',
      '惊蛰': 'spring thunder, awakening nature, insects emerging, budding trees',
      '茶文化': 'Chinese tea ceremony, teapot, tea leaves, steam rising, zen atmosphere',
      '书法': 'Chinese calligraphy, ink brush, rice paper, ink stone, artistic strokes',
      '人工智能': 'artificial intelligence, neural network, glowing circuits, futuristic brain',
      '量子计算': 'quantum computing, quantum particles, glowing energy, abstract physics',
      '区块链': 'blockchain, digital network, connected nodes, abstract data flow',
      '深海': 'deep sea exploration, bioluminescent creatures, underwater scene, dark ocean',
      '极光': 'aurora borealis, northern lights, green and purple sky, snowy landscape',
      '睡眠': 'peaceful sleep, night sky, stars, crescent moon, dreaming',
    };

    for (const key of Object.keys(translations)) {
      if (topic.includes(key)) return translations[key];
    }
    return `illustration of ${topic}, conceptual art, symbolic representation`;
  }

  /**
   * 通义千问API调用
   * 文档：https://help.aliyun.com/document_detail/2546936.html
   */
  private async generateWithQianwen(topic: string, template?: CardTemplate): Promise<AIGeneratedContent> {
    const systemPrompt = this.buildSystemPrompt(template);
    const userPrompt = `请为以下主题生成一张知识卡片的内容：${topic}

要求：
1. 主标题：简短有力，不超过15字
2. 副标题：概括核心要点，不超过15字
3. 正文：80-120字，内容准确精炼，有知识性
4. 标签：2-3个相关标签
5. 配图提示词：用英文描述适合AI绘图的画面，不包含任何文字
6. 摘要：一句话概括知识点

请以JSON格式返回：
{"title":"","subtitle":"","body":"","tags":[],"imagePrompt":"","summary":""}`;

    const response = await fetch('/api/generate-content/qianwen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model || 'qwen-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        apiKey: this.config.apiKey,
      }),
    });

    if (!response.ok) throw new Error(`通义千问API调用失败: ${response.status}`);
    const data = await response.json();
    const text = data.output?.text || data.choices?.[0]?.message?.content || '';
    return this.parseAIResponse(text);
  }

  /**
   * DeepSeek API调用
   * 文档：https://platform.deepseek.com/api-docs/
   */
  private async generateWithDeepseek(topic: string, template?: CardTemplate): Promise<AIGeneratedContent> {
    const systemPrompt = this.buildSystemPrompt(template);
    const userPrompt = `请为主题"${topic}"生成知识卡片内容，返回JSON格式：{"title":"","subtitle":"","body":"","tags":[],"imagePrompt":"","summary":""}`;

    const response = await fetch('/api/generate-content/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        apiKey: this.config.apiKey,
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek API调用失败: ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return this.parseAIResponse(text);
  }

  /**
   * 智谱AI API调用
   * 文档：https://open.bigmodel.cn/dev/api
   */
  private async generateWithZhipu(topic: string, template?: CardTemplate): Promise<AIGeneratedContent> {
    const systemPrompt = this.buildSystemPrompt(template);
    const userPrompt = `请为主题"${topic}"生成知识卡片内容，返回JSON格式：{"title":"","subtitle":"","body":"","tags":[],"imagePrompt":"","summary":""}`;

    const response = await fetch('/api/generate-content/zhipu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model || 'glm-4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        apiKey: this.config.apiKey,
      }),
    });

    if (!response.ok) throw new Error(`智谱API调用失败: ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return this.parseAIResponse(text);
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(template?: CardTemplate): string {
    const templateDesc = template ? `当前使用的卡片模板风格为"${template.name}"，配图应匹配此风格。` : '';
    return `你是一个知识卡片内容生成专家。${templateDesc}你会根据用户给出的主题，搜索相关知识，生成结构化的知识卡片内容。
要求：
1. 内容准确、有深度、有知识性
2. 标题简短有力
3. 正文精炼（80-120字）
4. 配图提示词必须用英文，描述适合AI绘图的画面，不包含任何文字内容
5. 严格按照JSON格式返回`;
  }

  /**
   * 解析AI返回的内容（兼容多种格式）
   */
  private parseAIResponse(text: string): AIGeneratedContent {
    // 尝试提取JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || '',
          subtitle: parsed.subtitle || '',
          body: parsed.body || '',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          imagePrompt: parsed.imagePrompt || '',
          summary: parsed.summary || '',
        };
      } catch {
        // JSON解析失败，继续使用默认值
      }
    }

    // 如果无法解析JSON，返回原始文本作为body
    return {
      title: 'AI生成内容',
      subtitle: '',
      body: text.slice(0, 200),
      tags: [],
      imagePrompt: '',
      summary: text.slice(0, 50),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AITextConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 延迟工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
