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
 * 核心：根据模板 + 知识数据，生成包含完整知识模块的美化 HTML
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

    // 根据模板类型和卡片索引选择布局
    const layout = this.selectLayout(stylePreset.id, cardIndex, cardTotal);
    const theme = this.getTheme(stylePreset.id);

    let html = '';
    switch (layout) {
      case 'scroll':
        html = this.renderScrollLayout(imageUrl, knowledge, content, tags, footer, theme);
        break;
      case 'cards':
        html = this.renderCardsLayout(imageUrl, knowledge, content, tags, footer, theme);
        break;
      case 'featured':
        html = this.renderFeaturedLayout(imageUrl, knowledge, content, tags, footer, theme);
        break;
      case 'split':
        html = this.renderSplitLayout(imageUrl, knowledge, content, tags, footer, theme);
        break;
      default:
        html = this.renderScrollLayout(imageUrl, knowledge, content, tags, footer, theme);
    }

    return {
      layout: layout as CardDesignOutput['layout'],
      colors: { bg: theme.bg, text: theme.text, accent: theme.accent, secondary: theme.secondary },
      html,
      designDescription: `${layout} layout`,
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

  // ==================== 布局渲染器 ====================

  /** 滚动历史风格：全幅背景图 + 底部内容卡片 */
  private renderScrollLayout(
    imageUrl: string, knowledge: KnowledgeBase, content: CardContent,
    tags: string[], footer: string, theme: any,
  ): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const imgSrc = imageUrl.startsWith('data:') ? imageUrl : (imageUrl || '');
    const facts = knowledge.facts || [];
    const keyPoints = knowledge.keyPoints || [];

    // 知识行
    let rows = '';
    const factIcons = ['🌱', '💡', '⭐', '🔬', '📊'];
    facts.slice(0, 3).forEach((f: any, i: number) => {
      const icon = factIcons[i % factIcons.length];
      rows += `
        <div class="flex items-center gap-1.5 mb-1.5">
          <span class="text-xs">${icon}</span>
          <span class="text-[10px] font-medium" style="color:${theme.accent}">${f.label || ''}</span>
          <span class="text-[10px] flex-1" style="color:${theme.text}">${f.value || ''}</span>
        </div>`;
    });
    if (!rows && keyPoints.length > 0) {
      keyPoints.slice(0, 3).forEach((p: string, i: number) => {
        rows += `
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-xs">•</span>
            <span class="text-[10px]" style="color:${theme.text}">${p}</span>
          </div>`;
      });
    }

    // 标签
    const tagHtml = tags.length > 0 ? tags.map((t: string) =>
      `<span class="text-[8px] px-1.5 py-0.5 rounded-full mr-1" style="background:${theme.accent}15;color:${theme.accent}">${t}</span>`
    ).join('') : '';

    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl relative" style="background:${theme.bg}">
  <!-- 背景图 -->
  <div class="absolute inset-0">
    ${imgSrc ? `<img src="${imgSrc}" class="w-full h-full object-cover" />` : ''}
    <div class="absolute inset-0" style="background:linear-gradient(to bottom, transparent 20%, ${theme.bg} 70%)"></div>
  </div>
  <!-- 顶部角标 -->
  <div class="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[7px] font-bold" style="background:${theme.accent};color:${theme.bg}">
    ${theme.tag || 'AI'}
  </div>
  <!-- 内容区 -->
  <div class="absolute bottom-0 left-0 right-0 p-2.5">
    <div class="text-[9px] font-bold mb-0.5" style="color:${theme.accent}">#01 · ${knowledge.category || topic}</div>
    <h2 class="text-[14px] font-bold leading-tight mb-1" style="color:${theme.text}">${content.title || topic}</h2>
    <p class="text-[8px] leading-relaxed mb-2" style="color:${theme.secondary}">${content.body || ''}</p>
    <!-- 知识行 -->
    <div class="mb-2" style="border-top:1px solid ${theme.accent}30;padding-top:2px">
      ${rows}
    </div>
    <!-- 标签 -->
    <div class="flex items-end justify-between">
      <div>${tagHtml}</div>
      <div class="text-[7px] opacity-60">${footer}</div>
    </div>
  </div>
</div>`;
  }

  /** 卡片网格风格：图在上，知识卡片在下 */
  private renderCardsLayout(
    imageUrl: string, knowledge: KnowledgeBase, content: CardContent,
    tags: string[], footer: string, theme: any,
  ): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const imgSrc = imageUrl.startsWith('data:') ? imageUrl : (imageUrl || '');
    const facts = knowledge.facts || [];
    const keyPoints = knowledge.keyPoints || [];

    // 知识卡片
    let cardItems = '';
    const icons = ['🌱', '💡', '⭐', '🔬'];
    const source = facts.length > 0 ? facts : keyPoints.map((p: string) => ({ label: '要点', value: p }));
    source.slice(0, 3).forEach((f: any, i: number) => {
      const icon = icons[i % icons.length];
      cardItems += `
        <div class="flex items-start gap-1.5 p-1.5 rounded-lg mb-1.5" style="background:${theme.accent}10">
          <span class="text-[10px] mt-0.5">${icon}</span>
          <div class="flex-1 min-w-0">
            <div class="text-[8px] font-medium mb-0.3" style="color:${theme.accent}">${f.label || ''}</div>
            <div class="text-[7px] leading-relaxed" style="color:${theme.text}">${f.value || ''}</div>
          </div>
        </div>`;
    });

    // 标签
    const tagHtml = tags.slice(0, 4).map((t: string) =>
      `<span class="text-[7px] px-1.5 py-0.5 rounded-full mr-1 mb-1 inline-block" style="background:${theme.accent}20;color:${theme.accent}">${t}</span>`
    ).join('');

    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl flex flex-col" style="background:${theme.bg}">
  <!-- 图片区 -->
  <div class="relative h-[140px] flex-shrink-0">
    ${imgSrc ? `<img src="${imgSrc}" class="w-full h-full object-cover" />` : ''}
    <div class="absolute inset-0" style="background:linear-gradient(to bottom, transparent, ${theme.bg})"></div>
    <div class="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[7px] font-bold" style="background:${theme.accent};color:${theme.bg}">
      ${theme.tag || 'AI'}
    </div>
  </div>
  <!-- 内容区 -->
  <div class="flex-1 px-2.5 pt-2 pb-2 overflow-hidden flex flex-col">
    <div class="text-[9px] font-bold mb-0.5" style="color:${theme.accent}">#01 · ${knowledge.category || topic}</div>
    <h2 class="text-[13px] font-bold leading-tight mb-1" style="color:${theme.text}">${content.title || topic}</h2>
    <p class="text-[8px] leading-relaxed mb-2 flex-1 overflow-hidden" style="color:${theme.secondary}">${content.body || ''}</p>
    <!-- 知识卡片 -->
    <div class="flex-1 overflow-hidden">${cardItems}</div>
    <!-- 标签 -->
    <div class="flex flex-wrap mt-1">${tagHtml}</div>
    <div class="text-[7px] opacity-60 mt-1 text-right">${footer}</div>
  </div>
</div>`;
  }

  /** 突出风格：图满屏，文字悬浮 */
  private renderFeaturedLayout(
    imageUrl: string, knowledge: KnowledgeBase, content: CardContent,
    tags: string[], footer: string, theme: any,
  ): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const imgSrc = imageUrl.startsWith('data:') ? imageUrl : (imageUrl || '');
    const facts = knowledge.facts || [];
    const keyPoints = knowledge.keyPoints || [];

    // 知识行
    let rows = '';
    const source = facts.length > 0 ? facts : keyPoints.map((p: string) => ({ label: '要点', value: p }));
    source.slice(0, 2).forEach((f: any) => {
      rows += `
        <div class="flex items-center gap-1.5 mb-1">
          <span class="w-1 h-1 rounded-full flex-shrink-0" style="background:${theme.accent}"></span>
          <span class="text-[9px] font-medium" style="color:${theme.accent}">${f.label || ''}:</span>
          <span class="text-[8px] flex-1" style="color:${theme.bg}">${f.value || ''}</span>
        </div>`;
    });

    const tagHtml = tags.slice(0, 3).map((t: string) =>
      `<span class="text-[7px] px-1.5 py-0.5 rounded-full mr-1" style="background:${theme.accent}30;color:${theme.bg}">${t}</span>`
    ).join('');

    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl relative">
  <!-- 背景图 -->
  <div class="absolute inset-0">
    ${imgSrc ? `<img src="${imgSrc}" class="w-full h-full object-cover" />` : ''}
    <div class="absolute inset-0" style="background:linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)"></div>
  </div>
  <!-- 内容 -->
  <div class="absolute inset-0 flex flex-col justify-between p-2.5">
    <div class="flex justify-between items-start">
      <div class="text-[20px] font-black leading-none" style="color:${theme.bg}">01</div>
      <div class="px-1.5 py-0.5 rounded-full text-[7px] font-bold" style="background:${theme.accent};color:${theme.bg}">
        ${theme.tag || 'AI'}
      </div>
    </div>
    <div>
      <div class="text-[9px] font-bold mb-0.5" style="color:${theme.accent}">${knowledge.category || topic}</div>
      <h2 class="text-[14px] font-bold leading-tight mb-1.5" style="color:${theme.bg}">${content.title || topic}</h2>
      <p class="text-[8px] leading-relaxed mb-2" style="color:${theme.bg}CC">${content.body || ''}</p>
      <!-- 知识行 -->
      <div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:2px">${rows}</div>
      <!-- 标签 -->
      <div class="mt-1.5">${tagHtml}</div>
      <div class="text-[7px] mt-1 opacity-60">${footer}</div>
    </div>
  </div>
