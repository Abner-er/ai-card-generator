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
 */
export class CardDesignService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  updateConfig(config: AIConfig) {
    this.config = config;
  }

  async designCard(
    imageUrl: string,
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    cardTotal: number,
    onProgress: (stage: WorkflowStage, stageNum: StageNumber, cardId: number) => void,
  ): Promise<CardDesignOutput> {
    onProgress('designing-card', 4.5, cardIndex);
    const composition = await this.analyzeComposition(imageUrl, cardIndex, cardTotal);
    const design = await this.generateCardDesign(composition, knowledge, content, stylePreset, cardIndex, imageUrl);
    return design;
  }

  private async analyzeComposition(
    imageUrl: string,
    cardIndex: number,
    cardTotal: number,
  ): Promise<{ subjectPosition: string; emptySpace: string; dominantColor: string; mood: string }> {
    const systemPrompt = `You are a professional art director analyzing illustration compositions for knowledge cards.
Analyze the visual composition of the image and return a JSON with:
- subjectPosition: where the main subject is (left/right/center/top/bottom/scattered)
- emptySpace: where the largest empty space is (left/right/top/bottom/scattered)
- dominantColor: the main color (hex or color name)
- mood: overall mood (serene/energetic/dramatic/peaceful/vibrant/mysterious)
Output ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `Card ${cardIndex + 1} of ${cardTotal}. Focus on: subject placement, negative space, dominant color, mood.`;

    try {
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
          max_tokens: 400,
          temperature: 0.3,
        }),
      });
      if (!response.ok) throw new Error(`Vision API error: ${response.status}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      const parsed = this.parseJSON(text);
      if (parsed && parsed.subjectPosition && parsed.emptySpace) {
        return parsed as any;
      }
    } catch (err) {
      console.warn('[CardDesignService] Vision analysis failed:', err);
    }
    return { subjectPosition: 'right', emptySpace: 'left', dominantColor: '#f5f0e6', mood: 'serene' };
  }

  private async generateCardDesign(
    composition: { subjectPosition: string; emptySpace: string; dominantColor: string; mood: string },
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    imageUrl: string,
  ): Promise<CardDesignOutput> {
    const emptySpace = composition.emptySpace || 'left';
    const dominantColor = composition.dominantColor || '#f5f0e6';
    const mood = composition.mood || 'serene';

    const layoutMap: Record<string, string> = {
      left: 'right-text', right: 'left-text',
      top: 'bottom-text', bottom: 'bottom-text',
      center: 'floating', scattered: 'split',
    };
    const layout = layoutMap[emptySpace] || 'right-text';

    const knowledgeSummary = this.buildKnowledgeSummary(knowledge, cardIndex);
    // 截断摘要，避免超出 token 限制
    const truncatedSummary = knowledgeSummary.length > 600 ? knowledgeSummary.substring(0, 600) + '...' : knowledgeSummary;
    // 截断标题/正文
    const title = (content.title || '').substring(0, 50);
    const body = (content.body || '').substring(0, 200);
    const tags = ((content.tags || []).slice(0, 5).join(', ') || '').substring(0, 100);
    const footer = (content.footer || '').substring(0, 50);

    const systemPrompt = `You are a senior knowledge card designer. Transform knowledge data into a beautiful, concise HTML card.

Tasks:
1. Extract 2-3 key points (max 20 Chinese chars each, most surprising facts)
2. Polish title to 6-10 chars, subtitle to 1-2 sentences, body to 1-2 sentences
3. Design HTML card based on image composition

Layout rules:
- empty space LEFT → text left, image right
- empty space RIGHT → image left, text right  
- empty space BOTTOM → image top, text overlay bottom
- empty space CENTER → image full bg, floating text card

Topic: ${knowledge.englishTopic || knowledge.topic}
Style: ${stylePreset.id} (${stylePreset.name}), Mood: ${mood}, Color: ${dominantColor}, Layout: ${layout}

Knowledge Data:
${truncatedSummary}

Card Content:
Title: ${title}
Subtitle: ${content.subtitle || ''}
Body: ${body}
Tags: ${tags}
Footer: ${footer}

Output ONLY valid JSON:
{
  "title": "polished 6-10 char title",
  "subtitle": "polished 1-2 sentence hook",
  "body": "polished 1-2 sentences",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "html": "<div class=\"w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-2xl\">...</div>",
  "colors": { "bg": "hex", "text": "hex", "accent": "hex", "secondary": "hex" },
  "layout": "${layout}",
  "designDescription": "one sentence"
}`;

    try {
      const response = await fetch('/ai-api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.textModel || 'agnes-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '' },
          ],
          max_tokens: 1500,
          temperature: 0.5,
        }),
      });
      console.log('[CardDesignService] Text API status:', response.status);
      if (!response.ok) {
        const errText = await response.text();
        console.warn('[CardDesignService] Text API error:', errText.substring(0, 200));
        throw new Error(`Text API error: ${response.status}`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      console.log('[CardDesignService] AI response (first 200):', text.substring(0, 200));
      const parsed = this.parseDesignJSON(text);
      console.log('[CardDesignService] Parsed:', parsed ? `success, html len=${parsed.html?.length}` : 'failed');
      if (parsed && parsed.html && parsed.colors) return parsed;
    } catch (err) {
      console.warn('[CardDesignService] Design generation failed:', err);
    }
    return this.generateFallbackDesign(content, layout, dominantColor, knowledge, imageUrl);
  }

  private buildKnowledgeSummary(knowledge: KnowledgeBase, cardIndex: number): string {
    const lines: string[] = [];
    if (knowledge.summary) lines.push(`Summary: ${knowledge.summary}`);
    if (knowledge.category) lines.push(`Category: ${knowledge.category}`);

    const facts = knowledge.facts || [];
    const keyPoints = knowledge.keyPoints || [];
    const lifecycleStages = knowledge.lifecycleStages || [];
    const timelineEvents = knowledge.timelineEvents || [];
    const processSteps = knowledge.processSteps || [];

    if (lifecycleStages.length > 0 && cardIndex < lifecycleStages.length) {
      const s = lifecycleStages[cardIndex];
      lines.push(`Stage: ${s.name} (${s.period})`);
      lines.push(`Desc: ${s.description || ''}`);
      lines.push(`Features: ${(s.features || []).join(', ')}`);
    } else if (timelineEvents.length > 0 && cardIndex < timelineEvents.length) {
      const e = timelineEvents[cardIndex];
      lines.push(`Event: ${e.title} (${e.year})`);
      lines.push(`Desc: ${e.description || ''}`);
      lines.push(`Significance: ${e.significance || ''}`);
    } else if (processSteps.length > 0 && cardIndex < processSteps.length) {
      const s = processSteps[cardIndex];
      lines.push(`Step ${s.order}: ${s.title}`);
      lines.push(`Desc: ${s.description || ''}`);
      lines.push(`Tip: ${s.tip || ''}`);
    } else {
      const topFacts = facts.slice(0, 3).map((f: any) => `• ${f.label}: ${f.value}`).join('\n');
      const topPoints = keyPoints.slice(0, 3).join('\n');
      if (topFacts) lines.push(`Facts:\n${topFacts}`);
      if (topPoints) lines.push(`Points:\n${topPoints}`);
    }

    const tags = knowledge.tags || [];
    if (tags.length > 0) lines.push(`Tags: ${tags.slice(0, 5).join(', ')}`);

    return lines.join('\n') || 'No additional knowledge data';
  }

  private parseDesignJSON(text: string): CardDesignOutput & { title?: string; subtitle?: string; body?: string; keyPoints?: string[] } | null {
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

  private parseJSON(text: string): Record<string, unknown> | null {
    try { return JSON.parse(text); } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { try { return JSON.parse(match[0]); } catch { return null; } }
      return null;
    }
  }

  private generateFallbackDesign(
    content: CardContent,
    layout: string,
    dominantColor: string,
    knowledge: KnowledgeBase,
    imageUrl: string,
  ): CardDesignOutput {
    const topic = knowledge.englishTopic || knowledge.topic;
    const tags = (content.tags || []).slice(0, 5);
    const body = (content.body || '').substring(0, 100);
    const footer = (content.footer || '').substring(0, 50);
    // 不要用 base64 图片，用原始 URL 或占位符
    const imgSrc = imageUrl.startsWith('data:') ? '/placeholder.jpg' : imageUrl;

    let html = '';
    if (layout === 'left-text' || layout === 'right-text') {
      html = `
        <div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
          <div class="relative w-full h-[200px] overflow-hidden">
            <img src="${imgSrc}" alt="${topic}" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
          </div>
          <div class="px-3 py-2 flex-1 flex flex-col gap-1.5 bg-[${dominantColor}]">
            <h3 class="text-xs font-bold text-gray-900 leading-tight">${content.title || topic}</h3>
            <p class="text-[10px] text-gray-600 leading-relaxed flex-1 overflow-hidden">${body}</p>
            ${tags.length > 0 ? `<div class="flex flex-wrap gap-1">${tags.map((t: string) => `<span class="text-[8px] px-1.5 py-0.5 rounded-full bg-white/60 text-gray-500">${t.trim()}</span>`).join('')}</div>` : ''}
            ${footer ? `<p class="text-[8px] text-gray-400 italic">${footer}</p>` : ''}
          </div>
        </div>`;
    } else {
      html = `
        <div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
          <div class="relative w-full h-full">
            <img src="${imgSrc}" alt="${topic}" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            <div class="absolute inset-x-0 bottom-0 p-3">
              <h3 class="text-white text-sm font-bold leading-tight mb-1">${content.title || topic}</h3>
              <p class="text-white/80 text-[10px] leading-relaxed mb-2">${body}</p>
              ${tags.length > 0 ? `<div class="flex flex-wrap gap-1">${tags.map((t: string) => `<span class="text-[8px] px-1.5 py-0.5 rounded-full bg-white/20 text-white">${t.trim()}</span>`).join('')}</div>` : ''}
            </div>
          </div>
        </div>`;
    }

    return {
      layout: layout as CardDesignOutput['layout'],
      colors: { bg: dominantColor, text: '#1f2937', accent: '#6366f1', secondary: '#6b7280' },
      html,
      designDescription: `Fallback: ${layout} layout, color ${dominantColor}`,
    };
  }
}
