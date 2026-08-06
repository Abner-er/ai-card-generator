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
 * 使用纯内联样式（不依赖 Tailwind），直接渲染知识模块
 * 每张卡片布局不同，但内容完整
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
    const design = this.generateDesign(imageUrl, knowledge, content, stylePreset, cardIndex, cardTotal);
    return design;
  }

  private generateDesign(
    imageUrl: string,
    knowledge: KnowledgeBase,
    content: CardContent,
    stylePreset: StylePreset,
    cardIndex: number,
    cardTotal: number,
  ): CardDesignOutput {
    const topic = knowledge.englishTopic || knowledge.topic;
    const tags = (content.tags || []).slice(0, 6);
    const footer = content.footer || topic;

    const layout = this.selectLayout(stylePreset.id, cardIndex, cardTotal);
    const theme = this.getTheme(stylePreset.id);

    let html = '';
    switch (layout) {
      case 'scroll':
        html = this.renderScroll(imageUrl, knowledge, content, tags, footer, theme);
        break;
      case 'cards':
        html = this.renderCards(imageUrl, knowledge, content, tags, footer, theme);
        break;
      case 'featured':
        html = this.renderFeatured(imageUrl, knowledge, content, tags, footer, theme);
        break;
      case 'split':
        html = this.renderSplit(imageUrl, knowledge, content, tags, footer, theme);
        break;
      default:
        html = this.renderScroll(imageUrl, knowledge, content, tags, footer, theme);
    }

    return {
      layout: layout as any,
      colors: { bg: theme.bg, text: theme.text, accent: theme.accent, secondary: theme.secondary },
      html,
      designDescription: layout,
    };
  }

  private selectLayout(templateId: string, cardIndex: number, cardTotal: number): string {
    const layouts: Record<string, string[]> = {
      'nature-science': ['featured', 'cards', 'scroll'],
      'tech-infographic': ['scroll', 'cards', 'split'],
      'modern-tech': ['scroll', 'cards', 'split'],
      'scroll-history': ['scroll', 'featured', 'cards'],
      'quick-knowledge': ['cards', 'scroll', 'featured'],
      'encyclopedia': ['scroll', 'cards', 'featured'],
    };
    const pool = layouts[templateId] || ['scroll', 'cards', 'featured'];
    return pool[cardIndex % pool.length];
  }

  // ==================== 布局渲染器（纯内联样式）====================

  private renderScroll(imgSrc: string, knowledge: KnowledgeBase, content: CardContent, tags: string[], footer: string, theme: any): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const facts = knowledge.facts || [];
    let rows = '';
    const icons = ['🌱', '💡', '⭐', '🔬', '📊'];
    (facts.slice(0, 3)).forEach((f: any, i: number) => {
      rows += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:11px">
        <span style="font-size:12px">${icons[i % icons.length]}</span>
        <span style="color:${theme.accent};font-weight:600;font-size:10px">${f.label || ''}</span>
        <span style="color:${theme.text};flex:1;font-size:10px">${f.value || ''}</span>
      </div>`;
    });

    return `
<div style="width:270px;height:360px;border-radius:16px;overflow:hidden;position:relative;font-family:sans-serif">
  ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"/>` : ''}
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent 20%,${theme.bg} 70%)"></div>
  <div style="position:absolute;top:8px;right:8px;padding:2px 6px;border-radius:10px;font-size:9px;font-weight:bold;color:${theme.bg};background:${theme.accent}">AI</div>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:10px">
    <div style="font-size:10px;font-weight:bold;color:${theme.accent};margin-bottom:2px">#01 · ${knowledge.category || topic}</div>
    <h2 style="font-size:14px;font-weight:bold;color:${theme.text};margin:0 0 4px 0;line-height:1.3">${content.title || topic}</h2>
    <p style="font-size:9px;color:${theme.secondary};margin:0 0 8px 0;line-height:1.4">${content.body || ''}</p>
    <div style="border-top:1px solid ${theme.accent}30;padding-top:4px">${rows}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
      <div>${tags.slice(0,3).map((t: string) => `<span style="display:inline-block;font-size:8px;padding:2px 5px;border-radius:8px;margin-right:3px;background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>
      <span style="font-size:8px;color:${theme.secondary};opacity:0.6">${footer}</span>
    </div>
  </div>
</div>`;
  }

  private renderCards(imgSrc: string, knowledge: KnowledgeBase, content: CardContent, tags: string[], footer: string, theme: any): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const facts = knowledge.facts || [];
    let cards = '';
    const icons = ['🌱', '💡', '⭐', '🔬'];
    (facts.slice(0, 3)).forEach((f: any, i: number) => {
      cards += `<div style="display:flex;gap:5px;padding:5px;margin-bottom:5px;border-radius:8px;background:${theme.accent}15">
        <span style="font-size:10px;margin-top:1px">${icons[i % icons.length]}</span>
        <div><div style="font-size:9px;font-weight:600;color:${theme.accent};margin-bottom:1px">${f.label || ''}</div><div style="font-size:8px;color:${theme.text};line-height:1.3">${f.value || ''}</div></div>
      </div>`;
    });

    return `
<div style="width:270px;height:360px;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;font-family:sans-serif;background:${theme.bg}">
  <div style="position:relative;height:130px;flex-shrink:0">
    ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover"/>` : ''}
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent,${theme.bg})"></div>
    <div style="position:absolute;top:6px;left:6px;padding:2px 6px;border-radius:10px;font-size:9px;font-weight:bold;color:${theme.bg};background:${theme.accent}">AI</div>
  </div>
  <div style="flex:1;padding:8px;display:flex;flex-direction:column;overflow:hidden">
    <div style="font-size:10px;font-weight:bold;color:${theme.accent};margin-bottom:2px">#01 · ${knowledge.category || topic}</div>
    <h2 style="font-size:13px;font-weight:bold;color:${theme.text};margin:0 0 3px 0;line-height:1.3">${content.title || topic}</h2>
    <p style="font-size:9px;color:${theme.secondary};margin:0 0 8px 0;line-height:1.4;flex:1;overflow:hidden">${content.body || ''}</p>
    ${cards}
    <div style="display:flex;flex-wrap:wrap;margin-top:auto">${tags.slice(0,4).map((t: string) => `<span style="display:inline-block;font-size:8px;padding:2px 5px;border-radius:8px;margin-right:3px;margin-bottom:3px;background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>
    <div style="font-size:8px;color:${theme.secondary};opacity:0.6;text-align:right;margin-top:2px">${footer}</div>
  </div>
</div>`;
  }

  private renderFeatured(imgSrc: string, knowledge: KnowledgeBase, content: CardContent, tags: string[], footer: string, theme: any): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const facts = knowledge.facts || [];
    let rows = '';
    (facts.slice(0, 2)).forEach((f: any) => {
      rows += `<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
        <span style="width:5px;height:5px;border-radius:50%;background:${theme.accent};flex-shrink:0"></span>
        <span style="font-size:9px;font-weight:600;color:${theme.accent}">${f.label || ''}:</span>
        <span style="font-size:8px;color:${theme.bg};flex:1">${f.value || ''}</span>
      </div>`;
    });

    return `
<div style="width:270px;height:360px;border-radius:16px;overflow:hidden;position:relative;font-family:sans-serif">
  ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0"/>` : ''}
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.5) 100%)"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;justify-content:space-between;padding:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="font-size:24px;font-weight:900;color:${theme.bg};line-height:1">01</div>
      <div style="padding:2px 6px;border-radius:10px;font-size:9px;font-weight:bold;color:${theme.bg};background:${theme.accent}">AI</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:bold;color:${theme.accent};margin-bottom:2px">${knowledge.category || topic}</div>
      <h2 style="font-size:14px;font-weight:bold;color:${theme.bg};margin:0 0 4px 0;line-height:1.3">${content.title || topic}</h2>
      <p style="font-size:9px;color:${theme.bg};opacity:0.8;margin:0 0 6px 0;line-height:1.4">${content.body || ''}</p>
      <div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:4px">${rows}</div>
      <div style="margin-top:5px">${tags.slice(0,3).map((t: string) => `<span style="display:inline-block;font-size:8px;padding:2px 5px;border-radius:8px;margin-right:3px;background:${theme.accent}40;color:${theme.bg}">${t}</span>`).join('')}</div>
      <div style="font-size:8px;margin-top:4px;opacity:0.6">${footer}</div>
    </div>
  </div>
