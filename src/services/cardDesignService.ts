import type {
  KnowledgeBase,
  CardContent,
  StylePreset,
  CardDesignOutput,
  WorkflowStage,
  StageNumber,
  AIConfig,
} from '../types';

/**
 * Stage 4.5 — AI 卡片设计服务
 *
 * 核心流程：
 * 1. Vision API 分析图片构图（主体位置 / 留白区域 / 主色调 / 氛围）
 * 2. AI 提炼简化知识内容（2-3个关键要点，每条一句话）
 * 3. AI 基于构图 + 简化内容 → 生成美化自适应 HTML 卡片
 *
 * 与固定模板的核心区别：每张卡片的布局、配色、层次都由 AI 根据图片内容自主决定
 */
export class CardDesignService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  updateConfig(config: AIConfig) {
    this.config = config;
  }

  /**
   * 核心方法：基于图片和知识数据生成 AI 卡片设计
   * 输出：完整的 HTML 卡片 + 布局信息 + 配色方案
   */
  async designCard(
    imageUrl: string,
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    cardTotal: number,
    onProgress: (stage: WorkflowStage, stageNum: StageNumber, cardId: number) => void,
  ): Promise<CardDesignOutput> {
    // Step 1: 用 vision API 分析图片构图
    onProgress('designing-card', 4.5, cardIndex);

    const composition = await this.analyzeComposition(imageUrl, cardIndex, cardTotal);

    // Step 2: 基于分析结果生成卡片设计（含知识提炼 + HTML 生成）
    const design = await this.generateCardDesign(composition, knowledge, content, stylePreset, cardIndex, imageUrl);

    return design;
  }

  /**
   * Step 1: 分析图片构图
   */
  private async analyzeComposition(
    imageUrl: string,
    cardIndex: number,
    cardTotal: number,
  ): Promise<{
    subjectPosition: string;
    emptySpace: string;
    dominantColor: string;
    mood: string;
  }> {
    const systemPrompt = `You are a professional art director analyzing illustration compositions for knowledge cards.

Analyze the visual composition of the image and return a JSON with:
- subjectPosition: where the main subject is located (left/right/center/top/bottom/scattered)
- emptySpace: where the largest empty/negative space is (left/right/top/bottom/scattered)
- dominantColor: the main color of the image (hex or color name)
- mood: the overall mood (serene/energetic/dramatic/peaceful/vibrant/mysterious)

Output ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `Analyze the composition of this knowledge card illustration.
Card ${cardIndex + 1} of ${cardTotal} in the series.
Focus on: subject placement, negative space distribution, dominant color, and overall mood.`;

    try {
      const response = await this.callVisionAPI(systemPrompt, userPrompt, imageUrl);
      const parsed = this.parseJSON(response);
      if (parsed && parsed.subjectPosition && parsed.emptySpace) {
        return parsed as {
          subjectPosition: string;
          emptySpace: string;
          dominantColor: string;
          mood: string;
        };
      }
    } catch (err) {
      console.warn('[CardDesignService] Vision analysis failed:', err);
    }

    return {
      subjectPosition: 'right',
      emptySpace: 'left',
      dominantColor: '#f5f0e6',
      mood: 'serene',
    };
  }

  /**
   * Step 2: 提炼知识内容 + 生成美化 HTML
   * AI 角色：知识编辑 + 视觉设计师
   */
  private async generateCardDesign(
    composition: {
      subjectPosition: string;
      emptySpace: string;
      dominantColor: string;
      mood: string;
    },
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    imageUrl: string,
  ): Promise<CardDesignOutput> {
    const emptySpace = composition.emptySpace || 'left';
    const dominantColor = composition.dominantColor || '#f5f0e6';
    const mood = composition.mood || 'serene';

    // 根据 emptySpace 决定布局类型
    const layoutMap: Record<string, string> = {
      left: 'right-text',
      right: 'left-text',
      top: 'bottom-text',
      bottom: 'bottom-text',
      center: 'floating',
      scattered: 'split',
    };
    const layout = layoutMap[emptySpace] || 'right-text';

    // 准备知识数据摘要（只传最相关的数据给 AI）
    const knowledgeSummary = this.buildKnowledgeSummary(knowledge, cardIndex);

    const systemPrompt = `You are a senior knowledge card designer and editor.
Your job is to take raw knowledge data and transform it into a beautiful, concise knowledge card.

## Your Tasks:

### 1. Extract & Simplify Key Points
From the knowledge data, extract 2-3 most important key points.
Each key point should be:
- One concise sentence (max 20 characters in Chinese)
- Easy to understand at a glance
- The most surprising or interesting fact
- No jargon or technical terms

### 2. Polish the Title & Subtitle
- Title: 6-10 characters, punchy and memorable
- Subtitle: 1-2 sentences that hook the reader

### 3. Polish the Body
- 1-2 sentences, conversational and engaging
- Use analogies or comparisons if helpful
- Never just repeat the title

### 4. Design the Card
Based on the image composition, create a beautiful HTML card.
Layout rules based on where the empty space is in the image:
- empty space LEFT → text on left, image on right
- empty space RIGHT → image on left, text on right
- empty space BOTTOM → image on top, text overlay at bottom
- empty space CENTER → image as full background, floating text card

## Current Card Info:
- Topic: ${knowledge.englishTopic || knowledge.topic}
- Style preset: ${stylePreset.id} (${stylePreset.name})
- Mood: ${mood}
- Dominant color: ${dominantColor}
- Layout: ${layout}

## Raw Knowledge Data:
${knowledgeSummary}

## Raw Card Content:
- Title: ${content.title}
- Subtitle: ${content.subtitle}
- Body: ${content.body}
- Tags: ${(content.tags || []).join(', ')}
- Footer: ${content.footer}

## Output Format:
Return ONLY valid JSON, no markdown, no explanation:
{
  "title": "polished 6-10 char title",
  "subtitle": "polished 1-2 sentence hook",
  "body": "polished 1-2 sentences, conversational",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "html": "<complete HTML card div using Tailwind CSS, 270x360px, no html/head/body tags>",
  "colors": {
    "bg": "hex color",
    "text": "hex color",
    "accent": "hex color",
    "secondary": "hex color"
  },
  "layout": "${layout}",
  "designDescription": "one sentence explaining the design choice"
}`;

    try {
      const response = await this.callTextAPI(systemPrompt, '');
      console.log('[CardDesignService] AI response (first 200 chars):', response.substring(0, 200));
      const parsed = this.parseDesignJSON(response);
      console.log('[CardDesignService] Parsed design:', parsed ? 'success' : 'failed', parsed?.html ? `html length: ${parsed.html.length}` : 'no html');
      if (parsed && parsed.html && parsed.colors) {
        return parsed;
      }
    } catch (err) {
      console.warn('[CardDesignService] Design generation failed:', err);
    }

    console.warn('[CardDesignService] Using fallback design');
    // Fallback
    return this.generateFallbackDesign(content, layout, dominantColor, knowledge, imageUrl);
  }

  /**
   * 构建知识数据摘要（根据卡片索引选择最相关的数据）
   */
  private buildKnowledgeSummary(knowledge: KnowledgeBase, cardIndex: number): string {
    const lines: string[] = [];

    if (knowledge.summary) lines.push(`Summary: ${knowledge.summary}`);
    if (knowledge.category) lines.push(`Category: ${knowledge.category}`);

    // 根据卡片索引选择最相关的结构化数据
    const facts = knowledge.facts || [];
    const keyPoints = knowledge.keyPoints || [];
    const lifecycleStages = knowledge.lifecycleStages || [];
    const timelineEvents = knowledge.timelineEvents || [];
    const processSteps = knowledge.processSteps || [];

    if (lifecycleStages.length > 0 && cardIndex < lifecycleStages.length) {
      const s = lifecycleStages[cardIndex];
      lines.push(`Life Stage: ${s.name} (${s.period})`);
      lines.push(`Description: ${s.description || ''}`);
      lines.push(`Features: ${(s.features || []).join(', ')}`);
    } else if (timelineEvents.length > 0 && cardIndex < timelineEvents.length) {
      const e = timelineEvents[cardIndex];
      lines.push(`Event: ${e.title} (${e.year})`);
      lines.push(`Description: ${e.description || ''}`);
      lines.push(`Significance: ${e.significance || ''}`);
    } else if (processSteps.length > 0 && cardIndex < processSteps.length) {
      const s = processSteps[cardIndex];
      lines.push(`Step ${s.order}: ${s.title}`);
      lines.push(`Description: ${s.description || ''}`);
      lines.push(`Tip: ${s.tip || ''}`);
    } else {
      // 取前 3 个 facts 和 keyPoints
      const topFacts = facts.slice(0, 3).map((f: { label: string; value: string }) =>
        `• ${f.label}: ${f.value}`
      ).join('\n');
      const topPoints = keyPoints.slice(0, 3).join('\n');
      if (topFacts) lines.push(`Key Facts:\n${topFacts}`);
      if (topPoints) lines.push(`Key Points:\n${topPoints}`);
    }

    // Tags
    const tags = knowledge.tags || [];
    if (tags.length > 0) lines.push(`Tags: ${tags.slice(0, 5).join(', ')}`);

    return lines.join('\n') || 'No additional knowledge data available';
  }

  /**
   * 调用 Vision API（文本模型 + 图片）
   */
  private async callVisionAPI(systemPrompt: string, userPrompt: string, imageUrl: string): Promise<string> {
    const response = await fetch('/ai-api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'agnes-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`Vision API error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 调用文本 API（用于卡片设计生成）
   */
  private async callTextAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch('/ai-api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.textModel || 'agnes-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.5,
      }),
    });

    if (!response.ok) throw new Error(`Text API error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 解析设计 JSON（允许 markdown 代码块包裹）
   */
  private parseDesignJSON(text: string): CardDesignOutput & {
    title?: string;
    subtitle?: string;
    body?: string;
    keyPoints?: string[];
  } | null {
    try {
      const parsed = JSON.parse(text);
      if (parsed.html && parsed.colors) return parsed;
    } catch { /* ignore */ }

    const match = text.match(/\{[\s\S]*"html"[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.html && parsed.colors) return parsed;
      } catch {}
    }

    return null;
  }

  /**
   * 解析普通 JSON（用于 composition 分析）
   */
  private parseJSON(text: string): Record<string, unknown> | null {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { return null; }
      }
      return null;
    }
  }

  /**
   * Fallback: 生成基础卡片 HTML
   */
  private generateFallbackDesign(
    content: CardContent,
    layout: string,
    dominantColor: string,
    knowledge: KnowledgeBase,
    imageUrl: string,
  ): CardDesignOutput {
    const topic = knowledge.englishTopic || knowledge.topic;
    const tags = (content.tags || []).join(', ');
    const body = content.body || '';
    const footer = content.footer || '';

    let html = '';
    if (layout === 'left-text' || layout === 'right-text') {
      const imgSide = layout === 'right-text' ? 'order-2' : 'order-1';
      const textSide = layout === 'right-text' ? 'order-1' : 'order-2';
      html = `
        <div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
          <div class="relative w-full h-[220px] overflow-hidden">
            <img src="${imageUrl}" alt="${topic}" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
          </div>
          <div class="px-4 py-3 flex-1 flex flex-col gap-2 bg-[${dominantColor}]">
            <h3 class="text-sm font-bold text-gray-900 leading-tight">${content.title || topic}</h3>
            <p class="text-xs text-gray-600 leading-relaxed flex-1 overflow-hidden">${body}</p>
            ${tags ? `<div class="flex flex-wrap gap-1">${tags.split(',').map((t: string) => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-gray-500 font-medium">${t.trim()}</span>`).join('')}</div>` : ''}
            ${footer ? `<p class="text-[10px] text-gray-400 italic">${footer}</p>` : ''}
          </div>
        </div>`;
    } else {
      html = `
        <div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
          <div class="relative w-full h-full">
            <img src="${imageUrl}" alt="${topic}" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            <div class="absolute inset-x-0 bottom-0 p-4">
              <h3 class="text-white text-base font-bold leading-tight mb-1">${content.title || topic}</h3>
              <p class="text-white/80 text-xs leading-relaxed mb-2">${body}</p>
              ${tags ? `<div class="flex flex-wrap gap-1">${tags.split(',').map((t: string) => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">${t.trim()}</span>`).join('')}</div>` : ''}
            </div>
          </div>
        </div>`;
    }

    return {
      layout: layout as CardDesignOutput['layout'],
      colors: {
        bg: dominantColor,
        text: '#1f2937',
        accent: '#6366f1',
        secondary: '#6b7280',
      },
      html,
      designDescription: `Fallback design: ${layout} layout based on dominant color ${dominantColor}`,
    };
  }
}
