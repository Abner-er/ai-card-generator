import React from 'react';
import type { CardContent, CardTemplate, ModuleType, StylePreset } from '../types';
import { getCardTheme } from '../services/styleEngine';
import type { CardTheme } from '../services/styleEngine';

// ============================================================
// 工具函数
// ============================================================

/** hex 转 rgba */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 根据主题 palette 派生模块颜色 */
function getModuleColors(theme: CardTheme, type: ModuleType): { bg: string; text: string; light: string } {
  const palette = theme.palette;
  const typeToIndex: Record<ModuleType, number> = {
    concept: 0,
    points: 1,
    example: 2,
    suitable: 1,
    process: 2,
    note: 3,
    tip: 4,
    resource: 0,
    compare: 1,
    fact: 3,
  };
  const idx = typeToIndex[type] ?? 0;
  const color = palette[idx % palette.length];
  return {
    bg: color,
    text: color,
    light: hexToRgba(color, 0.08),
  };
}

/** 根据主题 palette 派生对比卡片颜色 */
function getCompareColors(theme: CardTheme): Array<{ bg: string; tape: string; text: string }> {
  return theme.palette.slice(0, 3).map((color) => ({
    bg: hexToRgba(color, 0.22),
    tape: hexToRgba(color, 0.7),
    text: color,
  }));
}

/** 获取流程步骤对应的模块类型索引 */
function getStepModuleType(index: number): ModuleType {
  const types: ModuleType[] = ['concept', 'points', 'process', 'note'];
  return types[index % types.length];
}

// ============================================================
// 模块图标（语义图标，跨风格通用）
// ============================================================
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

// ============================================================
// 主组件
// ============================================================
interface KnowledgeCardRendererProps {
  template: CardTemplate;
  content: CardContent;
  imageUrl?: string;
  scale?: number;
  innerRef?: React.RefObject<HTMLDivElement | null>;
  stylePreset?: StylePreset;
  cardIndex?: number;
}

/**
 * 知识卡片渲染器
 * 根据模板类型 + 风格预设渲染不同风格的结构化知识卡片
 * 所有配色、字体、圆角等视觉属性由 styleEngine 动态生成
 */
