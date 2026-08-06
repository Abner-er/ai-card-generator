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
 * 两阶段设计流程：
 * 1. AI 提炼简化文字（标题/正文/关键要点）
 * 2. 根据图片和样式，本地生成美化 HTML
 *
 * 每张卡片独一无二：不同的布局、配色、层次
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

    // Step 1: AI 提炼简化文字
    const refinedText = await this.refineText(knowledge, content, stylePreset, cardIndex, cardTotal);

    // Step 2: 本地生成 HTML（根据图片 + 样式）
    const design = this.generateHtml(refinedText, knowledge, content, stylePreset, cardIndex, imageUrl);

    return design;
  }

  // ==================== Step 1: AI 提炼文字 ====================

  private async refineText(
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    cardTotal: number,
  ): Promise<{ title: string; subtitle: string; body: string; keyPoints: string[] }> {
    const topic = knowledge.englishTopic || knowledge.topic;
    const title = (content.title || topic).substring(0, 30);
    const body = (content.body || '').substring(0, 150);
    const tags = (content.tags || []).slice(0, 5).join(', ');

    const systemPrompt = `You are a knowledge card editor. Your job is to make information concise and engaging.

Rules:
- Title: 6-12 Chinese characters, catchy and clear
- Subtitle: 1 sentence (15-30 chars) that hooks the reader
- Body: 1-2 sentences (20-50 chars), conversational, use analogy if possible
- Key points: exactly 2-3 points, each 8-15 Chinese characters, most interesting facts

Output ONLY valid JSON, no markdown:
{"title": "...", "subtitle": "...", "body": "...", "keyPoints": ["...", "...", "..."]}`;

    const userPrompt = `Topic: ${topic}
Style: ${stylePreset.name}
Current Title: ${title}
Current Body: ${body}
Tags: ${tags}
Knowledge Summary: ${knowledge.summary || 'No summary'}

Refine this into a beautiful knowledge card.`;

    try {
      const response = await fetch('/ai-api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.textModel || 'agnes-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.5,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      console.log('[CardDesign] Refined text:', text.substring(0, 150));

      // Parse JSON - try direct parse first
      const parsed = this.parseJSON(text);
      if (parsed && parsed.title && parsed.body) {
        return {
          title: parsed.title,
          subtitle: parsed.subtitle || content.subtitle || '',
          body: parsed.body,
          keyPoints: parsed.keyPoints || [],
        };
      }
    } catch (err) {
      console.warn('[CardDesign] Text refinement failed:', err);
    }

    // Fallback: use original content
    return {
      title: content.title || topic,
      subtitle: content.subtitle || '',
      body: content.body || '',
      keyPoints: (knowledge.keyPoints || []).slice(0, 3),
    };
  }

  // ==================== Step 2: 本地生成 HTML ====================

  private generateHtml(
    refined: { title: string; subtitle: string; body: string; keyPoints: string[] },
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    imageUrl: string,
  ): CardDesignOutput {
    const topic = knowledge.englishTopic || knowledge.topic;
    const tags = (content.tags || []).slice(0, 5);
    const footer = (knowledge.englishTopic || topic) + (knowledge.category ? ` · ${knowledge.category}` : '');
    const imgSrc = imageUrl.startsWith('data:') ? imageUrl : (imageUrl || '/placeholder.jpg');

    // 根据 stylePreset 选择配色和布局
    const theme = this.getTheme(stylePreset.id);

    // 根据卡片索引选择不同布局（让每张卡独一无二）
    const layouts = ['text-left', 'text-right', 'text-bottom', 'text-floating', 'split'];
    const layout = layouts[cardIndex % layouts.length];

    // 根据布局生成 HTML
    let html = '';
    const accentColor = theme.accent;
    const bgColor = theme.bg;
    const textColor = theme.text;
    const subColor = theme.secondary;

    switch (layout) {
      case 'text-left':
        html = this.renderTextLeft(imgSrc, refined, tags, footer, theme);
        break;
      case 'text-right':
        html = this.renderTextRight(imgSrc, refined, tags, footer, theme);
        break;
      case 'text-bottom':
        html = this.renderTextBottom(imgSrc, refined, tags, footer, theme);
        break;
      case 'text-floating':
        html = this.renderTextFloating(imgSrc, refined, tags, footer, theme);
        break;
      case 'split':
        html = this.renderSplit(imgSrc, refined, tags, footer, theme);
        break;
    }

    return {
      layout: layout as CardDesignOutput['layout'],
      colors: { bg: bgColor, text: textColor, accent: accentColor, secondary: subColor },
      html,
      designDescription: `${layout} layout with ${theme.name} theme`,
    };
  }

  // ==================== 布局渲染器 ====================

  private renderTextLeft(imgSrc: string, refined: any, tags: string[], footer: string, theme: any): string {
    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl flex relative" style="background:${theme.bg}">
  <div class="absolute left-0 top-0 w-[140px] h-[260px]">
    <img src="${imgSrc}" class="w-full h-full object-cover" />
  </div>
  <div class="ml-[135px] pt-2 pr-2 pb-2 flex flex-col justify-between" style="min-height:360px">
    <div>
      <div class="text-[9px] font-bold mb-0.5" style="color:${theme.accent}"># ${refined.title}</div>
      <h3 class="text-[11px] font-bold leading-tight mb-1" style="color:${theme.text}">${refined.title}</h3>
      <p class="text-[8px] leading-relaxed mb-1.5" style="color:${theme.secondary}">${refined.body}</p>
    </div>
    <div>
      ${refined.keyPoints?.length > 0 ? `<div class="mb-1">${refined.keyPoints.slice(0, 2).map((p: string) => `<div class="text-[7px] mb-0.3" style="color:${theme.text}">· ${p}</div>`).join('')}</div>` : ''}
      ${tags.length > 0 ? `<div class="flex flex-wrap gap-0.5 mb-1">${tags.map((t: string) => `<span class="text-[6px] px-1 py-0.5 rounded-full" style="background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>` : ''}
      <div class="text-[6px]" style="color:${theme.secondary}">${footer}</div>
    </div>
  </div>
</div>`;
  }

  private renderTextRight(imgSrc: string, refined: any, tags: string[], footer: string, theme: any): string {
    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl flex relative" style="background:${theme.bg}">
  <div class="relative w-full h-[160px]">
    <img src="${imgSrc}" class="w-full h-full object-cover" />
    <div class="absolute inset-0" style="background:linear-gradient(to bottom, transparent 40%, ${theme.bg})"></div>
  </div>
  <div class="px-2 py-1.5 flex-1 flex flex-col justify-between">
    <div>
      <div class="text-[8px] font-bold mb-0.5" style="color:${theme.accent}"># ${refined.title}</div>
      <h3 class="text-[11px] font-bold leading-tight mb-1" style="color:${theme.text}">${refined.title}</h3>
      <p class="text-[8px] leading-relaxed" style="color:${theme.secondary}">${refined.body}</p>
    </div>
    <div>
      ${refined.keyPoints?.length > 0 ? `<div class="mb-1">${refined.keyPoints.slice(0, 2).map((p: string) => `<div class="text-[7px]" style="color:${theme.text}">· ${p}</div>`).join('')}</div>` : ''}
      ${tags.length > 0 ? `<div class="flex flex-wrap gap-0.5">${tags.map((t: string) => `<span class="text-[6px] px-1 py-0.5 rounded-full" style="background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>` : ''}
      <div class="text-[6px] mt-0.5" style="color:${theme.secondary}">${footer}</div>
    </div>
  </div>
</div>`;
  }

  private renderTextBottom(imgSrc: string, refined: any, tags: string[], footer: string, theme: any): string {
    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl relative">
  <div class="w-full h-[240px]">
    <img src="${imgSrc}" class="w-full h-full object-cover" />
    <div class="absolute inset-0" style="background:linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7))"></div>
  </div>
  <div class="absolute bottom-0 left-0 right-0 p-2" style="background:${theme.bg}">
    <div class="text-[8px] font-bold mb-0.5" style="color:${theme.accent}"># ${refined.title}</div>
    <h3 class="text-[10px] font-bold leading-tight mb-1" style="color:${theme.text}">${refined.title}</h3>
    <p class="text-[7px] leading-relaxed mb-1" style="color:${theme.secondary}">${refined.body}</p>
    ${refined.keyPoints?.length > 0 ? `<div>${refined.keyPoints.slice(0, 2).map((p: string) => `<div class="text-[6px] mb-0.3" style="color:${theme.text}">· ${p}</div>`).join('')}</div>` : ''}
    ${tags.length > 0 ? `<div class="flex flex-wrap gap-0.5">${tags.map((t: string) => `<span class="text-[6px] px-1 py-0.5 rounded-full" style="background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>` : ''}
    <div class="text-[6px] mt-0.5" style="color:${theme.secondary}">${footer}</div>
  </div>
</div>`;
  }

  private renderTextFloating(imgSrc: string, refined: any, tags: string[], footer: string, theme: any): string {
    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl relative">
  <div class="w-full h-full">
    <img src="${imgSrc}" class="w-full h-full object-cover" />
    <div class="absolute inset-0" style="background:rgba(0,0,0,0.3)"></div>
  </div>
  <div class="absolute inset-3 rounded-xl flex flex-col justify-center p-2" style="background:${theme.bg}CC;backdrop-filter:blur(8px)">
    <div class="text-[8px] font-bold mb-0.5" style="color:${theme.accent}"># ${refined.title}</div>
    <h3 class="text-[11px] font-bold leading-tight mb-1" style="color:${theme.text}">${refined.title}</h3>
    <p class="text-[8px] leading-relaxed mb-1.5" style="color:${theme.secondary}">${refined.body}</p>
    ${refined.keyPoints?.length > 0 ? `<div class="mb-1">${refined.keyPoints.slice(0, 2).map((p: string) => `<div class="text-[7px]" style="color:${theme.text}">· ${p}</div>`).join('')}</div>` : ''}
    ${tags.length > 0 ? `<div class="flex flex-wrap gap-0.5">${tags.map((t: string) => `<span class="text-[6px] px-1 py-0.5 rounded-full" style="background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>` : ''}
    <div class="text-[6px] mt-0.5" style="color:${theme.secondary}">${footer}</div>
  </div>
</div>`;
  }

  private renderSplit(imgSrc: string, refined: any, tags: string[], footer: string, theme: any): string {
    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl flex flex-row relative" style="background:${theme.bg}">
  <div class="w-[130px] h-full">
    <img src="${imgSrc}" class="w-full h-full object-cover" />
  </div>
  <div class="flex-1 flex flex-col justify-between p-2">
    <div>
      <div class="text-[8px] font-bold mb-0.5" style="color:${theme.accent}"># ${refined.title}</div>
      <h3 class="text-[10px] font-bold leading-tight mb-1" style="color:${theme.text}">${refined.title}</h3>
      <p class="text-[7px] leading-relaxed mb-1" style="color:${theme.secondary}">${refined.body}</p>
    </div>
    <div>
      ${refined.keyPoints?.length > 0 ? `<div class="mb-1">${refined.keyPoints.slice(0, 2).map((p: string) => `<div class="text-[6px]" style="color:${theme.text}">· ${p}</div>`).join('')}</div>` : ''}
      ${tags.length > 0 ? `<div class="flex flex-wrap gap-0.5">${tags.map((t: string) => `<span class="text-[6px] px-1 py-0.5 rounded-full" style="background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>` : ''}
      <div class="text-[6px] mt-0.5" style="color:${theme.secondary}">${footer}</div>
    </div>
  </div>
</div>`;
  }

  // ==================== 主题配置 ====================

  private getTheme(templateId: string): { name: string; bg: string; text: string; accent: string; secondary: string } {
    const themes: Record<string, typeof this.getTheme.prototype.getTheme> = {
      'quick-knowledge': { name: '清新绿', bg: '#f0f9f4', text: '#1a3a2a', accent: '#22c55e', secondary: '#4ade80' },
      'encyclopedia': { name: '学术蓝', bg: '#f0f7ff', text: '#1a2a3a', accent: '#3b82f6', secondary: '#60a5fa' },
      'compare-card': { name: '对比橙', bg: '#fff8f0', text: '#3a2a1a', accent: '#f97316', secondary: '#fb923c' },
      'lifecycle': { name: '生命粉', bg: '#fff0f5', text: '#3a1a2a', accent: '#ec4899', secondary: '#f472b6' },
      'timeline': { name: '历史金', bg: '#fffaf0', text: '#3a2a1a', accent: '#f59e0b', secondary: '#fbbf24' },
      'process': { name: '流程青', bg: '#f0fdfa', text: '#1a3a3a', accent: '#14b8a6', secondary: '#2dd4bf' },
      'scroll-history': { name: '古风褐', bg: '#faf5ef', text: '#3a2a1a', accent: '#92400e', secondary: '#b45309' },
      'handcraft-compare': { name: '手作暖', bg: '#fefce8', text: '#3a3a1a', accent: '#eab308', secondary: '#facc15' },
      'tech-infographic': { name: '科技蓝', bg: '#0f172a', text: '#f1f5f9', accent: '#38bdf8', secondary: '#94a3b8' },
      'nature-science': { name: '自然绿', bg: '#f0fdf4', text: '#14532d', accent: '#16a34a', secondary: '#22c55e' },
      'modern-tech': { name: '赛博暗', bg: '#0f0f1a', text: '#f8fafc', accent: '#00d4ff', secondary: '#94a3b8' },
      'guofeng-classic': { name: '国风雅', bg: '#f5f0e6', text: '#3a2410', accent: '#8b4513', secondary: '#a08060' },
      'minimal-fresh': { name: '极简白', bg: '#fafafa', text: '#1a1a1a', accent: '#6366f1', secondary: '#94a3b8' },
    };
    return themes[templateId] || { name: '默认', bg: '#ffffff', text: '#1a1a1a', accent: '#6366f1', secondary: '#94a3b8' };
  }

  // ==================== 工具方法 ====================

  private parseJSON(text: string): any {
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
}
