import React, { useMemo, useRef, useEffect, useState } from 'react';
import type { CardTemplate, CardContent, StylePreset } from '../types';
import { KnowledgeCardRenderer } from './KnowledgeCardRenderer';

// ============================================================
// Mock 内容生成器 — 为每种模板生成示例内容，用于输入阶段的预览
// ============================================================

function getMockContent(template: CardTemplate): CardContent {
  const id = template.htmlTemplateId || template.id;

  // 通用基础内容
  const base: CardContent = {
    title: '示例标题',
    subtitle: '示例副标题',
    body: '这是模板预览的示例正文内容，实际使用时会根据您的主题自动生成完整的知识内容。',
    footer: 'AI信息图工作室',
    tags: ['知识分享', '科普', '图解'],
    seriesName: '知识系列',
    episode: '01',
    totalEpisodes: '06',
    topicNumber: '01',
    englishSubtitle: 'Sample Topic',
    quote: '知识让生活更美好',
    highlights: ['要点一', '要点二', '要点三'],
  };

  switch (id) {
    case 'lifecycle':
      return {
        ...base,
        title: '生命周期图鉴',
        subtitle: '第一阶段 · 新生期',
        body: '刚出生的个体十分脆弱，需要亲鸟的悉心照料。绒羽稀疏，眼睛尚未完全睁开，主要依靠亲鸟喂食。',
        modules: [
          { id: 'm1', type: 'concept', title: '外观特征', content: '体型娇小，绒毛稀疏，喙部短软。', icon: '🐣' },
          { id: 'm2', type: 'points', title: '关键行为', content: '', bullets: ['依赖亲鸟喂食', '体温调节能力弱', '大部分时间在巢中'], icon: '📋' },
        ],
      };

    case 'timeline':
      return {
        ...base,
        title: '历史时间线',
        subtitle: '起源时期 · 公元前200年',
        body: '这一时期标志着文明的萌芽，重要的技术发明和文化交流开始出现，为后续的繁荣奠定了基础。',
        modules: [
          { id: 'm1', type: 'fact', title: '时代背景', content: '社会结构逐渐完善，贸易路线开始形成。', icon: '📜' },
          { id: 'm2', type: 'points', title: '重要事件', content: '', bullets: ['丝绸之路开辟', '造纸术发明', '文化交流加深'], icon: '🏛️' },
        ],
      };

    case 'process':
      return {
        ...base,
        title: '流程步骤图',
        subtitle: '第一步 · 准备阶段',
        body: '在开始之前，需要准备好所有必要的材料和工具，了解基本流程和注意事项。',
        modules: [
          { id: 'm1', type: 'process', title: '操作步骤', content: '检查材料完整性，熟悉工具使用方法。', icon: '🔧' },
          { id: 'm2', type: 'tip', title: '小贴士', content: '', bullets: ['提前阅读说明书', '整理工作台面', '准备备用材料'], icon: '💡' },
        ],
      };

    case 'encyclopedia':
      return {
        ...base,
        title: '百科词条',
        subtitle: '知识体系梳理',
        body: '本词条将从定义、特征、应用等方面对主题进行全面解读，帮助读者建立系统的知识框架。',
        definition: '这是一个示例概念定义，用于展示百科词条卡的结构布局和视觉效果。',
        modules: [
          { id: 'm1', type: 'concept', title: '基本概念', content: '核心定义和基本原理的详细说明。', icon: '💡' },
          { id: 'm2', type: 'example', title: '实例说明', content: '通过具体案例帮助理解抽象概念。', icon: '📋' },
          { id: 'm3', type: 'note', title: '注意事项', content: '需要特别关注的要点和常见误区。', icon: '⚠️' },
        ],
      };

    case 'compare-card':
      return {
        ...base,
        title: '对比分析',
        subtitle: '三种方案对比',
        body: '通过多维度对比，帮助读者快速了解不同方案的特点和适用场景，做出更明智的选择。',
        compareItems: [
          { id: 'c1', label: '方案A', badge: '推荐', features: ['简单易用', '成本低', '上手快'], suitableFor: '初学者' },
          { id: 'c2', label: '方案B', badge: '专业', features: ['功能强大', '可定制', '扩展性好'], suitableFor: '进阶用户' },
          { id: 'c3', label: '方案C', badge: '全能', features: ['性能优异', '生态完善', '社区活跃'], suitableFor: '专业团队' },
        ],
      };

    case 'quick-knowledge':
    default:
      return {
        ...base,
        title: '知识速记',
        subtitle: '一分钟了解',
        body: '用结构化的方式快速掌握核心知识，适合社交媒体分享和碎片化学习。',
        definition: '这是示例概念定义，帮助快速理解主题的核心含义。',
        modules: [
          { id: 'm1', type: 'concept', title: '核心概念', content: '用简洁的语言解释最重要的概念。', icon: '💡' },
          { id: 'm2', type: 'points', title: '关键要点', content: '', bullets: ['要点一：简明扼要', '要点二：重点突出', '要点三：便于记忆'], icon: '🎯' },
          { id: 'm3', type: 'example', title: '实例说明', content: '通过生动的例子加深理解。', icon: '📋' },
        ],
      };
  }
}

// ============================================================
// 模板预览组件
// ============================================================

interface TemplatePreviewProps {
  template: CardTemplate;
  stylePreset?: StylePreset;
}

/**
 * 模板预览组件
 * 在输入阶段展示选中模板的样式预览，使用 Mock 内容 + 当前风格预设
 */
export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ template, stylePreset }) => {
  const mockContent = useMemo(() => getMockContent(template), [template.id]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);

  // 根据容器尺寸自动计算缩放比例，让预览卡居中适配
  useEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth - 48;   // padding
      const ch = container.clientHeight - 48;  // padding
      const sw = template.canvas.width;
      const sh = template.canvas.height;
      if (sw === 0 || sh === 0) return;
      const s = Math.min(cw / sw, ch / sh, 0.55);
      setScale(Math.max(0.15, s));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [template.canvas.width, template.canvas.height]);

  const cardCount = template.cardCount && template.cardCount > 1 ? template.cardCount : 1;

  return (
    <div className="w-full h-full flex flex-col">
      {/* 顶部信息栏 */}
      <div className="px-6 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">模板预览</span>
          <span className="text-xs text-gray-400">{template.canvas.width}×{template.canvas.height}</span>
          {cardCount > 1 && <span className="text-xs text-blue-500">{cardCount}张系列</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">风格: {stylePreset?.name || '默认'}</span>
          <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">预览模式</span>
        </div>
      </div>

      {/* 预览区 */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-auto p-6"
        style={{ background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%) 50% / 20px 20px' }}
      >
        <div style={{
          width: template.canvas.width * scale,
          height: template.canvas.height * scale,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <KnowledgeCardRenderer
            template={template}
            content={mockContent}
            scale={scale}
            stylePreset={stylePreset}
            cardIndex={0}
          />
        </div>
      </div>

      {/* 底部模板描述 */}
      <div className="px-6 py-2 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
        <span>{template.name} · {template.description.slice(0, 40)}{template.description.length > 40 ? '...' : ''}</span>
        <span className="text-gray-400">点击左侧模板切换预览</span>
      </div>
    </div>
  );
};
