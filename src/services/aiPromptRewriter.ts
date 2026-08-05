import type { AIConfig, VisualPrompt, CardContent, KnowledgeBase } from '../types';

/** AI 改写结果（P3 新增 reason/visualFocus 字段） */
export interface RewriteResult {
  mainVisual: string;
  auxiliary: string;
  /** P3新增: 改写的理由说明（英文） */
  reason: string;
  /** P3新增: 画面焦点描述（英文） */
  visualFocus: string;
}

/**
 * AI Prompt 改写服务
 *
 * 核心能力：在生成图片前，调用大模型根据当前卡片的具体内容
 * （阶段名称、特征、要点）改写最终的英文图片 prompt。
 *
 * 这解决了「硬编码提示词」的问题：
 * - 之前：lifecycle 模板每个阶段都用同一套辅助元素描述 → 知了成虫里画了蛋
 * - 现在：每个阶段都让大模型根据其内容重新改写，避免阶段冲突的元素
 *
 * 同时也是「用大模型能力」的体现：让 AI 自己决定主视觉的姿态、
 * 辅助元素、光线氛围等，而不是写死在代码里。
 */
export class AIPromptRewriter {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  updateConfig(config: AIConfig) {
    this.config = config;
  }

  /**
   * 基于当前阶段内容，用大模型改写图片 prompt
   * @returns 改写后的 VisualPrompt 片段（P3: 包含 reason 和 visualFocus）
   */
  async rewrite(
    knowledge: KnowledgeBase,
    content: CardContent,
    cardIndex: number,
    cardTotal: number,
  ): Promise<Partial<VisualPrompt> & { reason: string; visualFocus: string } | null> {
    if (!knowledge || !content) return null;

    // 构建改写请求所需的上下文
    const stageContext = this.buildStageContext(knowledge, content, cardIndex, cardTotal);

    const systemPrompt = `You are an expert image prompt engineer for AI image generation.

Your task: rewrite the main visual description and auxiliary elements for a knowledge card illustration.

Strict rules:
1. Output ONLY in English. Never use Chinese characters.
2. The main subject must match the current life stage precisely. For example:
   - If the stage is "adult cicada" → the main visual MUST show an adult cicada, NOT an egg, larva, or any other life stage
   - If the stage is "juvenile fish" → show a juvenile fish, NOT eggs or adults
3. Auxiliary decorations must be CONSISTENT with the current stage. NEVER include elements that contradict the stage:
   - Adult stage → never include eggs, nests, juvenile features, or larval organs
   - Egg/seed stage → may include egg cluster, nest, but no adults
   - Larva/juvenile stage → may include leaf, soil, but no adult organs
   - Old/elderly stage → may include falling leaves, withered branches
4. The subject must be ONE single organism with anatomically correct body parts:
   - exactly ONE head
   - correct number of limbs/legs/wings for the species
   - no duplicated or extra body parts
   - no extra heads, eyes, tails, limbs
5. Auxiliary elements should be ENVIRONMENTAL decorations only — partial close-ups, leaves, branches, textures — never a second complete organism.
6. Output as JSON with mainVisual, auxiliary, reason, and visualFocus fields.
7. Keep each field under 200 words.
8. Use vivid, painterly language appropriate for natural science illustration.`;

    const userPrompt = `Rewrite the image prompt for this specific card:

${stageContext}

Constraints for the current card:
- Card ${cardIndex + 1} of ${cardTotal} in the series
- Stage name (MUST be the main subject): "${stageContext.stageName}"
- Stage features (MUST be visible): ${stageContext.features}
- The subject is ONE ${stageContext.englishTopic} in its "${stageContext.stageNameEn}" life stage

Output JSON:
{
  "mainVisual": "ONE single ${stageContext.englishTopic} in its ${stageContext.stageNameEn} life stage, [describe pose/action/colors/environment based on features], anatomically correct with exactly one head, proper number of legs and wings, scientifically accurate, natural realistic pose, no extra or duplicated body parts",
  "auxiliary": "[describe small environmental decorative elements ONLY — partial close-ups, leaves, branches, textures — that are CONSISTENT with the ${stageContext.stageNameEn} stage, NEVER eggs if it's adult stage, NEVER juvenile features if it's adult stage, no second complete animal]",
  "reason": "Brief explanation in English of why you chose this visual approach",
  "visualFocus": "Description of the main visual focus in English"
}`;

    try {
      const response = await fetch('/ai-api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.textModel || 'agnes-2.0-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        console.warn('[AIPromptRewriter] API error, falling back to template prompt:', response.status);
        return null;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';

      // 解析 JSON
      const parsed = this.parseJSON(text);
      if (!parsed || !parsed.mainVisual || !parsed.auxiliary) {
        console.warn('[AIPromptRewriter] Invalid response, falling back:', text.slice(0, 200));
        return null;
      }

      // 安全检查：确保改写后的 prompt 里没有意外泄露中文
      if (/[\u4e00-\u9fa5]/.test(parsed.mainVisual) || /[\u4e00-\u9fa5]/.test(parsed.auxiliary)) {
        console.warn('[AIPromptRewriter] Chinese characters leaked, falling back');
        return null;
      }

      return {
        mainVisual: parsed.mainVisual,
        auxiliary: parsed.auxiliary,
        reason: parsed.reason || 'Template-based prompt with no AI rewriting applied',
        visualFocus: parsed.visualFocus || stageContext.englishTopic,
      };
    } catch (err) {
      console.warn('[AIPromptRewriter] Network/parse error, falling back:', err);
      return null;
    }
  }

  /**
   * 构建当前阶段的完整上下文，供大模型改写使用
   */
  private buildStageContext(
    knowledge: KnowledgeBase,
    content: CardContent,
    cardIndex: number,
    cardTotal: number,
  ): {
    stageName: string;
    stageNameEn: string;
    englishTopic: string;
    features: string;
    description: string;
    title: string;
    subtitle: string;
    body: string;
  } {
    const englishTopic = knowledge.englishTopic || knowledge.topic;

    // 尝试从知识库提取当前阶段
    let stageName = '';
    let stageNameEn = '';
    let features: string[] = [];
    let description = '';

    if (knowledge.lifecycleStages?.[cardIndex]) {
      const stage = knowledge.lifecycleStages[cardIndex];
      stageName = stage.name;
      stageNameEn = stage.name; // 大模型自己翻译
      features = stage.features;
      description = stage.description;
    } else if (knowledge.timelineEvents?.[cardIndex]) {
      const event = knowledge.timelineEvents[cardIndex];
      stageName = event.title;
      stageNameEn = event.title;
      features = [event.year, event.significance || ''].filter(Boolean);
      description = event.description;
    } else if (knowledge.processSteps?.[cardIndex]) {
      const step = knowledge.processSteps[cardIndex];
      stageName = step.title;
      stageNameEn = step.title;
      features = [step.tip || ''].filter(Boolean);
      description = step.description;
    } else {
      // 通用模板
      stageName = content.title || '';
      stageNameEn = content.title || '';
      features = content.highlights || [];
      description = content.body || '';
    }

    return {
      stageName,
      stageNameEn,
      englishTopic,
      features: features.length > 0 ? features.join('; ') : 'characteristic features',
      description,
      title: content.title,
      subtitle: content.subtitle,
      body: content.body,
    };
  }

  /** 容错 JSON 解析 */
  private parseJSON(text: string): { mainVisual?: string; auxiliary?: string; reason?: string; visualFocus?: string } | null {
    try {
      return JSON.parse(text);
    } catch {
      // 尝试从文本中提取 JSON 块
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
}