</div>`;
  }

  /** 分割风格：图左文右 */
  private renderSplitLayout(
    imageUrl: string, knowledge: KnowledgeBase, content: CardContent,
    tags: string[], footer: string, theme: any,
  ): string {
    const topic = knowledge.englishTopic || knowledge.topic;
    const imgSrc = imageUrl.startsWith('data:') ? imageUrl : (imageUrl || '');
    const facts = knowledge.facts || [];
    const keyPoints = knowledge.keyPoints || [];

    // 知识行
    let rows = '';
    const icons = ['🌱', '💡', '⭐'];
    const source = facts.length > 0 ? facts : keyPoints.map((p: string) => ({ label: '要点', value: p }));
    source.slice(0, 2).forEach((f: any, i: number) => {
      rows += `
        <div class="flex items-start gap-1 mb-1">
          <span class="text-[8px] mt-0.5">${icons[i % icons.length]}</span>
          <div>
            <span class="text-[8px] font-medium" style="color:${theme.accent}">${f.label || ''}:</span>
            <span class="text-[7px] block" style="color:${theme.text}">${f.value || ''}</span>
          </div>
        </div>`;
    });

    const tagHtml = tags.slice(0, 4).map((t: string) =>
      `<span class="text-[7px] px-1.5 py-0.5 rounded-full mr-1" style="background:${theme.accent}15;color:${theme.accent}">${t}</span>`
    ).join('');

    return `