export const KnowledgeCardRenderer: React.FC<KnowledgeCardRendererProps> = (props) => {
  const { template, content, imageUrl, scale = 1, innerRef, stylePreset, cardIndex = 0 } = props;
  const { canvas } = template;
  const theme = getCardTheme(stylePreset, cardIndex);

  const renderContent = () => {
    switch (template.htmlTemplateId) {
      case 'quick-knowledge':
        return <QuickKnowledgeCard content={content} imageUrl={imageUrl} theme={theme} />;
      case 'encyclopedia':
        return <EncyclopediaCard content={content} imageUrl={imageUrl} theme={theme} />;
      case 'compare-card':
        return <CompareCard content={content} imageUrl={imageUrl} theme={theme} />;
      case 'lifecycle':
      case 'timeline':
      case 'process':
        return <SeriesCard content={content} imageUrl={imageUrl} templateId={template.htmlTemplateId || template.id} theme={theme} cardIndex={cardIndex} />;
      default:
        return <QuickKnowledgeCard content={content} imageUrl={imageUrl} theme={theme} />;
    }
  };

  return (
    <div
      ref={innerRef}
      style={{
        width: canvas.width,
        height: canvas.height,
        backgroundColor: theme.bgPrimary,
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
// 1. 知识速记卡 — 通用结构化知识卡片
// ============================================================
const QuickKnowledgeCard: React.FC<{ content: CardContent; imageUrl?: string; theme: CardTheme }> = ({ content, imageUrl, theme }) => {
  const modules = content.modules || [];
  const processSteps = content.processSteps || [];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: theme.bgPrimary,
      fontFamily: theme.fontFamily,
      display: 'flex', flexDirection: 'column',
      padding: '20px 24px 16px',
      position: 'relative',
    }}>
      {/* 顶部系列标识 + 页码 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: theme.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {content.seriesName || '知识速记'}
        </span>
        <span style={{ fontSize: 13, color: theme.accent, fontWeight: 700 }}>
          {content.episode || '01'}/{content.totalEpisodes || '09'}
        </span>
      </div>

      {/* 标题区：编号 + 中文标题 + 英文副标题 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{
          background: theme.titleBg, color: '#fff',
          fontSize: 22, fontWeight: theme.titleWeight,
          padding: '6px 14px', borderRadius: theme.borderRadius,
          flexShrink: 0, lineHeight: 1.2,
        }}>
          {content.topicNumber || '01'}
        </div>
        <div style={{ flex: 1, paddingTop: 2 }}>
          <h1 style={{
            fontSize: 24, fontWeight: theme.titleWeight, color: theme.textPrimary,
            margin: '0 0 2px', lineHeight: 1.2,
          }}>{content.title}</h1>
          {content.englishSubtitle && (
            <p style={{
              fontSize: 13, color: theme.accent,
              margin: 0, fontStyle: 'italic',
              textDecoration: 'underline', textDecorationColor: theme.accent,
              textDecorationThickness: 2, textUnderlineOffset: 3,
            }}>{content.englishSubtitle}</p>
          )}
        </div>
      </div>

      {/* AI配图（如果有） */}
      {imageUrl && (
        <img
          src={imageUrl}
          crossOrigin="anonymous"
          alt=""
          style={{
            width: '100%', height: 100,
            objectFit: 'cover', objectPosition: 'center',
            borderRadius: theme.borderRadius, marginBottom: 12,
          }}
        />
      )}

      {/* 正文描述（如果有） */}
      {content.body && (
        <div style={{
          background: theme.accentLight,
          borderLeft: `3px solid ${theme.accent}`,
          borderRadius: `0 ${theme.borderRadius}px ${theme.borderRadius}px 0`,
          padding: '8px 12px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 1.6, margin: 0 }}>
            {content.body}
          </p>
        </div>
      )}

      {/* 概念定义（如果有） */}
      {content.definition && (
        <div style={{
          background: theme.accentLight,
          borderLeft: `3px solid ${theme.accent}`,
          borderRadius: `0 ${theme.borderRadius}px ${theme.borderRadius}px 0`,
          padding: '8px 12px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 1.6, margin: 0 }}>
            {content.definition}
          </p>
        </div>
      )}

      {/* 知识模块列表 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {modules.map((mod) => {
          const colors = getModuleColors(theme, mod.type);
          const icon = mod.icon || MODULE_ICONS[mod.type] || '📌';
          return (
            <div key={mod.id} style={{
              background: theme.bgSecondary, borderRadius: theme.borderRadius,
              padding: '10px 14px',
              display: 'flex', gap: 10, alignItems: 'flex-start',
              boxShadow: `0 1px 3px ${theme.shadowColor}`,
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
                  <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                    {mod.bullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                        <span style={{ color: colors.bg, fontWeight: 700 }}>•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5, margin: 0 }}>
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
          background: theme.accentLight, borderRadius: theme.borderRadius,
          padding: '8px 12px', marginTop: 8, gap: 4,
        }}>
          {processSteps.map((step, i) => (
            <React.Fragment key={step.id}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: getModuleColors(theme, getStepModuleType(i)).bg,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, margin: '0 auto 3px',
                }}>{step.icon || (i + 1)}</div>
                <p style={{ fontSize: 10, color: theme.textSecondary, margin: 0, lineHeight: 1.2 }}>{step.label}</p>
              </div>
              {i < processSteps.length - 1 && (
                <span style={{ color: theme.accent, fontSize: 14, fontWeight: 700 }}>→</span>
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
          background: theme.quoteBg,
          borderRadius: theme.borderRadius, padding: '10px 14px', marginTop: 8,
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
              fontSize: 10, color: theme.textSecondary,
              background: hexToRgba(theme.textPrimary, 0.04), padding: '1px 6px', borderRadius: 4,
            }}>#{tag}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, color: theme.textSecondary }}>{content.footer}</span>
      </div>
    </div>
  );
};

// ============================================================
// 2. 百科词条卡 — 结构化信息卡片
// ============================================================
const EncyclopediaCard: React.FC<{ content: CardContent; imageUrl?: string; theme: CardTheme }> = ({ content, imageUrl, theme }) => {
  const modules = content.modules || [];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: theme.bgPrimary,
      fontFamily: theme.fontFamily,
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* 顶部标题栏 */}
      <div style={{
        background: theme.quoteBg,
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
          fontSize: 28, fontWeight: theme.titleWeight, color: '#fff',
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
          {/* 正文描述 */}
          {content.body && (
            <div style={{
              background: theme.accentLight,
              borderRadius: theme.borderRadius,
              padding: '10px 14px', marginBottom: 10,
              border: theme.cardBorder,
            }}>
              <p style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 1.6, margin: 0 }}>
                {content.body}
              </p>
            </div>
          )}

          {/* 概念定义 */}
          {content.definition && (
            <div style={{
              background: theme.bgSecondary, borderRadius: theme.borderRadius,
              padding: '10px 14px', marginBottom: 10,
              border: theme.cardBorder,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: theme.accent,
                marginBottom: 4, letterSpacing: '0.05em',
              }}>◆ 概念定义</div>
              <p style={{ fontSize: 13, color: theme.textPrimary, lineHeight: 1.6, margin: 0 }}>
                {content.definition}
              </p>
            </div>
          )}

          {/* 知识模块 */}
          {modules.map((mod) => {
            const colors = getModuleColors(theme, mod.type);
            const icon = mod.icon || MODULE_ICONS[mod.type] || '📌';
            return (
              <div key={mod.id} style={{
                background: theme.bgSecondary, borderRadius: theme.borderRadius,
                padding: '10px 14px', marginBottom: 8,
                border: theme.cardBorder,
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
                  <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5, paddingLeft: 4 }}>
                    {mod.bullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                        <span style={{ color: colors.bg }}>•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5, margin: 0, paddingLeft: 4 }}>
                    {mod.content}
                  </p>
                )}
              </div>
            );
          })}

          {/* 手写批注 */}
          {content.handwrittenNote && (
            <div style={{
              background: hexToRgba('#DC2626', 0.04), borderRadius: 6,
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
          background: theme.bgSecondary, borderLeft: theme.cardBorder,
          padding: '14px 12px', overflow: 'hidden',
        }}>
          {/* 配图 */}
          {imageUrl && (
            <img
              src={imageUrl}
              crossOrigin="anonymous"
              alt=""
              style={{
                width: '100%', height: 100,
                objectFit: 'cover', objectPosition: 'center',
                borderRadius: 6, marginBottom: 10,
              }}
            />
          )}

          {/* 关键事实 */}
          <div style={{
            fontSize: 10, fontWeight: 700, color: theme.textSecondary,
            marginBottom: 6, letterSpacing: '0.1em',
          }}>关键信息</div>
          {content.tags.map((tag, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '4px 0', borderBottom: `1px solid ${hexToRgba(theme.textPrimary, 0.06)}`,
              fontSize: 11,
            }}>
              <span style={{ color: theme.textSecondary }}>{tag}</span>
              <span style={{ color: theme.textPrimary, fontWeight: 500 }}>✓</span>
            </div>
          ))}

          {/* 要点速览 */}
          {content.highlights && content.highlights.length > 0 && (
            <>
              <div style={{
                fontSize: 10, fontWeight: 700, color: theme.textSecondary,
                margin: '10px 0 6px', letterSpacing: '0.1em',
              }}>要点速览</div>
              {content.highlights.map((h, i) => (
                <div key={i} style={{
                  fontSize: 11, color: theme.textSecondary, lineHeight: 1.4,
                  marginBottom: 4, display: 'flex', gap: 4,
                }}>
                  <span style={{ color: theme.accent, fontWeight: 700 }}>{i + 1}.</span>
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
          background: theme.quoteBg,
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
        background: theme.accentLight,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: theme.textSecondary,
        flexShrink: 0,
      }}>
        <span>{content.tags.map(t => `#${t}`).join(' ')}</span>
        <span>{content.footer}</span>
      </div>
    </div>
  );
};

// ============================================================
// 3. 对比分析卡 — 手账对比风格
// ============================================================
const CompareCard: React.FC<{ content: CardContent; imageUrl?: string; theme: CardTheme }> = ({ content, imageUrl, theme }) => {
  const items = content.compareItems || [];
  const compareColors = getCompareColors(theme);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: theme.bgPrimary,
      fontFamily: theme.fontFamily,
      display: 'flex', flexDirection: 'column',
      padding: '28px 24px 20px',
      position: 'relative',
      backgroundImage: `
        radial-gradient(circle at 20% 80%, ${hexToRgba(theme.accent, 0.06)} 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, ${hexToRgba(theme.accentSecondary, 0.06)} 0%, transparent 50%),
        ${theme.bgPrimary}
      `,
    }}>
      {/* 顶部胶带装饰 */}
      <div style={{
        position: 'absolute', top: 10, left: '30%', width: 100, height: 24,
        background: hexToRgba(theme.accent, 0.5),
        border: `1px dashed ${hexToRgba(theme.accent, 0.3)}`,
        transform: 'rotate(-3deg)', borderRadius: 2,
      }} />

      {/* 标题区 */}
      <div style={{ textAlign: 'center', marginBottom: 16, position: 'relative' }}>
        <div style={{ position: 'absolute', left: '15%', top: 0, fontSize: 20 }}>⭐</div>
        <div style={{ position: 'absolute', right: '15%', top: 0, fontSize: 20 }}>⭐</div>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: theme.textPrimary,
          margin: '0 0 4px', lineHeight: 1.3,
        }}>{content.title}</h1>
        <div style={{ width: 50, height: 3, background: theme.accent, margin: '0 auto 6px', borderRadius: 2 }} />
        {content.subtitle && (
          <p style={{
            fontSize: 14, color: theme.textSecondary, margin: 0,
            background: hexToRgba(theme.accent, 0.12),
            display: 'inline-block', padding: '2px 10px', borderRadius: 10,
          }}>{content.subtitle}</p>
        )}
      </div>

      {/* 概念定义 */}
      {content.definition && (
        <div style={{
          background: hexToRgba(theme.textPrimary, 0.04), borderRadius: theme.borderRadius,
          padding: '8px 12px', marginBottom: 12,
          border: `1px dashed ${hexToRgba(theme.textPrimary, 0.15)}`,
        }}>
          <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5, margin: 0 }}>
            {content.definition}
          </p>
        </div>
      )}

      {/* AI配图 */}
      {imageUrl && (
        <img
          src={imageUrl}
          crossOrigin="anonymous"
          alt=""
          style={{
            width: '100%', height: 90,
            objectFit: 'cover', objectPosition: 'center',
            borderRadius: theme.borderRadius, marginBottom: 12,
            border: `3px solid ${theme.bgSecondary}`,
            boxShadow: `0 3px 10px ${theme.shadowColor}`,
          }}
        />
      )}

      {/* 正文描述 */}
      {content.body && (
        <div style={{
          background: hexToRgba(theme.textPrimary, 0.04), borderRadius: theme.borderRadius,
          padding: '8px 12px', marginBottom: 12,
          border: `1px dashed ${hexToRgba(theme.textPrimary, 0.15)}`,
        }}>
          <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5, margin: 0 }}>
            {content.body}
          </p>
        </div>
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
                background: theme.bgSecondary, borderRadius: theme.borderRadius,
                padding: '14px 10px 10px',
                position: 'relative',
                boxShadow: `0 2px 8px ${theme.shadowColor}`,
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
                  fontSize: 14, fontWeight: 700, color: theme.textPrimary,
                  textAlign: 'center', margin: '0 0 6px',
                }}>{item.label}</h3>

                {/* 特征列表 */}
                <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.5, flex: 1 }}>
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
                background: theme.bgSecondary, borderRadius: theme.borderRadius,
                padding: '14px 10px 10px',
                position: 'relative',
                boxShadow: `0 2px 8px ${theme.shadowColor}`,
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
                  fontSize: 13, fontWeight: 700, color: theme.textPrimary,
                  textAlign: 'center', margin: '0 0 6px',
                }}>{mod.title}</h3>
                <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.5, flex: 1 }}>
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
          <div style={{ fontSize: 14, color: hexToRgba('#DC2626', 0.4), marginBottom: 2 }}>〰️〰️〰️</div>
          <p style={{
            fontSize: 13, color: '#DC2626', fontWeight: 500,
            textDecoration: 'underline', textDecorationColor: hexToRgba('#DC2626', 0.4),
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
              fontSize: 10, color: theme.textSecondary,
              border: `1px dashed ${hexToRgba(theme.textPrimary, 0.2)}`, padding: '1px 6px', borderRadius: 8,
              background: hexToRgba(theme.accent, 0.08),
            }}>#{tag}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, color: theme.textSecondary }}>{content.footer}</span>
      </div>
    </div>
  );
};