</div>`;
  }

  private renderSplit(imgSrc: string, knowledge: KnowledgeBase, content: CardContent, tags: string[], footer: string, theme: any): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const facts = knowledge.facts || [];
    let rows = '';
    const icons = ['🌱', '💡', '⭐'];
    (facts.slice(0, 2)).forEach((f: any, i: number) => {
      rows += `<div style="display:flex;gap:4px;margin-bottom:4px;align-items:flex-start">
        <span style="font-size:9px;margin-top:1px">${icons[i % icons.length]}</span>
        <div><span style="font-size:9px;font-weight:600;color:${theme.accent}">${f.label || ''}:</span>
        <div style="font-size:8px;color:${theme.text};line-height:1.3">${f.value || ''}</div></div>
      </div>`;
    });

    return `
<div style="width:270px;height:360px;border-radius:16px;overflow:hidden;display:flex;font-family:sans-serif;background:${theme.bg}">
  <div style="width:115px;height:100%;position:relative;flex-shrink:0">
    ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover"/>` : ''}
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to right,transparent,${theme.bg})"></div>
    <div style="position:absolute;top:8px;left:6px;font-size:20px;font-weight:900;color:${theme.bg}">01</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:10px">
    <div>
      <div style="font-size:9px;font-weight:bold;color:${theme.accent};margin-bottom:2px">#01 · ${knowledge.category || topic}</div>
      <h2 style="font-size:12px;font-weight:bold;color:${theme.text};margin:0 0 4px 0;line-height:1.3">${content.title || topic}</h2>
      <p style="font-size:9px;color:${theme.secondary};margin:0 0 8px 0;line-height:1.4">${content.body || ''}</p>
      <div style="margin-bottom:8px">${rows}</div>
    </div>
    <div>
      <div>${tags.slice(0,4).map((t: string) => `<span style="display:inline-block;font-size:8px;padding:2px 5px;border-radius:8px;margin-right:3px;margin-bottom:3px;background:${theme.accent}20;color:${theme.accent}">${t}</span>`).join('')}</div>
      <div style="font-size:8px;color:${theme.secondary};opacity:0.6;margin-top:2px">${footer}</div>
    </div>
  </div>
