import React from 'react';
import type { CardContent, CardTemplate, KnowledgeModule } from '../types';

interface RichCardRendererProps {
  template: CardTemplate;
  content: CardContent;
  imageUrl?: string;
  scale?: number;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 富文本卡片渲染器（V3 — PPT式精简排版）
 *
 * 设计原则（基于外网研究）：
 * 1. 一卡一概念：每张卡片只承载一个知识单元，≤3个核心点
 * 2. 零段落：只用关键词、短句、标签，绝不大段文字
 * 3. 三级层级：标题(大) → 关键词卡(中) → 标签注释(小)
 * 4. 模块化迷你卡：每个知识点独立成卡，带图标+色彩编码
 * 5. 关键词胶囊：用药丸式标签替代句子
 * 6. 30%留白：文字区域控制在60%可见区内
 * 7. 结论先行：核心概念放顶部，细节在下
 */
export const RichCardRenderer: React.FC<RichCardRendererProps> = (props) => {
  const { template, content, imageUrl, scale = 1, innerRef } = props;
  const { canvas } = template;

  const renderContent = () => {
    switch (template.htmlTemplateId) {
      case 'scroll-history':
        return <ScrollHistoryCard content={content} imageUrl={imageUrl} canvas={canvas} />;
      case 'handcraft-compare':
        return <HandcraftCompareCard content={content} imageUrl={imageUrl} canvas={canvas} />;
      case 'tech-infographic':
        return <TechInfographicCard content={content} imageUrl={imageUrl} canvas={canvas} />;
      case 'nature-science':
        return <NatureScienceCard content={content} imageUrl={imageUrl} canvas={canvas} />;
      default:
        return <div>未知模板: {template.htmlTemplateId}</div>;
    }
  };

  return (
    <div
      ref={innerRef}
      style={{
        width: canvas.width,
        height: canvas.height,
        backgroundColor: canvas.backgroundColor,
        position: 'relative',
        overflow: 'hidden',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      {renderContent()}
    </div>
  );
};

// ============================================================
// 共享工具：从modules提取关键词标签
// ============================================================

/** 从module的bullets中提取关键词，每条截断到≤10字 */
function extractKeywords(module: KnowledgeModule | undefined, maxCount: number = 3): string[] {
  if (!module?.bullets || module.bullets.length === 0) return [];
  return module.bullets.slice(0, maxCount).map(b => b.length > 10 ? b.slice(0, 9) + '…' : b);
}

/** 从module的content中提取一句话核心概念（≤20字） */
function extractCoreConcept(content: CardContent): string {
  const raw = content.body || content.definition || content.modules?.[0]?.content || '';
  // 截断到20字以内
  return raw.length > 20 ? raw.slice(0, 19) + '…' : raw;
}

/** 从modules构建迷你卡片数据 */
function buildMiniCards(content: CardContent, maxCount: number = 3) {
  const modules = content.modules || [];
  return modules.slice(0, maxCount).map((m, i) => ({
    id: m.id,
    title: m.title.length > 6 ? m.title.slice(0, 5) + '…' : m.title,
    icon: m.icon || '📌',
    keywords: extractKeywords(m, 2),
    index: i + 1,
  }));
}

// ============================================================
// 1. 国风卷轴历史卡片 — PPT式精简
// ============================================================
const ScrollHistoryCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl }) => {
  const highlights = (content.highlights || []).slice(0, 4).map(h => h.length > 8 ? h.slice(0, 7) + '…' : h);
  const tags = content.tags || [];
  const coreConcept = extractCoreConcept(content);
  const miniCards = buildMiniCards(content, 3);

  // 国风配色
  const cardColors = [
    { accent: '#b85450', bg: 'rgba(184,84,80,0.08)' },
    { accent: '#8b6914', bg: 'rgba(139,105,20,0.08)' },
    { accent: '#5a7a3a', bg: 'rgba(90,122,58,0.08)' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Noto Serif SC", "Songti SC", serif',
      background: '#e8dcc4',
    }}>
      {/* 全幅背景 */}
      {imageUrl ? (
        <img src={imageUrl} crossOrigin="anonymous" alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #d4c4a0, #e8dcc4)' }} />
      )}

      {/* 顶部渐变 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '38%',
        background: imageUrl ? 'linear-gradient(180deg, rgba(30,18,6,0.65) 0%, rgba(30,18,6,0.15) 60%, transparent 100%)' : 'none',
        pointerEvents: 'none',
      }} />

      {/* 底部毛玻璃 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '68%',
        zIndex: 1,
        background: imageUrl
          ? 'linear-gradient(180deg, transparent 0%, rgba(232,220,196,0.85) 14%, rgba(232,220,196,0.95) 100%)'
          : 'rgba(232,220,196,0.5)',
        backdropFilter: imageUrl ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: imageUrl ? 'blur(18px)' : 'none',
        pointerEvents: 'none',
      }} />

      {/* 卷轴轴头 */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, background: 'linear-gradient(90deg, #5a4020, #8b6914 50%, #5a4020)', zIndex: 3 }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 18, background: 'linear-gradient(90deg, #5a4020, #8b6914 50%, #5a4020)', zIndex: 3 }} />

      {/* 内容层 */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '0 34px' }}>

        {/* ===== 标题区 ===== */}
        <div style={{ padding: '36px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              {content.chapter && (
                <div style={{
                  display: 'inline-block', background: '#b85450', color: '#fff',
                  fontSize: 13, fontWeight: 700, padding: '3px 12px', borderRadius: 2,
                  marginBottom: 10, letterSpacing: '0.15em',
                  boxShadow: '0 2px 8px rgba(184,84,80,0.35)',
                }}>{content.chapter}</div>
              )}
              <h1 style={{
                fontSize: 36, fontWeight: 700,
                color: imageUrl ? '#fff' : '#2d1a0a',
                margin: 0, letterSpacing: '0.06em', lineHeight: 1.15,
                textShadow: imageUrl ? '0 2px 16px rgba(0,0,0,0.5)' : 'none',
              }}>{content.title}</h1>
              {content.subtitle && (
                <p style={{
                  fontSize: 15, color: imageUrl ? 'rgba(255,255,255,0.8)' : '#8b6914',
                  margin: '5px 0 0', fontWeight: 400, letterSpacing: '0.05em',
                  textShadow: imageUrl ? '0 1px 8px rgba(0,0,0,0.4)' : 'none',
                }}>{content.subtitle}</p>
              )}
            </div>
            {/* 印章 */}
            <div style={{
              width: 50, height: 50, background: '#b85450', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, fontWeight: 700,
              transform: 'rotate(-5deg)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
              border: '2px solid #a04440', flexShrink: 0,
              letterSpacing: '0.05em',
            }}>知</div>
          </div>
        </div>

        {/* 留白呼吸 */}
        <div style={{ flex: 0, minHeight: imageUrl ? 80 : 20 }} />

        {/* ===== 内容面板 ===== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', paddingBottom: 8 }}>

          {/* 核心概念 — 一句话，非段落 */}
          {coreConcept && (
            <div style={{
              padding: '10px 16px',
              background: 'rgba(184,84,80,0.1)', borderRadius: 6,
              borderLeft: '4px solid #b85450',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>❖</span>
              <p style={{ fontSize: 15, color: '#3d2810', lineHeight: 1.4, margin: 0, fontWeight: 700, letterSpacing: '0.03em' }}>{coreConcept}</p>
            </div>
          )}

          {/* 迷你知识卡 — 图标+短标题+关键词标签 */}
          {miniCards.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {miniCards.map((card, i) => {
                const colors = cardColors[i % cardColors.length];
                return (
                  <div key={card.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.55)', borderRadius: 8,
                    borderLeft: `3px solid ${colors.accent}`,
                    boxShadow: '0 1px 6px rgba(60,40,10,0.05)',
                  }}>
                    {/* 图标 */}
                    <span style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: 'center' }}>{card.icon}</span>
                    {/* 短标题 */}
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: '#2d1a0a',
                      flexShrink: 0, minWidth: 50, letterSpacing: '0.03em',
                    }}>{card.title}</span>
                    {/* 分隔线 */}
                    <span style={{ width: 1, height: 16, background: 'rgba(139,105,20,0.2)', flexShrink: 0 }} />
                    {/* 关键词标签 */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
                      {card.keywords.map((kw, ki) => (
                        <span key={ki} style={{
                          fontSize: 11, color: colors.accent, fontWeight: 600,
                          background: colors.bg, padding: '2px 8px', borderRadius: 10,
                          letterSpacing: '0.02em',
                        }}>{kw}</span>
                      ))}
                      {/* 如果没有bullets，显示模块content的截断 */}
                      {card.keywords.length === 0 && (
                        <span style={{ fontSize: 12, color: '#5a4020', lineHeight: 1.4 }}>
                          {(content.modules?.[i]?.content || '').slice(0, 15)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 关键词胶囊流 */}
          {highlights.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '4px 2px' }}>
              {highlights.map((h, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, color: '#8b6914',
                  background: 'rgba(139,105,20,0.08)', padding: '3px 10px', borderRadius: 12,
                  border: '1px solid rgba(139,105,20,0.15)',
                  letterSpacing: '0.02em',
                }}>{h}</span>
              ))}
            </div>
          )}
        </div>

        {/* 底栏 */}
        <div style={{
          padding: '6px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} style={{
                fontSize: 10, color: '#8b6914',
                border: '1px solid rgba(139,105,20,0.25)',
                padding: '1px 7px', borderRadius: 10, background: 'rgba(255,255,255,0.3)',
              }}>#{tag}</span>
            ))}
          </div>
          <span style={{ fontSize: 10, color: 'rgba(139,105,20,0.6)' }}>{content.footer}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 2. 手账风对比卡片 — PPT式精简
