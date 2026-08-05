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
 * Stage 4.5 — AI 卡片设计服务（方案 A：Vision API）
 *
 * 核心流程：
 * 1. 分析图片构图（vision API）→ 主体位置 / 留白区域 / 氛围
 * 2. 基于分析结果 + 内容数据 → AI 生成自适应 HTML 卡片
 * 3. 返回完整设计（布局 / 配色 / HTML）
 *
 * 替代旧方案：固定模板（TemplateLayer 绝对定位）→ 卡片千篇一律
 * 新方案：AI 自主决定每张卡片的布局、配色、层次 → 每张卡独一无二
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
   * 核心方法：基于图片和内容生成 AI 卡片设计
   * @param imageUrl 已生成的图片（base64 或 URL）
   * @param knowledge 知识数据（用于理解主题）
   * @param content 卡片内容（标题、正文、标签）
   * @param stylePreset 风格预设（用于提示词）
   * @param onProgress 进度回调（通知 App 更新 stage / card.designStatus）
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

    // Step 2: 基于分析结果生成卡片设计
    const design = await this.generateCardDesign(composition, knowledge, content, stylePreset, cardIndex, imageUrl);

    return design;
  }

  /**
   * Step 1: 分析图片构图
   * 使用 vision API（文本模型 + image_url）分析图片的视觉特征
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
    lightDirection: string;
    compositionStyle: string;
  }> {
    const systemPrompt = `You are a professional art director analyzing illustration compositions for knowledge cards.

Analyze the visual composition of the image and return a JSON with:
- subjectPosition: where the main subject is located (left/right/center/top/bottom/scattered)
- emptySpace: where the largest empty/negative space is (left/right/top/bottom/scattered)
- dominantColor: the main color of the image (hex or color name)
- mood: the overall mood (serene/energetic/dramatic/peaceful/vibrant/mysterious)
- lightDirection: where light comes from (top/bottom/left/right/centered)
- compositionStyle: the composition style (portrait/landscape/close-up/wide/detail)

Output ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `Analyze the composition of this knowledge card illustration:
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
          lightDirection: string;
          compositionStyle: string;
        };
      }
    } catch (err) {
      console.warn('[CardDesignService] Vision analysis failed:', err);
    }

    // Fallback: 默认值（empty space 在左侧，适合文字）
    return {
      subjectPosition: 'right',
      emptySpace: 'left',
      dominantColor: '#f5f0e6',
      mood: 'serene',
      lightDirection: 'top',
      compositionStyle: 'portrait',
    };
  }

  /**
   * Step 2: 基于构图分析 + 内容生成完整卡片 HTML
   */
  private async generateCardDesign(
    composition: {
      subjectPosition: string;
      emptySpace: string;
      dominantColor: string;
      mood: string;
      lightDirection: string;
      compositionStyle: string;
    },
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    imageUrl: string,
  ): Promise<CardDesignOutput> {
    const subjectPos = composition.subjectPosition || 'right';
    const emptySpace = composition.emptySpace || 'left';
    const dominantColor = composition.dominantColor || '#f5f0e6';
    const mood = composition.mood || 'serene';
    const lightDir = composition.lightDirection || 'top';
    const compStyle = composition.compositionStyle || 'portrait';

    // 根据 emptySpace 决定布局
    const layoutMap: Record<string, 'left-text' | 'right-text' | 'bottom-text' | 'center-text' | 'split' | 'floating'> = {
      left: 'right-text',
      right: 'left-text',
      top: 'bottom-text',
      bottom: 'bottom-text',
      center: 'center-text',
      scattered: 'split',
    };
    const layout = layoutMap[emptySpace] || 'right-text';

    const systemPrompt = `You are a senior graphic designer specializing in knowledge card layouts.

Design a beautiful HTML card for an AI-generated illustration. The card should be modern, clean, and visually striking.

## Image Analysis
- Subject is positioned: ${subjectPos}
- Largest empty space: ${emptySpace}
- Dominant color: ${dominantColor}
- Mood: ${mood}
- Light direction: ${lightDir}
- Composition: ${compStyle}

## Card Content
- Topic: ${knowledge.englishTopic || knowledge.topic}
- Stage ${cardIndex + 1}: ${content.title || 'Knowledge Card'}
- Body: ${content.body || ''}
- Tags: ${(content.tags || []).join(', ')}
- Footer: ${content.footer || ''}

## Design Instructions
Based on the image analysis, create a complete HTML card using Tailwind CSS.

Layout rules:
- If empty space is LEFT → put text on left, image on right (layout: right-text)
- If empty space is RIGHT → put image on left, text on right (layout: left-text)
- If empty space is BOTTOM → image on top, text at bottom (layout: bottom-text)
- If empty space is TOP → text on top, image at bottom (layout: top-text)
- If empty space is CENTER → image as background with floating text overlay (layout: floating)
- If empty space is SCATTERED → split layout (layout: split)

Color scheme:
- Extract accent colors from dominantColor
- Use contrasting text color for readability
- Ensure good contrast ratio (WCAG AA minimum)

HTML requirements:
- Use Tailwind CSS classes exclusively
- Card dimensions: 270px wide × 360px tall (match imageService default)
- Include: image, title, body, tags, footer
- Modern typography: sans-serif fonts, good hierarchy
- Subtle shadows, rounded corners
- Do NOT include <html>, <head>, or <body> tags — output the card div only

Output JSON:
{
  "layout": "${layout}",
  "colors": {"bg": "#...", "text": "#...", "accent": "#...", "secondary": "#..."},
  "html": "<div class='...'>...</div>",
  "designDescription": "Brief description of the design choices made"
}`;

    try {
      const response = await this.callTextAPI(systemPrompt, '');
      const parsed = this.parseDesignJSON(response);
      if (parsed && parsed.html && parsed.colors) {
        return parsed;
      }
    } catch (err) {
      console.warn('[CardDesignService] Design generation failed:', err);
    }

    // Fallback: 生成基础布局
    return this.generateFallbackDesign(content, layout, dominantColor, knowledge, imageUrl);
  }

  /**
   * 调用 Vision API（文本模型 + 图片）
   */
  private async callVisionAPI(systemPrompt: string, userPrompt: string, imageUrl: string): Promise<string> {
    const visionModel = this.config.imageModel || 'agnes-image-2.1-flash';
    // 使用文本模型支持 vision（如 gpt-4o, claude-sonnet-4-20250514 等）
    const model = 'agnes-2.5-flash'; // 支持 vision 的文本模型

    const response = await fetch('/ai-api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

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

    if (!response.ok) {
      throw new Error(`Text API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 解析设计 JSON（允许 markdown 代码块包裹）
   */
  private parseDesignJSON(text: string): CardDesignOutput | null {
    try {
      // 尝试直接解析
      const parsed = JSON.parse(text);
      if (parsed.layout && parsed.colors && parsed.html) {
        return parsed;
      }
    } catch {
      // 尝试提取 JSON 块
    }

    // 尝试从 markdown 代码块中提取
    const jsonMatch = text.match(/\{[\s\S]*"layout"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.layout && parsed.colors && parsed.html) {
          return parsed;
        }
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
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Fallback: 生成基础卡片 HTML
   * 当 AI 生成失败时使用
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

    // 根据布局生成不同 HTML
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
      // 默认 bottom-text
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