// ============================================================
// 4. 系列卡片 — 生命周期/时间线/流程（AI图全幅背景+文字叠加）
// ============================================================
const SeriesCard: React.FC<{ content: CardContent; imageUrl?: string; templateId: string; theme: CardTheme; cardIndex: number }> = ({ content, imageUrl, theme, cardIndex }) => {
  const modules = content.modules || [];
  const overlayColor = theme.quoteBg;

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative',
      fontFamily: theme.fontFamily,
      overflow: 'hidden',
      backgroundColor: theme.bgPrimary,
    }}>
      {/* ===== AI 图片全幅背景（用 img 标签，html-to-image 才能捕获） ===== */}
      {imageUrl && (
        <img
          src={imageUrl}
          crossOrigin="anonymous"
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      )}
      {/* 渐变遮罩 — 使用主题 quoteBg 派生，保证文字可读性 */}
      {imageUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to bottom, ${hexToRgba(overlayColor, 0.35)} 0%, transparent 20%, transparent 55%, ${hexToRgba(overlayColor, 0.55)} 72%, ${hexToRgba(overlayColor, 0.88)} 100%)`,
        }} />
      )}

      {/* ===== 顶部标题区 ===== */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '24px 28px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            background: imageUrl ? theme.bgOverlay : theme.titleBg,
            color: imageUrl ? theme.accent : '#fff',
            fontSize: 20, fontWeight: theme.titleWeight,
            padding: '5px 12px', borderRadius: theme.borderRadius,
            flexShrink: 0, lineHeight: 1.2,
            boxShadow: imageUrl ? `0 2px 8px ${theme.shadowColor}` : 'none',
          }}>
            {content.topicNumber || '01'}
          </div>
          <div>
            <h1 style={{
              fontSize: 24, fontWeight: theme.titleWeight,
              color: '#fff',
              margin: '0 0 2px', lineHeight: 1.2,
              textShadow: `0 2px 10px ${hexToRgba(overlayColor, 0.7)}`,
            }}>{content.title}</h1>
            {content.subtitle && (
              <p style={{
                fontSize: 13,
                color: 'rgba(255,250,240,0.92)',
                margin: 0,
                textShadow: `0 1px 6px ${hexToRgba(overlayColor, 0.6)}`,
              }}>{content.subtitle}</p>
            )}
          </div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: 'rgba(255,250,240,0.75)',
          textShadow: `0 1px 6px ${hexToRgba(overlayColor, 0.6)}`,
        }}>{content.seriesName}</span>
      </div>

      {/* ===== 底部内容叠加区 ===== */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        padding: '16px 24px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* 正文描述 */}
        {content.body && (
          <div style={{
            background: theme.bgOverlay,
            borderRadius: theme.borderRadius,
            padding: '10px 14px',
            boxShadow: `0 2px 10px ${theme.shadowColor}`,
            borderLeft: `3px solid ${theme.accent}`,
          }}>
            <p style={{
              fontSize: 12, color: theme.textPrimary, lineHeight: 1.7, margin: 0,
              fontWeight: 500,
            }}>{content.body}</p>
          </div>
        )}

        {/* 知识模块 — 半透明卡片 */}
        {modules.map((mod) => {
          const colors = getModuleColors(theme, mod.type);
          const icon = mod.icon || MODULE_ICONS[mod.type] || '📌';
          return (
            <div key={mod.id} style={{
              background: theme.bgOverlay,
              borderRadius: theme.borderRadius,
              padding: '8px 12px',
              display: 'flex', gap: 10, alignItems: 'flex-start',
              boxShadow: `0 2px 10px ${theme.shadowColor}`,
              borderLeft: `3px solid ${colors.bg}`,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: colors.bg, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, flexShrink: 0,
              }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                  fontSize: 12, fontWeight: 700, color: colors.text,
                  margin: '0 0 2px',
                }}>{mod.title}</h4>
                {mod.bullets && mod.bullets.length > 0 ? (
                  <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.4 }}>
                    {mod.bullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 1 }}>
                        <span style={{ color: colors.bg, fontWeight: 700 }}>•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.4, margin: 0 }}>
                    {mod.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* 金句栏 */}
        {content.quote && (
          <div style={{
            background: hexToRgba(theme.quoteBg, 0.88),
            borderRadius: theme.borderRadius, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: '#F5D547', fontSize: 13, flexShrink: 0 }}>⭐</span>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
              {content.quote}
            </span>
          </div>
        )}

        {/* 底部标签栏 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {content.tags.map((tag, i) => (
              <span key={i} style={{
                fontSize: 9, color: 'rgba(255,250,240,0.85)',
                background: hexToRgba(overlayColor, 0.4),
                padding: '1px 6px', borderRadius: 4,
              }}>#{tag}</span>
            ))}
          </div>
          <span style={{
            fontSize: 9,
            color: 'rgba(255,250,240,0.6)',
          }}>{content.footer}</span>
        </div>
      </div>
    </div>
  );
};