// ============================================================
const HandcraftCompareCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl }) => {
  const tags = content.tags || [];
  const coreConcept = extractCoreConcept(content);

  // sections 回退到 modules
  const sections = (content.sections && content.sections.length > 0)
    ? content.sections
    : (content.modules || []).map((m, i) => ({
        id: m.id,
        title: m.title.length > 5 ? m.title.slice(0, 4) + '…' : m.title,
        body: m.content || '',
        bullets: m.bullets || [],
        icon: m.icon || '📌',
        index: i + 1,
      }));

  // 手账风配色
  const cardColors = [
    { bg: '#A8C8EC', tape: '#7BA8D4', accent: '#4A7FA8', light: 'rgba(74,127,168,0.1)' },
    { bg: '#C4D7A4', tape: '#9AC080', accent: '#5A8A3A', light: 'rgba(90,138,58,0.1)' },
    { bg: '#F4C2C2', tape: '#E89B9B', accent: '#C46A6A', light: 'rgba(196,106,106,0.1)' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Noto Sans SC", sans-serif',
      background: '#f5f0e6',
    }}>
      {/* 全幅背景 */}
      {imageUrl ? (
        <img src={imageUrl} crossOrigin="anonymous" alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(232,168,124,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(168,200,236,0.08) 0%, transparent 50%),
            #f5f0e6
          `,
        }} />
      )}

      {/* 顶部渐变 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '33%',
        background: imageUrl ? 'linear-gradient(180deg, rgba(40,30,20,0.5) 0%, rgba(40,30,20,0.1) 60%, transparent 100%)' : 'none',
        pointerEvents: 'none',
      }} />

      {/* 底部毛玻璃 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
        zIndex: 1,
        background: imageUrl
          ? 'linear-gradient(180deg, transparent 0%, rgba(245,240,230,0.87) 12%, rgba(245,240,230,0.96) 100%)'
          : 'rgba(245,240,230,0.5)',
        backdropFilter: imageUrl ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: imageUrl ? 'blur(18px)' : 'none',
        pointerEvents: 'none',
      }} />

      {/* 顶部胶带 */}
      <div style={{
        position: 'absolute', top: 14, left: '34%', width: 100, height: 24,
        background: 'rgba(244,208,63,0.75)',
        border: '1px dashed rgba(200,170,50,0.3)',
        transform: 'rotate(-3deg)', borderRadius: 2, zIndex: 3,
      }} />

      {/* 内容层 */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 30px 18px' }}>

        {/* ===== 标题区 ===== */}
        <div style={{ textAlign: 'center', marginBottom: 12, position: 'relative', flexShrink: 0 }}>
          <div style={{ position: 'absolute', left: '14%', top: 0, fontSize: 20 }}>⭐</div>
          <div style={{ position: 'absolute', right: '14%', top: 0, fontSize: 20 }}>⭐</div>

          <h1 style={{
            fontSize: 28, fontWeight: 800,
            color: imageUrl ? '#fff' : '#2d2d2d',
            margin: '0 0 5px', letterSpacing: '0.03em', lineHeight: 1.2,
            textShadow: imageUrl ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
          }}>{content.title}</h1>

          <div style={{ width: 50, height: 3, background: '#f4d03f', margin: '0 auto 6px', borderRadius: 2 }} />

          {content.subtitle && (
            <p style={{
              fontSize: 13, color: imageUrl ? 'rgba(255,255,255,0.85)' : '#888',
              margin: 0, fontWeight: 500,
            }}>{content.subtitle}</p>
          )}
        </div>

        {/* 留白呼吸 */}
        <div style={{ flex: 0, minHeight: imageUrl ? 60 : 10 }} />

        {/* ===== 核心概念 ===== */}
        {coreConcept && (
          <div style={{
            padding: '8px 14px',
            background: 'rgba(244,208,63,0.15)', borderRadius: 8,
            border: '1px dashed rgba(200,170,50,0.3)',
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 10, flexShrink: 0,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
            <p style={{ fontSize: 14, color: '#5a4a20', lineHeight: 1.4, margin: 0, fontWeight: 700 }}>{coreConcept}</p>
          </div>
        )}

        {/* ===== 对比迷你卡片 ===== */}
        {sections.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(sections.length, 3)}, 1fr)`,
            gap: 8, flex: 1, overflow: 'hidden',
          }}>
            {sections.slice(0, 3).map((sec, i) => {
              const colors = cardColors[i % cardColors.length];
              const bullets = (sec as any).bullets || extractKeywords(content.modules?.[i], 2) || [];
              return (
                <div key={sec.id} style={{
                  background: 'rgba(255,255,255,0.75)', borderRadius: 10,
                  padding: '12px 10px 10px', position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  borderTop: `3px solid ${colors.bg}`,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {/* 胶带 */}
                  <div style={{
                    position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
                    width: 38, height: 12, background: colors.tape, opacity: 0.85, borderRadius: 2,
                  }} />
                  {/* 图标 */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: colors.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, margin: '0 auto',
                  }}>{sec.icon || '📌'}</div>
                  {/* 短标题 */}
                  <h3 style={{
                    fontSize: 13, fontWeight: 700, color: colors.accent,
                    textAlign: 'center', margin: 0, letterSpacing: '0.02em',
                  }}>{sec.title}</h3>
                  {/* 关键词标签 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                    {bullets.length > 0 ? bullets.map((b: string, bi: number) => (
                      <span key={bi} style={{
                        fontSize: 10, color: colors.accent, fontWeight: 600,
                        background: colors.light, padding: '2px 8px', borderRadius: 8,
                        textAlign: 'center',
                      }}>{b.length > 8 ? b.slice(0, 7) + '…' : b}</span>
                    )) : (
                      <span style={{ fontSize: 11, color: '#777', textAlign: 'center' }}>
                        {(sec.body || '').slice(0, 12)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 底栏 */}
        <div style={{
          marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} style={{
                fontSize: 10, color: '#999', border: '1px dashed #ccc',
                padding: '1px 6px', borderRadius: 8, background: 'rgba(244,208,63,0.1)',
              }}>#{tag}</span>
            ))}
          </div>
          <span style={{ fontSize: 10, color: '#bbb' }}>{content.footer}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 3. 科技信息图卡片 — PPT式精简
// ============================================================
const TechInfographicCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl }) => {
  const highlights = (content.highlights || []).slice(0, 5).map(h => h.length > 8 ? h.slice(0, 7) + '…' : h);
  const tags = content.tags || [];
  const quote = content.quote || '';
  const coreConcept = extractCoreConcept(content);
  const miniCards = buildMiniCards(content, 4);

  // 科技风配色
  const moduleColors = [
    { bg: '#5b4fc4', light: 'rgba(91,79,196,0.1)' },
    { bg: '#2E9AD1', light: 'rgba(46,154,209,0.1)' },
    { bg: '#4ABF6F', light: 'rgba(74,191,111,0.1)' },
    { bg: '#E8913A', light: 'rgba(232,145,58,0.1)' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Noto Sans SC", sans-serif',
      background: '#1a1a2e',
    }}>
      {/* 全幅背景 */}
      {imageUrl ? (
        <img src={imageUrl} crossOrigin="anonymous" alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a2e, #2d2d4a)' }} />
      )}

      {/* 顶部渐变 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '33%',
        background: imageUrl ? 'linear-gradient(180deg, rgba(15,12,30,0.78) 0%, rgba(15,12,30,0.15) 60%, transparent 100%)' : 'none',
        pointerEvents: 'none',
      }} />

      {/* 底部毛玻璃 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '72%',
        zIndex: 1,
        background: imageUrl
          ? 'linear-gradient(180deg, transparent 0%, rgba(248,248,252,0.9) 10%, rgba(248,248,252,0.98) 100%)'
          : 'rgba(248,248,252,0.5)',
        backdropFilter: imageUrl ? 'blur(22px)' : 'none',
        WebkitBackdropFilter: imageUrl ? 'blur(22px)' : 'none',
        pointerEvents: 'none',
      }} />

      {/* 内容层 */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* ===== 标题区 ===== */}
        <div style={{ padding: '32px 36px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* 编号徽章 */}
            <div style={{
              background: '#5b4fc4', color: '#fff',
              fontSize: 16, fontWeight: 800, padding: '5px 12px', borderRadius: 8,
              flexShrink: 0, letterSpacing: '0.05em',
              boxShadow: '0 4px 14px rgba(91,79,196,0.45)',
            }}>{content.chapter || '01'}</div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <h1 style={{
                fontSize: 28, fontWeight: 800,
                color: imageUrl ? '#fff' : '#1a1a2e',
                margin: '0 0 3px', lineHeight: 1.15, letterSpacing: '-0.01em',
                textShadow: imageUrl ? '0 2px 14px rgba(0,0,0,0.5)' : 'none',
              }}>{content.title}</h1>
              {content.subtitle && (
                <p style={{
                  fontSize: 14, color: imageUrl ? 'rgba(190,180,255,0.95)' : '#5b4fc4',
                  margin: 0, fontWeight: 600, letterSpacing: '0.02em',
                }}>{content.subtitle}</p>
              )}
            </div>
          </div>
        </div>

        {/* 留白呼吸 */}
        <div style={{ flex: 0, minHeight: imageUrl ? 70 : 12 }} />

        {/* ===== 内容面板 ===== */}
        <div style={{ flex: 1, padding: '0 32px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>

          {/* 核心概念 — 一句话高亮 */}
          {coreConcept && (
            <div style={{
              padding: '10px 16px',
              background: 'rgba(91,79,196,0.1)', borderRadius: 10,
              borderLeft: '4px solid #5b4fc4',
              display: 'flex', alignItems: 'center', gap: 8,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
              <p style={{ fontSize: 15, color: '#2d2d3a', lineHeight: 1.4, margin: 0, fontWeight: 700, letterSpacing: '0.01em' }}>{coreConcept}</p>
            </div>
          )}

          {/* 迷你知识卡网格 */}
          {miniCards.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
              {miniCards.map((card, i) => {
                const colors = moduleColors[i % moduleColors.length];
                return (
                  <div key={card.id} style={{
                    background: 'rgba(255,255,255,0.75)', borderRadius: 10, padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 5,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                    border: `1px solid ${colors.light}`,
                    borderLeft: `3px solid ${colors.bg}`,
                  }}>
                    {/* 标题行：图标 + 短标题 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{card.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.bg, letterSpacing: '0.02em' }}>{card.title}</span>
                    </div>
                    {/* 关键词标签 */}
                    {card.keywords.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {card.keywords.map((kw, bi) => (
                          <span key={bi} style={{
                            fontSize: 10, color: colors.bg, fontWeight: 600,
                            background: colors.light, padding: '2px 7px', borderRadius: 4,
                          }}>{kw}</span>
                        ))}
                      </div>
                    )}
                    {/* 无bullets时显示content截断 */}
                    {card.keywords.length === 0 && (
                      <p style={{ fontSize: 11, color: '#666', margin: 0, lineHeight: 1.4 }}>
                        {(content.modules?.[i]?.content || '').slice(0, 18)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 关键词胶囊流 */}
          {highlights.length > 0 && (
            <div style={{
              display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center',
              padding: '6px 2px', flexShrink: 0,
            }}>
              {highlights.map((h, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 700, color: '#5b4fc4',
                  background: 'rgba(91,79,196,0.08)', padding: '3px 10px', borderRadius: 20,
                  border: '1px solid rgba(91,79,196,0.15)',
                  letterSpacing: '0.02em',
                }}>{h}</span>
              ))}
            </div>
          )}

          {/* 金句 — 一行 */}
          {quote && (
            <div style={{ padding: '4px 16px', textAlign: 'center', flexShrink: 0 }}>
              <p style={{
                fontSize: 12, color: '#999', fontWeight: 500, margin: 0,
                fontStyle: 'italic', letterSpacing: '0.03em',
              }}>"{quote.length > 15 ? quote.slice(0, 14) + '…' : quote}"</p>
            </div>
          )}
        </div>

        {/* 底栏 */}
        <div style={{
          padding: '6px 32px 12px', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} style={{
                fontSize: 10, color: 'rgba(91,79,196,0.7)', fontWeight: 600,
                background: 'rgba(91,79,196,0.08)', padding: '2px 7px', borderRadius: 4,
              }}>#{tag}</span>
            ))}
          </div>
          <span style={{ fontSize: 10, color: '#aaa', fontWeight: 500 }}>{content.footer}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 4. 自然科普卡片 — PPT式精简
// ============================================================
const NatureScienceCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl }) => {
  const highlights = (content.highlights || []).slice(0, 4).map(h => h.length > 8 ? h.slice(0, 7) + '…' : h);
  const tags = content.tags || [];
  const coreConcept = extractCoreConcept(content);
  const miniCards = buildMiniCards(content, 3);

  // 自然风配色
  const cardColors = [
    { accent: '#5a7a3a', light: 'rgba(90,122,58,0.1)' },
    { accent: '#8b6914', light: 'rgba(139,105,20,0.1)' },
    { accent: '#b85450', light: 'rgba(184,84,80,0.1)' },
    { accent: '#3a6a8a', light: 'rgba(58,106,138,0.1)' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Noto Serif SC", "Songti SC", serif',
      background: '#f5f0e0',
    }}>
      {/* 全幅背景 */}
      {imageUrl ? (
        <img src={imageUrl} crossOrigin="anonymous" alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(circle at 15% 85%, rgba(139,105,20,0.06) 0%, transparent 45%),
            radial-gradient(circle at 85% 15%, rgba(139,105,20,0.06) 0%, transparent 45%),
            #f5f0e0
          `,
        }} />
      )}

      {/* 顶部渐变 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: imageUrl
          ? 'linear-gradient(180deg, rgba(20,12,4,0.6) 0%, rgba(20,12,4,0.15) 60%, transparent 100%)'
          : 'none',
        pointerEvents: 'none',
      }} />

      {/* 底部毛玻璃 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%',
        zIndex: 1,
        background: imageUrl
          ? 'linear-gradient(180deg, transparent 0%, rgba(245,240,224,0.85) 14%, rgba(245,240,224,0.95) 100%)'
          : 'rgba(245,240,224,0.6)',
        backdropFilter: imageUrl ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: imageUrl ? 'blur(18px)' : 'none',
        pointerEvents: 'none',
      }} />

      {/* 内容层 */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ===== 标题区 ===== */}
        <div style={{ padding: '38px 40px 0', flexShrink: 0 }}>
          {/* 系列标签 */}
          {tags[0] && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginBottom: 12,
              padding: '3px 12px',
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>❀</span>
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,0.95)',
                letterSpacing: '0.2em', fontWeight: 500,
              }}>{tags[0]} · 自然志</span>
            </div>
          )}

          {/* 编号 + 标题 */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
            <span style={{
              fontSize: 64, fontWeight: 200,
              color: imageUrl ? 'rgba(255,255,255,0.9)' : '#8b6914',
              fontFamily: '"Noto Sans SC", sans-serif',
              lineHeight: 0.85,
              textShadow: imageUrl ? '0 2px 16px rgba(0,0,0,0.3)' : 'none',
            }}>{content.chapter || '01'}</span>
            <div style={{ flex: 1, paddingBottom: 5 }}>
              <h1 style={{
                fontSize: 32, fontWeight: 700,
                color: imageUrl ? '#fff' : '#2d1a0a',
                margin: 0, letterSpacing: '0.04em',
                lineHeight: 1.15,
                textShadow: imageUrl ? '0 2px 12px rgba(0,0,0,0.4)' : 'none',
              }}>{content.title}</h1>
              {content.subtitle && (
                <p style={{
                  fontSize: 14,
                  color: imageUrl ? 'rgba(255,255,255,0.8)' : '#8b6914',
                  margin: '5px 0 0',
                  textShadow: imageUrl ? '0 1px 8px rgba(0,0,0,0.3)' : 'none',
                }}>{content.subtitle}</p>
              )}
            </div>

            {/* 印章 */}
            <div style={{
              width: 46, height: 46,
              background: 'rgba(184,84,80,0.92)',
              borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 12, fontWeight: 700,
              transform: 'rotate(-6deg)',
              border: '2px solid rgba(160,68,64,0.9)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              flexShrink: 0,
              marginBottom: 6,
            }}>自然</div>
          </div>
        </div>

        {/* 留白呼吸 */}
        <div style={{ flex: 0, minHeight: imageUrl ? 90 : 20 }} />

        {/* ===== 内容面板 ===== */}
        <div style={{
          flex: 1,
          padding: '0 40px 14px',
          display: 'flex', flexDirection: 'column', gap: 12,
          overflow: 'hidden',
        }}>

          {/* 核心概念 — 一句话 */}
          {coreConcept && (
            <div style={{
              padding: '10px 16px',
              background: 'rgba(90,122,58,0.1)', borderRadius: 8,
              borderLeft: '4px solid #5a7a3a',
              display: 'flex', alignItems: 'center', gap: 8,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🌿</span>
              <p style={{ fontSize: 14, color: '#3d2810', lineHeight: 1.4, margin: 0, fontWeight: 700, letterSpacing: '0.02em' }}>{coreConcept}</p>
            </div>
          )}

          {/* 迷你知识卡 — 横向排列 */}
          {miniCards.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {miniCards.map((card, i) => {
                const colors = cardColors[i % cardColors.length];
                return (
                  <div key={card.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.55)', borderRadius: 8,
                    borderLeft: `3px solid ${colors.accent}`,
                    boxShadow: '0 1px 6px rgba(60,40,10,0.05)',
                  }}>
                    {/* 图标 */}
                    <span style={{ fontSize: 18, flexShrink: 0, width: 26, textAlign: 'center' }}>{card.icon}</span>
                    {/* 短标题 */}
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: '#2d1a0a',
                      flexShrink: 0, minWidth: 48, letterSpacing: '0.03em',
                    }}>{card.title}</span>
                    {/* 分隔 */}
                    <span style={{ width: 1, height: 14, background: 'rgba(139,105,20,0.2)', flexShrink: 0 }} />
                    {/* 关键词 */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
                      {card.keywords.map((kw, ki) => (
                        <span key={ki} style={{
                          fontSize: 11, color: colors.accent, fontWeight: 600,
                          background: colors.light, padding: '2px 8px', borderRadius: 10,
                        }}>{kw}</span>
                      ))}
                      {card.keywords.length === 0 && (
                        <span style={{ fontSize: 11, color: '#5a4020', lineHeight: 1.4 }}>
                          {(content.modules?.[i]?.content || '').slice(0, 15)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 关键词胶囊流 */}
          {highlights.length > 0 && (
            <div style={{
              display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center',
              padding: '4px 2px', flexShrink: 0,
            }}>
              {highlights.map((h, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, color: '#8b6914',
                  background: 'rgba(139,105,20,0.08)', padding: '3px 10px', borderRadius: 12,
                  border: '1px solid rgba(139,105,20,0.12)',
                }}>{h}</span>
              ))}
            </div>
          )}
        </div>

        {/* 底栏 */}
        <div style={{
          padding: '6px 40px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} style={{
                fontSize: 10, color: '#8b6914',
                border: '1px solid rgba(139,105,20,0.2)',
                padding: '1px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,0.3)',
              }}>#{tag}</span>
            ))}
          </div>
          <span style={{ fontSize: 10, color: 'rgba(139,105,20,0.6)' }}>{content.footer}</span>
        </div>
      </div>
    </div>
  );
};
