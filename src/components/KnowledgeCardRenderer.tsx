import React from 'react';
import type { CardContent, CardTemplate, KnowledgeModule, ProcessStep, CompareItem, ModuleType } from '../types';

interface KnowledgeCardRendererProps {
  template: CardTemplate;
  content: CardContent;
  imageUrl?: string;
  scale?: number;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

/** 模块颜色配置 */
const MODULE_COLORS: Record<ModuleType, { bg: string; text: string; light: string }> = {
  concept:  { bg: '#2563EB', text: '#1E40AF', light: 'rgba(37,99,235,0.08)' },
  points:   { bg: '#059669', text: '#047857', light: 'rgba(5,150,105,0.08)' },
  example:  { bg: '#D97706', text: '#B45309', light: 'rgba(217,119,6,0.08)' },
  suitable: { bg: '#059669', text: '#047857', light: 'rgba(5,150,105,0.08)' },
  process:  { bg: '#D97706', text: '#B45309', light: 'rgba(217,119,6,0.08)' },
  note:     { bg: '#DC2626', text: '#B91C1C', light: 'rgba(220,38,38,0.08)' },
  tip:      { bg: '#7C3AED', text: '#6D28D9', light: 'rgba(124,58,237,0.08)' },
  resource: { bg: '#6B5B95', text: '#553C8B', light: 'rgba(107,91,149,0.08)' },
  compare:  { bg: '#2563EB', text: '#1E40AF', light: 'rgba(37,99,235,0.08)' },
  fact:     { bg: '#4B5563', text: '#374151', light: 'rgba(75,85,99,0.08)' },
};

/** 默认图标 */
const MODULE_ICONS: Record<ModuleType, string> = {
  concept: '💡',
  points: '🎯',
  example: '📋',
  suitable: '👤',
  process: '🔄',
  note: '⚠️',
  tip: '💡',
  resource: '📦',
  compare: '⚖️',
  fact: '📊',
};

/**
 * 知识卡片渲染器
 * 根据模板类型渲染不同风格的结构化知识卡片
 */
export const KnowledgeCardRenderer: React.FC<KnowledgeCardRendererProps> = (props) => {
  const { template, content, imageUrl, scale = 1, innerRef } = props;
  const { canvas } = template;

  const renderContent = () => {
    switch (template.htmlTemplateId) {
      case 'quick-knowledge':
        return <QuickKnowledgeCard content={content} imageUrl={imageUrl} />;
      case 'encyclopedia':
        return <EncyclopediaCard content={content} imageUrl={imageUrl} />;
      case 'compare-card':
        return <CompareCard content={content} imageUrl={imageUrl} />;
      default:
        return <QuickKnowledgeCard content={content} imageUrl={imageUrl} />;
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
// 1. 知识速记卡 - 参考 AI 工具卡片风格
// ============================================================
const QuickKnowledgeCard: React.FC<{ content: CardContent; imageUrl?: string }> = ({ content, imageUrl }) => {
  const modules = content.modules || [];
  const processSteps = content.processSteps || [];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#F5F5F0',
      fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
      display: 'flex', flexDirection: 'column',
      padding: '20px 24px 16px',
      position: 'relative',
    }}>
      {/* 顶部系列标识 + 页码 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {content.seriesName || '知识速记'}
        </span>
        <span style={{ fontSize: 13, color: '#5B4FC4', fontWeight: 700 }}>
          {content.episode || '01'}/{content.totalEpisodes || '09'}
        </span>
      </div>

      {/* 标题区：编号 + 中文标题 + 英文副标题 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{
          background: '#5B4FC4', color: '#fff',
          fontSize: 22, fontWeight: 700,
          padding: '6px 14px', borderRadius: 8,
          flexShrink: 0, lineHeight: 1.2,
        }}>
          {content.topicNumber || '01'}
        </div>
        <div style={{ flex: 1, paddingTop: 2 }}>
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: '#1a1a2e',
            margin: '0 0 2px', lineHeight: 1.2,
          }}>{content.title}</h1>
          {content.englishSubtitle && (
            <p style={{
              fontSize: 13, color: '#5B4FC4',
              margin: 0, fontStyle: 'italic',
              textDecoration: 'underline', textDecorationColor: '#5B4FC4',
              textDecorationThickness: 2, textUnderlineOffset: 3,
            }}>{content.englishSubtitle}</p>
          )}
        </div>
      </div>

      {/* AI配图（如果有） */}
      {imageUrl && (
        <div style={{
          width: '100%', height: 100,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          borderRadius: 10, marginBottom: 12,
        }} />
      )}

      {/* 概念定义（如果有） */}
      {content.definition && (
        <div style={{
          background: 'rgba(91,79,196,0.06)',
          borderLeft: '3px solid #5B4FC4',
          borderRadius: '0 8px 8px 0',
          padding: '8px 12px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6, margin: 0 }}>
            {content.definition}
          </p>
        </div>
      )}

      {/* 知识模块列表 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {modules.map((mod) => {
          const colors = MODULE_COLORS[mod.type] || MODULE_COLORS.concept;
          const icon = mod.icon || MODULE_ICONS[mod.type] || '📌';
          return (
            <div key={mod.id} style={{
              background: '#fff', borderRadius: 10,
              padding: '10px 14px',
              display: 'flex', gap: 10, alignItems: 'flex-start',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: `1px solid ${colors.light}`,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: colors.bg, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                  fontSize: 13, fontWeight: 700, color: colors.text,
                  margin: '0 0 3px',
                }}>{mod.title}</h4>
                {mod.bullets && mod.bullets.length > 0 ? (
                  <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                    {mod.bullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                        <span style={{ color: colors.bg, fontWeight: 700 }}>•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.5, margin: 0 }}>
                    {mod.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 流程图 */}
      {processSteps.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(91,79,196,0.04)', borderRadius: 8,
          padding: '8px 12px', marginTop: 8, gap: 4,
        }}>
          {processSteps.map((step, i) => (
            <React.Fragment key={step.id}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: MODULE_COLORS[getStepModuleType(i)].bg || '#5B4FC4',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, margin: '0 auto 3px',
                }}>{step.icon || (i + 1)}</div>
                <p style={{ fontSize: 10, color: '#555', margin: 0, lineHeight: 1.2 }}>{step.label}</p>
              </div>
              {i < processSteps.length - 1 && (
                <span style={{ color: '#5B4FC4', fontSize: 14, fontWeight: 700 }}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* 手写批注 */}
      {content.handwrittenNote && (
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <span style={{ color: '#DC2626', fontSize: 14, flexShrink: 0 }}>✎</span>
          <p style={{
            fontSize: 12, color: '#DC2626', lineHeight: 1.5, margin: 0,
            fontFamily: '"Ma Shan Zheng", "Noto Serif SC", cursive',
          }}>{content.handwrittenNote}</p>
        </div>
      )}

      {/* 底部金句栏 */}
      {content.quote && (
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e, #2d2d4a)',
          borderRadius: 8, padding: '10px 14px', marginTop: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: '#F5D547', fontSize: 14, flexShrink: 0 }}>⭐</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
            {content.quote}
          </span>
        </div>
      )}

      {/* 底部标签 + 日期 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 6,
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {content.tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 10, color: '#999',
              background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: 4,
            }}>#{tag}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#bbb' }}>{content.footer}</span>
      </div>
    </div>
  );
};

/** 获取流程步骤对应的模块类型颜色 */
function getStepModuleType(index: number): ModuleType {
  const types: ModuleType[] = ['concept', 'points', 'process', 'note'];
  return types[index % types.length];
}

// ============================================================
// 2. 百科词条卡 - 结构化信息卡片
// ============================================================
const EncyclopediaCard: React.FC<{ content: CardContent; imageUrl?: string }> = ({ content, imageUrl }) => {
  const modules = content.modules || [];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#FAFAFA',
      fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* 顶部标题栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        padding: '16px 24px 14px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>{content.seriesName || '百科词条'}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {content.episode || '01'}/{content.totalEpisodes || '09'}
          </span>
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: '#fff',
          margin: 0, lineHeight: 1.2,
        }}>{content.title}</h1>
        {content.subtitle && (
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.6)',
            margin: '4px 0 0',
          }}>{content.subtitle}</p>
        )}
      </div>

