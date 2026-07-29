import React from 'react';
import type { CardTemplate, CardContent, TemplateLayer } from '../types';

interface CardRendererProps {
  template: CardTemplate;
  content: CardContent;
  imageUrl?: string;
  /** 缩放比例（用于预览） */
  scale?: number;
  /** 用于截图的ref */
  innerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * 卡片渲染器组件
 * 根据模板配置和内容数据，渲染出精确排版的卡片
 */
export const CardRenderer: React.FC<CardRendererProps> = ({
  template,
  content,
  imageUrl,
  scale = 1,
  innerRef,
}) => {
  const { canvas, layers } = template;

  // 替换模板中的占位符
  const replacePlaceholders = (text: string): string => {
    return text
      .replace('{{title}}', content.title || '')
      .replace('{{subtitle}}', content.subtitle || '')
      .replace('{{body}}', content.body || '')
      .replace('{{footer}}', content.footer || '')
      .replace('{{tag}}', content.tags?.[0] || '')
      .replace('{{subject}}', content.title || content.subtitle || '');
  };

  // 渲染单个图层
  const renderLayer = (layer: TemplateLayer, index: number): React.ReactNode => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
    };

    switch (layer.type) {
      case 'image':
        return (
          <div
            key={layer.id || index}
          style={{
            ...baseStyle,
            backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
            backgroundColor: !imageUrl ? '#e0e0e0' : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {!imageUrl && (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: 14,
              background: 'repeating-linear-gradient(45deg, #eee, #eee 10px, #e5e5e5 10px, #e5e5e5 20px)',
            }}>
              AI配图区域
            </div>
          )}
          </div>
        );

      case 'text':
        return (
          <div
            key={layer.id || index}
            style={{
              ...baseStyle,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              textAlign: layer.align || 'left',
              alignItems: layer.align === 'center' ? 'center' : layer.align === 'right' ? 'flex-end' : 'flex-start',
              fontFamily: layer.fontFamily || 'sans-serif',
              fontSize: layer.fontSize,
              fontWeight: layer.fontWeight,
              color: layer.color,
              lineHeight: layer.lineHeight || 1.5,
              letterSpacing: layer.letterSpacing,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              overflow: 'hidden',
            }}
          >
            {replacePlaceholders(layer.content || '')}
          </div>
        );

      case 'box':
        return (
          <div
            key={layer.id || index}
            style={{
              ...baseStyle,
              background: layer.background,
              borderRadius: layer.borderRadius,
              border: layer.border,
              boxShadow: layer.boxShadow,
              backdropFilter: layer.backdropFilter,
              WebkitBackdropFilter: layer.backdropFilter,
            }}
          />
        );

      case 'tag':
        return (
          <div
            key={layer.id || index}
            style={{
              ...baseStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 18,
              color: '#00d4ff',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.05em',
            }}
          >
            {replacePlaceholders(layer.content || '')}
          </div>
        );

      default:
        return null;
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
      {layers.map((layer, index) => renderLayer(layer, index))}
    </div>
  );
};