<div class="w-[270px] h-[360px] rounded-2xl overflow-hidden shadow-xl flex" style="background:${theme.bg}">
  <!-- 左图 -->
  <div class="w-[120px] h-full relative flex-shrink-0">
    ${imgSrc ? `<img src="${imgSrc}" class="w-full h-full object-cover" />` : ''}
    <div class="absolute inset-0" style="background:linear-gradient(to right, transparent, ${theme.bg})"></div>
    <div class="absolute top-2 left-2 text-[18px] font-black leading-none" style="color:${theme.bg}">01</div>
  </div>
  <!-- 右文 -->
  <div class="flex-1 flex flex-col justify-between p-2.5">
    <div>
      <div class="text-[8px] font-bold mb-0.5" style="color:${theme.accent}">#01 · ${knowledge.category || topic}</div>
      <h2 class="text-[12px] font-bold leading-tight mb-1.5" style="color:${theme.text}">${content.title || topic}</h2>
      <p class="text-[8px] leading-relaxed mb-2" style="color:${theme.secondary}">${content.body || ''}</p>
      <!-- 知识行 -->
      <div class="mb-2">${rows}</div>
    </div>
    <div>
      <div>${tagHtml}</div>
      <div class="text-[7px] opacity-60 mt-1">${footer}</div>
    </div>
  </div>
</div>`;
  }

  // ==================== 主题配置 ====================

  private getTheme(templateId: string): {
    name: string; bg: string; text: string; accent: string; secondary: string; tag: string;
  } {
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
