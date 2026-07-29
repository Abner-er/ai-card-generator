import React from 'react';
import type { CardTemplate, CardContent, TemplateLayer } from '../types';

interface CardRendererProps {
  template: CardTemplate;
  content: CardContent;
  imageUrl?: string;
  /** 缩放比例（用于预览） */
  scale?: number;
  /** 用于截图的ref */
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 判断颜色是否为浅色（需要文字阴影）
 * 解析 hex / rgba 格式
 */
function isLightColor(color: string): boolean {
  let r = 255, g = 255, b = 255;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    }
  } else if (color.startsWith('rgba') || color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  }

  // 相对亮度公式
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
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
  const safeLayers = layers || [];

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
              backgroundColor: !imageUrl ? '#e8e8e8' : undefined,
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
                color: '#aaa',
                fontSize: 16,
                background: 'repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 12px, #e8e8e8 12px, #e8e8e8 24px)',
              }}>
                AI配图区域
              </div>
            )}
          </div>
        );

      case 'text':
        // 浅色文字需要阴影增强可读性
        const textColor = layer.color || '#333';
        const needsShadow = isLightColor(textColor);

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
              color: textColor,
              lineHeight: layer.lineHeight || 1.5,
              letterSpacing: layer.letterSpacing,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              overflow: 'hidden',
              textShadow: needsShadow ? '0 1px 4px rgba(0,0,0,0.35)' : 'none',
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
      {safeLayers.map((layer, index) => renderLayer(layer, index))}
    </div>
  );
};
