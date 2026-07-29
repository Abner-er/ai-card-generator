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
      '运动': {
        title: '科学运动指南',
        subtitle: '让身体更高效地运转',
        body: '规律运动能增强心肺功能、提高代谢率、改善心理状态。世界卫生组织建议成年人每周进行150分钟中等强度有氧运动或75分钟高强度运动。运动时心率达到最大心率的60-80%为最佳燃脂区间。运动后30分钟内补充蛋白质有助于肌肉恢复。',
        tags: ['健康', '运动', '科学'],
        summary: 'WHO建议每周150分钟中等强度运动，有助于心肺和代谢健康。',
      },
      '饮食': {
        title: '均衡饮食的智慧',
        subtitle: '吃对食物，吃出健康',
        body: '均衡饮食是健康的基石。中国居民膳食指南建议：每天摄入12种以上食物，每周25种以上。谷物为主食，蔬菜水果每天各300-500克，适量摄入鱼禽蛋奶。减少盐（<5克/天）、油（25-30克/天）和糖的摄入。食物多样化、适量搭配是核心原则。',
        tags: ['健康', '饮食', '营养'],
        summary: '均衡饮食要求每天12种以上食物，谷物为主，少盐少油少糖。',
      },
    };

    // 自然地理系列
    const geography: Record<string, any> = {
      '珠穆朗玛峰': {
        title: '珠穆朗玛峰',
        subtitle: '地球之巅的壮丽与挑战',
        body: '珠穆朗玛峰海拔8848.86米，是世界最高峰，位于中国与尼泊尔边境。藏语中"珠穆"意为女神，"朗玛"意为母象。每年约有800人尝试登顶，但成功者不足一半。高海拔带来的缺氧、严寒和暴风雪是最大挑战。2020年中国测量队最新测得高度为8848.86米。',
        tags: ['自然', '地理', '探索'],
        summary: '珠穆朗玛峰海拔8848.86米，是世界最高峰，登顶成功率不足一半。',
      },
      '沙漠': {
        title: '沙漠的奥秘',
        subtitle: '干旱之地的生命奇迹',
        body: '沙漠占地球陆地面积约33%。最大的沙漠是南极沙漠（约1400万平方公里），最大的热沙漠是撒哈拉沙漠（约900万平方公里）。沙漠昼夜温差可达40°C以上。仙人掌、骆驼等生物通过特殊适应机制在极端环境中生存。沙漠也是太阳能和风能的丰富来源。',
        tags: ['自然', '地理', '生态'],
        summary: '沙漠占陆地33%，昼夜温差大，生物有独特适应机制。',
      },
      '火山': {
        title: '火山的力量',
        subtitle: '地球内部的窗口',
        body: '火山是地球内部岩浆喷发到地表的地质现象。全球约有1500座活火山，主要分布在环太平洋火山带。火山喷发虽具破坏性，但也形成肥沃土壤和地热资源。黄石超级火山是世界上最大的活火山之一，其火山口面积达2500平方公里。',
        tags: ['自然', '地质', '地理'],
        summary: '全球约1500座活火山，主要分布在环太平洋火山带。',
      },
    };

    // 历史人文系列
    const history: Record<string, any> = {
      '丝绸之路': {
        title: '丝绸之路',
        subtitle: '连接东西方的千年古道',
        body: '丝绸之路是古代连接亚欧大陆的贸易网络，全长约7000公里。始于汉代张骞出使西域（公元前138年），繁荣于唐代。不仅运输丝绸、瓷器、茶叶，更促进了佛教、伊斯兰教等文化和技术的传播。2014年，丝绸之路长安-天山廊道路网被列入世界文化遗产。',
        tags: ['历史', '文化', '丝绸之路'],
        summary: '丝绸之路始于汉代，全长约7000公里，是东西方文化与贸易的桥梁。',
      },
      '敦煌': {
        title: '敦煌莫高窟',
        subtitle: '沙漠中的艺术宝库',
        body: '敦煌莫高窟始建于公元366年，历经十六国、北朝、隋唐等千年营造。现存洞窟735个，壁画45000平方米，彩塑2400余尊。飞天壁画是敦煌最具代表性的艺术形象。1900年发现的藏经洞出土了5万余件文献，催生了"敦煌学"。1987年列入世界文化遗产。',
        tags: ['历史', '艺术', '敦煌'],
        summary: '莫高窟始建于366年，有壁画45000平方米，是世界文化遗产。',
      },
      '长城': {
        title: '万里长城',
        subtitle: '中华文明的脊梁',
        body: '长城是中国古代军事防御工程，东起山海关，西至嘉峪关，全长21196公里。秦朝连接各国长城形成统一防线，明朝进行了大规模重建。长城由城墙、烽火台、关隘等组成，是世界上最长的人造工程。1987年被列入世界文化遗产。',
        tags: ['历史', '建筑', '长城'],
        summary: '长城全长21196公里，是世界上最长的人造工程和世界文化遗产。',
      },
    };

    // 艺术系列
    const art: Record<string, any> = {
      '国画': {
        title: '中国画艺术',
        subtitle: '水墨丹青中的东方美学',
        body: '中国画以毛笔、水墨为主要工具，讲究"气韵生动"和"以形写神"。分为山水、花鸟、人物三大画科。工笔重彩细腻精致，写意水墨潇洒奔放。从顾恺之的《洛神赋图》到张大千的泼彩山水，中国画传承千年，形成了独特的审美体系。',
        tags: ['艺术', '国画', '传统文化'],
        summary: '中国画分山水、花鸟、人物三科，讲究气韵生动和以形写神。',
      },
      '京剧': {
        title: '京剧艺术',
        subtitle: '国粹的魅力与传承',
        body: '京剧是中国最具影响力的戏曲剧种，形成于清代乾隆年间。生旦净丑四大行当各具特色，唱念做打四功并举。脸谱颜色寓意不同性格：红表忠勇、黑表刚直、白表奸诈。梅兰芳等大师将京剧推向世界。2010年京剧被列入联合国非物质文化遗产名录。',
        tags: ['艺术', '京剧', '传统文化'],
        summary: '京剧形成于清代，有生旦净丑四行当，是联合国非物质文化遗产。',
      },
    };

    // 搜索匹配
    const allKnowledge = { ...solarTerms, ...culture, ...tech, ...nature, ...health, ...geography, ...history, ...art };

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
      '运动': 'athletic running, dynamic movement, energy, sports, fitness',
      '饮食': 'healthy food, fresh vegetables, fruits, balanced meal, nutrition',
      '珠穆朗玛峰': 'mount everest, snow peak, himalaya mountains, clouds, majestic summit',
      '沙漠': 'desert landscape, sand dunes, oasis, camel, golden sand',
      '火山': 'volcanic eruption, lava flow, smoke, dramatic sky, geological force',
      '丝绸之路': 'silk road, ancient trade route, desert caravan, camels, sunset',
      '敦煌': 'dunhuang mogao caves, ancient buddhist art, desert temple, flying apsaras',
      '长城': 'great wall of china, ancient fortress, mountain ridge, misty landscape',
      '国画': 'chinese painting, ink wash, mountain landscape, bamboo, traditional art',
      '京剧': 'peking opera, chinese opera mask, stage performance, traditional costume',
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
