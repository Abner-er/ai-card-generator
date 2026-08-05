import { useEffect, useRef } from 'react';
import type { CardData, StylePreset } from '../types';

/**
 * AdaptiveCardRenderer — AI 设计渲染器
 *
 * 渲染 AI 生成的自适应 HTML 卡片（每张卡独一无二）
 * 支持预览缩放和导出原始尺寸
 */

interface Props {
  card: CardData;
  stylePreset: StylePreset;
  cardIndex: number;
  cardTotal: number;
  /** 预览缩放比 */
  scale?: number;
  width?: number;
  height?: number;
  innerRef?: React.Ref<HTMLDivElement>;
}

export function AdaptiveCardRenderer({ card, stylePreset, cardIndex, cardTotal, scale = 1, width, height, innerRef }: Props) {
  const internalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (innerRef) {
      if (typeof innerRef === 'object') innerRef.current = internalRef.current;
      else if (typeof innerRef === 'function') innerRef(internalRef.current);
    }
  }, [innerRef]);

  // 根据 designStatus 渲染不同内容
  if (card.designStatus === 'done' && card.design?.html) {
    // 计算实际显示尺寸：卡片 270x360，根据 scale 放大到容器尺寸
    // 用 flex 居中 + transform scale 保持原始比例
    const containerW = width || Math.max(270, Math.round(270 * scale * 2)); // 预览时放大一些
    const containerH = height || Math.max(360, Math.round(360 * scale * 2));
    // 计算缩放比：让 270x360 的卡片填满容器
    const scaleX = containerW / 270;
    const scaleY = containerH / 360;
    const finalScale = Math.min(scaleX, scaleY);

    return (
      <div
        ref={internalRef}
        className="rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center"
        style={{ width: containerW, height: containerH, background: stylePreset.baseColor }}
      >
        <div
          className="origin-center"
          style={{
            width: 270,
            height: 360,
            transform: `scale(${finalScale})`,
            transformOrigin: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: card.design.html }}
        />
      </div>
    );
  }

  // 设计失败，显示错误
  if (card.designStatus === 'error') {
    return (
      <div
        ref={internalRef}
        className="rounded-2xl overflow-hidden shadow-lg flex items-center justify-center"
        style={{ width: width || 270, height: height || 360, background: stylePreset.baseColor }}
      >
        <div className="text-center p-3">
          <p className="text-xs text-red-400 mb-1">AI 设计失败</p>
          <p className="text-[10px] text-gray-400">{card.designError || '请重试'}</p>
        </div>
      </div>
    );
  }

  // 设计未就绪：显示图片占位
  return (
    <div
      ref={internalRef}
      className="rounded-2xl overflow-hidden shadow-lg relative"
      style={{ width: width || 270, height: height || 360, background: stylePreset.baseColor }}
    >
      {card.imageStatus === 'done' && card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.stage}
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/60 to-transparent">
        <h3 className="text-white text-sm font-bold leading-tight mb-1 drop-shadow-lg">
          {card.stage}
        </h3>
        <p className="text-white/80 text-[10px] leading-relaxed line-clamp-2 drop-shadow">
          {card.subtitle}
        </p>
      </div>
    </div>
  );
}