      {/* 主体内容区：左侧详解 + 右侧信息框 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧主体 */}
        <div style={{ flex: 1, padding: '14px 16px', overflow: 'hidden' }}>
          {/* 概念定义 */}
          {content.definition && (
            <div style={{
              background: '#fff', borderRadius: 8,
              padding: '10px 14px', marginBottom: 10,
              border: '1px solid #E5E7EB',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#2563EB',
                marginBottom: 4, letterSpacing: '0.05em',
              }}>◆ 概念定义</div>
              <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6, margin: 0 }}>
                {content.definition}
              </p>
            </div>
          )}

          {/* 知识模块 */}
          {modules.map((mod) => {
            const colors = MODULE_COLORS[mod.type] || MODULE_COLORS.concept;
            const icon = mod.icon || MODULE_ICONS[mod.type] || '📌';
            return (
              <div key={mod.id} style={{
                background: '#fff', borderRadius: 8,
                padding: '10px 14px', marginBottom: 8,
                border: '1px solid #E5E7EB',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 4,
                    background: colors.bg, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, flexShrink: 0,
                  }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colors.text }}>{mod.title}</span>
                </div>
                {mod.bullets && mod.bullets.length > 0 ? (
                  <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, paddingLeft: 4 }}>
                    {mod.bullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                        <span style={{ color: colors.bg }}>•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.5, margin: 0, paddingLeft: 4 }}>
                    {mod.content}
                  </p>
                )}
              </div>
            );
          })}

          {/* 手写批注 */}
          {content.handwrittenNote && (
            <div style={{
              background: 'rgba(220,38,38,0.04)', borderRadius: 6,
              padding: '6px 10px', marginBottom: 8,
              display: 'flex', gap: 6,
            }}>
              <span style={{ color: '#DC2626', fontSize: 12 }}>✎</span>
              <p style={{
                fontSize: 11, color: '#DC2626', lineHeight: 1.5, margin: 0,
                fontFamily: '"Ma Shan Zheng", cursive',
              }}>{content.handwrittenNote}</p>
            </div>
          )}
        </div>

        {/* 右侧信息框 */}
        <div style={{
          width: 220, flexShrink: 0,
          background: '#fff', borderLeft: '1px solid #E5E7EB',
          padding: '14px 12px', overflow: 'hidden',
        }}>
          {/* 配图 */}
          {imageUrl && (
            <div style={{
              width: '100%', height: 100,
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              borderRadius: 6, marginBottom: 10,
            }} />
          )}

          {/* 关键事实 */}
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#999',
            marginBottom: 6, letterSpacing: '0.1em',
          }}>关键信息</div>
          {content.tags.map((tag, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '4px 0', borderBottom: '1px solid #F3F4F6',
              fontSize: 11,
            }}>
              <span style={{ color: '#999' }}>{tag}</span>
              <span style={{ color: '#333', fontWeight: 500 }}>✓</span>
            </div>
          ))}

          {/* 要点速览 */}
          {content.highlights && content.highlights.length > 0 && (
            <>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#999',
                margin: '10px 0 6px', letterSpacing: '0.1em',
              }}>要点速览</div>
              {content.highlights.map((h, i) => (
                <div key={i} style={{
                  fontSize: 11, color: '#555', lineHeight: 1.4,
                  marginBottom: 4, display: 'flex', gap: 4,
                }}>
                  <span style={{ color: '#2563EB', fontWeight: 700 }}>{i + 1}.</span>
                  <span>{h}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 底部金句栏 */}
      {content.quote && (
        <div style={{
          background: '#1a1a2e',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ color: '#F5D547', fontSize: 14 }}>⭐</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
            {content.quote}
          </span>
        </div>
      )}

      {/* 底部信息 */}
      <div style={{
        padding: '6px 24px',
        background: '#F3F4F6',
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: '#999',
        flexShrink: 0,
      }}>
        <span>{content.tags.map(t => `#${t}`).join(' ')}</span>
        <span>{content.footer}</span>
      </div>
    </div>
  );
};

