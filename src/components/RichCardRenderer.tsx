import React from 'react';
import type { CardContent, CardTemplate } from '../types';

interface RichCardRendererProps {
  template: CardTemplate;
  content: CardContent;
  imageUrl?: string;
  scale?: number;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 富文本卡片渲染器
 * 根据模板的 htmlTemplateId 选择对应的渲染组件
 * 每个组件实现一种复杂的卡片风格
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
// 1. 国风卷轴历史卡片（参考：王安石变法）
// ============================================================
const ScrollHistoryCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl, canvas }) => {
  const sections = content.sections || [];
  const highlights = content.highlights || [];
  const tags = content.tags || [];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"Noto Serif SC", serif' }}>
      {/* 卷轴标题区 */}
      <div style={{
        background: 'linear-gradient(180deg, #d4c4a0 0%, #e8dcc4 50%, #d4c4a0 100%)',
        padding: '24px 40px 20px',
        borderBottom: '3px solid #8b6914',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* 左侧卷轴轴头 */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(90deg, #5a4020, #8b6914, #5a4020)' }} />
        {/* 右侧卷轴轴头 */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(90deg, #5a4020, #8b6914, #5a4020)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {/* 章节编号 */}
            {content.chapter && (
              <div style={{
                display: 'inline-block',
                background: '#b85450',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                padding: '2px 12px',
                borderRadius: 2,
                marginBottom: 8,
                letterSpacing: '0.1em',
              }}>{content.chapter}</div>
            )}
            {/* 主标题 */}
            <h1 style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#2d1a0a',
              margin: 0,
              letterSpacing: '0.05em',
              lineHeight: 1.2,
            }}>{content.title}</h1>
            {/* 副标题 */}
            {content.subtitle && (
              <p style={{
                fontSize: 18,
                color: '#8b6914',
                margin: '6px 0 0',
                fontWeight: 400,
              }}>{content.subtitle}</p>
            )}
          </div>
          {/* 印章 */}
          <div style={{
            width: 60, height: 60,
            background: '#b85450',
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 700,
            transform: 'rotate(-5deg)',
            boxShadow: '0 2px 8px rgba(184,84,80,0.4)',
            border: '2px solid #a04440',
          }}>知识</div>
        </div>
      </div>

      {/* AI插图区 */}
      {imageUrl && (
        <div style={{
          width: '100%', height: 280,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          flexShrink: 0,
        }}>
          {/* 渐变过渡 */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, #e8dcc4)' }} />
        </div>
      )}

      {/* 内容区块网格 */}
      <div style={{
        flex: 1,
        background: '#e8dcc4',
        padding: '16px 40px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'hidden',
      }}>
        {/* 两列区块 */}
        {sections.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {sections.slice(0, 4).map((sec, i) => (
              <div key={sec.id} style={{
                background: 'rgba(255,255,255,0.5)',
                borderRadius: 8,
                padding: '12px 14px',
                border: '1px solid rgba(139,105,20,0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#b85450', color: '#fff',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{sec.index || i + 1}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#2d1a0a' }}>{sec.title}</span>
                </div>
                <p style={{ fontSize: 12, color: '#5a4020', lineHeight: 1.6, margin: 0 }}>{sec.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* 全宽区块（如果有第5个） */}
        {sections.length > 4 && (
          <div style={{
            background: 'rgba(255,255,255,0.5)',
            borderRadius: 8,
            padding: '12px 14px',
            border: '1px solid rgba(139,105,20,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%',
                background: '#b85450', color: '#fff',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>{sections[4].index || 5}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2d1a0a' }}>{sections[4].title}</span>
            </div>
            <p style={{ fontSize: 12, color: '#5a4020', lineHeight: 1.6, margin: 0 }}>{sections[4].body}</p>
          </div>
        )}

        {/* 要点总结 */}
        {highlights.length > 0 && (
          <div style={{
            background: 'rgba(184,84,80,0.08)',
            borderRadius: 8,
            padding: '12px 16px',
            border: '1px solid rgba(184,84,80,0.2)',
            marginTop: 'auto',
          }}>
            <div style={{
              display: 'inline-block',
              background: '#b85450', color: '#fff',
              fontSize: 13, fontWeight: 700,
              padding: '2px 10px', borderRadius: 2,
              marginBottom: 8,
            }}>本章要点</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              {highlights.map((h, i) => (
                <div key={i} style={{ fontSize: 12, color: '#5a4020', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                  <span style={{ color: '#b85450', fontWeight: 700 }}>·</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部 */}
      <div style={{
        background: '#d4c4a0',
        padding: '8px 40px',
        borderTop: '2px solid #8b6914',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, color: '#8b6914',
              border: '1px solid #8b6914',
              padding: '1px 8px', borderRadius: 10,
            }}>{tag}</span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#8b6914' }}>{content.footer}</span>
      </div>
    </div>
  );
};

// ============================================================
// 2. 手账风对比卡片（参考：人生路径对照表）
// ============================================================
const HandcraftCompareCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl, canvas }) => {
  const sections = content.sections || [];
  const tags = content.tags || [];

  // 手账风配色
  const cardColors = [
    { bg: '#A8C8EC', tape: '#7BA8D4', icon: '📊' },
    { bg: '#C4D7A4', tape: '#9AC080', icon: '⚖️' },
    { bg: '#F4C2C2', tape: '#E89B9B', icon: '❤️' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f5f0e6',
      fontFamily: '"Noto Sans SC", sans-serif',
      display: 'flex', flexDirection: 'column',
      padding: '32px 28px 24px',
      position: 'relative',
      // 纸张纹理效果
      backgroundImage: `
        radial-gradient(circle at 20% 80%, rgba(232,168,124,0.06) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(168,200,236,0.06) 0%, transparent 50%),
        #f5f0e6
      `,
    }}>
      {/* 顶部胶带装饰 */}
      <div style={{
        position: 'absolute', top: 12, left: '30%', width: 120, height: 28,
        background: 'rgba(244,208,63,0.7)',
        border: '1px dashed rgba(200,170,50,0.3)',
        transform: 'rotate(-3deg)',
        borderRadius: 2,
      }} />

      {/* 主标题区 */}
      <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
        {/* 星形装饰 */}
        <div style={{ position: 'absolute', left: '15%', top: 0, fontSize: 24 }}>⭐</div>
        <div style={{ position: 'absolute', right: '15%', top: 0, fontSize: 24 }}>⭐</div>

        <h1 style={{
          fontSize: 32, fontWeight: 800, color: '#2d2d2d',
          margin: '0 0 6px',
          letterSpacing: '0.03em',
          lineHeight: 1.3,
        }}>{content.title}</h1>

        {/* 黄色高亮线 */}
        <div style={{ width: 60, height: 4, background: '#f4d03f', margin: '0 auto 8px', borderRadius: 2 }} />

        {content.subtitle && (
          <p style={{
            fontSize: 16, color: '#666',
            margin: 0,
            background: 'rgba(244,208,63,0.15)',
            display: 'inline-block',
            padding: '2px 12px',
            borderRadius: 12,
          }}>{content.subtitle}</p>
        )}
      </div>

      {/* AI插图区（如果有） */}
      {imageUrl && (
        <div style={{
          width: '100%', height: 140,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 12,
          marginBottom: 16,
          border: '3px solid #fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }} />
      )}

      {/* 三栏对比卡片 */}
      {sections.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(sections.length, 3)}, 1fr)`,
          gap: 12,
          flex: 1,
          overflow: 'hidden',
        }}>
          {sections.slice(0, 3).map((sec, i) => {
            const colors = cardColors[i % cardColors.length];
            return (
              <div key={sec.id} style={{
                background: '#fff',
                borderRadius: 10,
                padding: '16px 12px 12px',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: `2px solid ${colors.bg}`,
                display: 'flex', flexDirection: 'column',
              }}>
                {/* 顶部胶带 */}
                <div style={{
                  position: 'absolute', top: -8, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 50, height: 16,
                  background: colors.tape,
                  opacity: 0.8,
                  borderRadius: 2,
                }} />

                {/* 图标 */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: colors.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, margin: '0 auto 8px',
                }}>{sec.icon || colors.icon}</div>

                {/* 标题 */}
                <h3 style={{
                  fontSize: 15, fontWeight: 700, color: '#2d2d2d',
                  textAlign: 'center', margin: '0 0 8px',
                }}>{sec.title}</h3>

                {/* 正文（项目符号形式） */}
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, flex: 1 }}>
                  {sec.body.split('\n').map((line, j) => (
                    <div key={j} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      <span style={{ color: colors.tape }}>•</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 底部互动引导 */}
      <div style={{
        marginTop: 16,
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* 波浪线装饰 */}
        <div style={{ fontSize: 16, color: '#f4c2c2', marginBottom: 4 }}>〰️〰️〰️</div>
        <p style={{
          fontSize: 14, color: '#e89b9b', fontWeight: 500,
          textDecoration: 'underline',
          textDecorationColor: '#f4c2c2',
          margin: 0,
        }}>{content.body || '你觉得哪个更有道理呢？'}</p>
        <span style={{ fontSize: 18, marginLeft: 4 }}>→</span>
      </div>

      {/* 底部标签和日期 */}
      <div style={{
        marginTop: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 10, color: '#999',
              border: '1px dashed #ccc',
              padding: '1px 6px', borderRadius: 8,
              background: 'rgba(244,208,63,0.1)',
            }}>#{tag}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#bbb' }}>{content.footer}</span>
      </div>
    </div>
  );
};

// ============================================================
// 3. 科技信息图卡片（参考：中文视频剪辑Agent）
// ============================================================
const TechInfographicCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl, canvas }) => {
  const sections = content.sections || [];
  const highlights = content.highlights || [];
  const tags = content.tags || [];

  // 科技风配色
  const moduleColors = [
    { bg: '#2E7AD1', light: 'rgba(46,122,209,0.1)' },
    { bg: '#4A9B4F', light: 'rgba(74,155,79,0.1)' },
    { bg: '#E8913A', light: 'rgba(232,145,58,0.1)' },
    { bg: '#C94F4F', light: 'rgba(201,79,79,0.1)' },
    { bg: '#6B5B95', light: 'rgba(107,91,149,0.1)' },
  ];

  // 图标映射
  const iconMap: Record<string, string> = {
    '能做什么': '🎯', '适合谁': '👤', '怎么用': '📋', '建议': '💡', '资源': '📦',
    '能力': '⚡', '特点': '✨', '优势': '🏆', '流程': '🔄', '工具': '🔧',
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f5f5f0',
      fontFamily: '"Noto Sans SC", sans-serif',
      display: 'flex', flexDirection: 'column',
      padding: '24px 28px',
      position: 'relative',
    }}>
      {/* 顶部编号 + 标题 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        {/* 编号徽章 */}
        <div style={{
          background: '#5b4fc4',
          color: '#fff',
          fontSize: 20, fontWeight: 700,
          padding: '6px 14px',
          borderRadius: 8,
          flexShrink: 0,
        }}>{content.chapter || '01'}</div>

        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: '#1a1a2e',
            margin: '0 0 2px', lineHeight: 1.2,
          }}>{content.title}</h1>
          {content.subtitle && (
            <p style={{
              fontSize: 14, color: '#5b4fc4',
              margin: 0,
              textDecoration: 'underline',
              textDecorationColor: '#5b4fc4',
              textDecorationThickness: 2,
              textUnderlineOffset: 3,
            }}>{content.subtitle}</p>
          )}
        </div>
      </div>

      {/* AI插图区 */}
      {imageUrl && (
        <div style={{
          width: '100%', height: 120,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 10,
          marginBottom: 14,
        }} />
      )}

      {/* 功能模块卡片 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {sections.map((sec, i) => {
          const colors = moduleColors[i % moduleColors.length];
          const icon = sec.icon || iconMap[sec.title] || '📌';
          return (
            <div key={sec.id} style={{
              background: '#fff',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex', gap: 12, alignItems: 'flex-start',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: `1px solid ${colors.light}`,
            }}>
              {/* 图标 */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: colors.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0, color: '#fff',
              }}>{icon}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                  fontSize: 14, fontWeight: 700, color: colors.bg,
                  margin: '0 0 3px',
                }}>{sec.title}</h4>
                <p style={{
                  fontSize: 12, color: '#555', lineHeight: 1.5, margin: 0,
                }}>{sec.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 流程图 / 要点 */}
      {highlights.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(91,79,196,0.06)',
          borderRadius: 8,
          padding: '10px 14px',
          marginTop: 10,
          gap: 8,
        }}>
          {highlights.slice(0, 4).map((h, i) => (
            <React.Fragment key={i}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#5b4fc4', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, margin: '0 auto 4px',
                }}>{i + 1}</div>
                <p style={{ fontSize: 10, color: '#555', margin: 0, lineHeight: 1.3 }}>{h}</p>
              </div>
              {i < Math.min(highlights.length, 4) - 1 && (
                <span style={{ color: '#5b4fc4', fontSize: 16, fontWeight: 700 }}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* 底部深色标语栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e, #2d2d4a)',
        borderRadius: 8,
        padding: '10px 16px',
        marginTop: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#f4d03f', fontSize: 14 }}>⭐</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {content.body || '让知识更有力量'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 10, color: 'rgba(255,255,255,0.6)',
              background: 'rgba(255,255,255,0.1)',
              padding: '1px 6px', borderRadius: 4,
            }}>#{tag}</span>
          ))}
        </div>
      </div>

      {/* 底部日期 */}
      <div style={{ textAlign: 'right', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#bbb' }}>{content.footer}</span>
      </div>
    </div>
  );
};

// ============================================================
// 4. 自然科普卡片（参考：白鹭的一生）
// ============================================================
const NatureScienceCard: React.FC<{ content: CardContent; imageUrl?: string; canvas: any }> = ({ content, imageUrl, canvas }) => {
  const sections = content.sections || [];
  const highlights = content.highlights || [];
  const tags = content.tags || [];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f5f0e0',
      fontFamily: '"Noto Serif SC", serif',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      // 纸张纹理
      backgroundImage: `
        radial-gradient(circle at 10% 90%, rgba(139,105,20,0.04) 0%, transparent 40%),
        radial-gradient(circle at 90% 10%, rgba(139,105,20,0.04) 0%, transparent 40%),
        #f5f0e0
      `,
    }}>
      {/* 四角装饰 */}
      {[
        { top: 8, left: 8, borderTop: '2px solid #8b6914', borderLeft: '2px solid #8b6914' },
        { top: 8, right: 8, borderTop: '2px solid #8b6914', borderRight: '2px solid #8b6914' },
        { bottom: 8, left: 8, borderBottom: '2px solid #8b6914', borderLeft: '2px solid #8b6914' },
        { bottom: 8, right: 8, borderBottom: '2px solid #8b6914', borderRight: '2px solid #8b6914' },
      ].map((style, i) => (
        <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...style }} />
      ))}

      {/* 标题区 */}
      <div style={{
        padding: '32px 40px 16px',
        textAlign: 'center',
        flexShrink: 0,
      }}>
        {/* 系列标题 */}
        {content.tags[0] && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 8,
          }}>
            <span style={{ color: '#8b6914', fontSize: 12 }}>◆</span>
            <span style={{ fontSize: 13, color: '#8b6914', letterSpacing: '0.15em' }}>{tags[0]}系列</span>
            <span style={{ color: '#8b6914', fontSize: 12 }}>◆</span>
          </div>
        )}

        {/* 大编号 + 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <span style={{
            fontSize: 56, fontWeight: 200, color: '#8b6914',
            fontFamily: '"Noto Sans SC", sans-serif',
            lineHeight: 1,
          }}>{content.chapter || '01'}</span>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{
              fontSize: 32, fontWeight: 700, color: '#2d1a0a',
              margin: 0, letterSpacing: '0.05em',
              lineHeight: 1.2,
            }}>{content.title}</h1>
            {content.subtitle && (
              <p style={{
                fontSize: 14, color: '#8b6914',
                margin: '4px 0 0',
              }}>{content.subtitle}</p>
            )}
          </div>
        </div>

        {/* 装饰线 */}
        <div style={{
          width: 80, height: 1, background: '#8b6914',
          margin: '12px auto 0', opacity: 0.4,
        }} />
      </div>

      {/* AI插图区 */}
      {imageUrl && (
        <div style={{
          margin: '0 40px',
          height: 220,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 4,
          position: 'relative',
          flexShrink: 0,
          border: '1px solid rgba(139,105,20,0.15)',
        }}>
          {/* 印章 */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            width: 48, height: 48,
            background: 'rgba(184,84,80,0.9)',
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700,
            transform: 'rotate(-8deg)',
            border: '2px solid rgba(160,68,64,0.8)',
          }}>自然<br />之美</div>
        </div>
      )}

      {/* 信息卡片网格 */}
      <div style={{
        flex: 1,
        padding: '16px 40px',
        display: 'flex', flexDirection: 'column', gap: 10,
        overflow: 'hidden',
      }}>
        {sections.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: sections.length >= 3 ? '1fr 1fr 1fr' : `repeat(${sections.length}, 1fr)`,
            gap: 10,
            flex: 1,
          }}>
            {sections.slice(0, 4).map((sec, i) => (
              <div key={sec.id} style={{
                background: 'rgba(255,255,255,0.6)',
                borderRadius: 6,
                padding: '10px 12px',
                border: '1px solid rgba(139,105,20,0.12)',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* 标签 */}
                <div style={{
                  display: 'inline-block',
                  background: 'rgba(139,105,20,0.12)',
                  color: '#5a4020',
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 10,
                  marginBottom: 6, alignSelf: 'flex-start',
                }}>{sec.title}</div>

                <p style={{
                  fontSize: 12, color: '#5a4020', lineHeight: 1.6, margin: 0,
                  flex: 1,
                }}>{sec.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* 底部诗意总结 */}
        {highlights.length > 0 && (
          <div style={{
            textAlign: 'center',
            padding: '10px 20px',
            marginTop: 'auto',
          }}>
            {/* 水波纹装饰 */}
            <div style={{ fontSize: 14, color: 'rgba(139,105,20,0.3)', marginBottom: 6 }}>〜〜〜</div>
            <p style={{
              fontSize: 14, color: '#5a4020', lineHeight: 1.6,
              fontStyle: 'italic',
              margin: 0,
            }}>{highlights[0]}</p>
          </div>
        )}
      </div>

      {/* 底部 */}
      <div style={{
        padding: '8px 40px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, color: '#8b6914',
              border: '1px solid rgba(139,105,20,0.3)',
              padding: '1px 8px', borderRadius: 10,
            }}>{tag}</span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#8b6914', opacity: 0.7 }}>{content.footer}</span>
      </div>
    </div>
  );
};
