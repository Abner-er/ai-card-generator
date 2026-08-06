import { useEffect, useRef } from 'react';
import type { CardData, StylePreset } from '../types';

/**
 * AdaptiveCardRenderer — AI 设计渲染器
 *
 * 渲染 AI 生成的自适应 HTML 卡片（每张卡独一无二）
 * 预览：保持 270x360 原始尺寸，居中显示在容器中
 * 导出：使用原始 1080x1440 尺寸
 */

interface Props {
  card: CardData;
  stylePreset: StylePreset;
  cardIndex: number;
  cardTotal: number;
  /** 导出时使用 1080/1440，预览时忽略此参数 */
  width?: number;
  height?: number;
  innerRef?: React.Ref<HTMLDivElement>;
}

export function AdaptiveCardRenderer({ card, stylePreset, cardIndex, cardTotal, width, height, innerRef }: Props) {
  const internalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (innerRef) {
      if (typeof innerRef === 'object') innerRef.current = internalRef.current;
      else if (typeof innerRef === 'function') innerRef(internalRef.current);
    }
  }, [innerRef]);

  // 根据 designStatus 渲染不同内容
  if (card.designStatus === 'done' && card.design?.html) {
    // 导出时使用传入的 width/height，预览时使用固定 270x360
    const cardW = width || 270;
    const cardH = height || 360;

    return (
      <div
        ref={internalRef}
        className="rounded-2xl overflow-hidden shadow-2xl"
        style={{
          width: cardW,
          height: cardH,
          background: stylePreset.baseColor,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: card.design.html }} />
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