// ============================================================
// 3. 对比分析卡 - 手账对比风格
// ============================================================
const CompareCard: React.FC<{ content: CardContent; imageUrl?: string }> = ({ content, imageUrl }) => {
  const items = content.compareItems || [];
  const compareColors = [
    { bg: '#A8D0E6', tape: '#7BA8D4', text: '#2E5C8A' },
    { bg: '#C5E1A5', tape: '#9AC080', text: '#4A7C3A' },
    { bg: '#F8BBD0', tape: '#E89B9B', text: '#A04060' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f5f0e6',
      fontFamily: '"Noto Sans SC", sans-serif',
      display: 'flex', flexDirection: 'column',
      padding: '28px 24px 20px',
      position: 'relative',
      backgroundImage: `
        radial-gradient(circle at 20% 80%, rgba(232,168,124,0.06) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(168,200,236,0.06) 0%, transparent 50%),
        #f5f0e6
      `,
    }}>
      {/* 顶部胶带装饰 */}
      <div style={{
        position: 'absolute', top: 10, left: '30%', width: 100, height: 24,
        background: 'rgba(244,208,63,0.7)',
        border: '1px dashed rgba(200,170,50,0.3)',
        transform: 'rotate(-3deg)', borderRadius: 2,
      }} />

      {/* 标题区 */}
      <div style={{ textAlign: 'center', marginBottom: 16, position: 'relative' }}>
        <div style={{ position: 'absolute', left: '15%', top: 0, fontSize: 20 }}>⭐</div>
        <div style={{ position: 'absolute', right: '15%', top: 0, fontSize: 20 }}>⭐</div>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: '#2d2d2d',
          margin: '0 0 4px', lineHeight: 1.3,
        }}>{content.title}</h1>
        <div style={{ width: 50, height: 3, background: '#f4d03f', margin: '0 auto 6px', borderRadius: 2 }} />
        {content.subtitle && (
          <p style={{
            fontSize: 14, color: '#666', margin: 0,
            background: 'rgba(244,208,63,0.15)',
            display: 'inline-block', padding: '2px 10px', borderRadius: 10,
          }}>{content.subtitle}</p>
        )}
      </div>

      {/* 概念定义 */}
      {content.definition && (
        <div style={{
          background: 'rgba(255,255,255,0.6)', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12,
          border: '1px dashed #ccc',
        }}>
          <p style={{ fontSize: 12, color: '#555', lineHeight: 1.5, margin: 0 }}>
            {content.definition}
          </p>
        </div>
      )}

      {/* AI配图 */}
      {imageUrl && (
        <div style={{
          width: '100%', height: 90,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          borderRadius: 10, marginBottom: 12,
          border: '3px solid #fff',
          boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
        }} />
      )}

      {/* 对比卡片 */}
      {items.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`,
          gap: 10, flex: 1, overflow: 'hidden',
        }}>
          {items.slice(0, 3).map((item, i) => {
            const colors = compareColors[i % compareColors.length];
            return (
              <div key={item.id} style={{
                background: '#fff', borderRadius: 10,
                padding: '14px 10px 10px',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: `2px solid ${colors.bg}`,
                display: 'flex', flexDirection: 'column',
              }}>
                {/* 顶部胶带 */}
                <div style={{
                  position: 'absolute', top: -7, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 44, height: 14,
                  background: colors.tape, opacity: 0.8, borderRadius: 2,
                }} />

                {/* Badge */}
                {item.badge && (
                  <div style={{
                    display: 'inline-block', alignSelf: 'flex-start',
                    background: colors.bg, color: colors.text,
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 4,
                    marginBottom: 6,
                  }}>{item.badge}</div>
                )}

                {/* 标题 */}
                <h3 style={{
                  fontSize: 14, fontWeight: 700, color: '#2d2d2d',
                  textAlign: 'center', margin: '0 0 6px',
                }}>{item.label}</h3>

                {/* 特征列表 */}
                <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5, flex: 1 }}>
                  {item.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                      <span style={{ color: colors.tape }}>•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* 适合人群 */}
                {item.suitableFor && (
                  <div style={{
                    marginTop: 4, padding: '4px 6px',
                    background: colors.bg, borderRadius: 4,
                    fontSize: 10, color: colors.text, fontWeight: 500,
                    textAlign: 'center',
                  }}>
                    👤 {item.suitableFor}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 如果没有对比项，使用知识模块 */}
      {items.length === 0 && content.modules && content.modules.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(content.modules.length, 3)}, 1fr)`,
          gap: 10, flex: 1, overflow: 'hidden',
        }}>
          {content.modules.slice(0, 3).map((mod, i) => {
            const colors = compareColors[i % compareColors.length];
            return (
              <div key={mod.id} style={{
                background: '#fff', borderRadius: 10,
                padding: '14px 10px 10px',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: `2px solid ${colors.bg}`,
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  position: 'absolute', top: -7, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 44, height: 14,
                  background: colors.tape, opacity: 0.8, borderRadius: 2,
                }} />
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: colors.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, margin: '0 auto 6px',
                }}>{mod.icon || MODULE_ICONS[mod.type]}</div>
                <h3 style={{
                  fontSize: 13, fontWeight: 700, color: '#2d2d2d',
                  textAlign: 'center', margin: '0 0 6px',
                }}>{mod.title}</h3>
                <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5, flex: 1 }}>
                  {mod.content}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 手写批注 */}
      {content.handwrittenNote && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#f4c2c2', marginBottom: 2 }}>〰️〰️〰️</div>
          <p style={{
            fontSize: 13, color: '#e89b9b', fontWeight: 500,
            textDecoration: 'underline', textDecorationColor: '#f4c2c2',
            margin: 0,
            fontFamily: '"Ma Shan Zheng", cursive',
          }}>{content.handwrittenNote}</p>
        </div>
      )}

      {/* 底部标签 */}
      <div style={{
        marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {content.tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 10, color: '#999',
              border: '1px dashed #ccc', padding: '1px 6px', borderRadius: 8,
              background: 'rgba(244,208,63,0.1)',
            }}>#{tag}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#bbb' }}>{content.footer}</span>
      </div>
    </div>
  );
};