</div>`;
  }

  private getTheme(templateId: string): { name: string; bg: string; text: string; accent: string; secondary: string; tag: string } {
    const themes: Record<string, typeof this.getTheme.prototype.getTheme> = {
      'quick-knowledge': { name: '清新绿', bg: '#f0f9f4', text: '#1a3a2a', accent: '#22c55e', secondary: '#4ade80', tag: '自然' },
      'encyclopedia': { name: '学术蓝', bg: '#f0f7ff', text: '#1a2a3a', accent: '#3b82f6', secondary: '#60a5fa', tag: '百科' },
      'compare-card': { name: '对比橙', bg: '#fff8f0', text: '#3a2a1a', accent: '#f97316', secondary: '#fb923c', tag: '对比' },
      'lifecycle': { name: '生命粉', bg: '#fff0f5', text: '#3a1a2a', accent: '#ec4899', secondary: '#f472b6', tag: '生命' },
      'timeline': { name: '历史金', bg: '#fffaf0', text: '#3a2a1a', accent: '#f59e0b', secondary: '#fbbf24', tag: '历史' },
      'process': { name: '流程青', bg: '#f0fdfa', text: '#1a3a3a', accent: '#14b8a6', secondary: '#2dd4bf', tag: '流程' },
      'scroll-history': { name: '古风褐', bg: '#faf5ef', text: '#3a2a1a', accent: '#92400e', secondary: '#b45309', tag: '史话' },
      'handcraft-compare': { name: '手作暖', bg: '#fefce8', text: '#3a3a1a', accent: '#eab308', secondary: '#facc15', tag: '手作' },
      'tech-infographic': { name: '科技蓝', bg: '#0f172a', text: '#f1f5f9', accent: '#38bdf8', secondary: '#94a3b8', tag: '科技' },
      'nature-science': { name: '自然绿', bg: '#f0fdf4', text: '#14532d', accent: '#16a34a', secondary: '#22c55e', tag: '自然' },
      'modern-tech': { name: '赛博暗', bg: '#0f0f1a', text: '#f8fafc', accent: '#00d4ff', secondary: '#94a3b8', tag: '科技' },
      'guofeng-classic': { name: '国风雅', bg: '#f5f0e6', text: '#3a2410', accent: '#8b4513', secondary: '#a08060', tag: '国风' },
      'minimal-fresh': { name: '极简白', bg: '#fafafa', text: '#1a1a1a', accent: '#6366f1', secondary: '#94a3b8', tag: '极简' },
    };
    return themes[templateId] || { name: '默认', bg: '#ffffff', text: '#1a1a1a', accent: '#6366f1', secondary: '#94a3b8', tag: 'AI' };
  }
}
