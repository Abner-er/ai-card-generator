import { useEffect, useRef } from 'react';
import type { CardData, StylePreset } from '../types';

/**
 * AdaptiveCardRenderer — AI 设计渲染器
 *
 * 替代旧方案：固定模板（TemplateLayer 绝对定位）
 * 新方案：渲染 AI 生成的自适应 HTML（每张卡独一无二）
 *
 * 使用方式：
 * - 优先使用 AI 设计的 design.html（如果存在）
 * - fallback 到 ImageOverlayRenderer 基础布局
 */

interface Props {
  card: CardData;
  stylePreset: StylePreset;
  cardIndex: number;
  cardTotal: number;
  width?: number;
  height?: number;
}

export function AdaptiveCardRenderer({ card, stylePreset, cardIndex, cardTotal, width = 270, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const srcRef = useRef<string>('');

  // 获取当前卡片的图片
  if (card.imageStatus === 'done' && card.imageUrl) {
    srcRef.current = card.imageUrl;
  }

  // 根据 designStatus 渲染不同内容
  if (card.designStatus === 'done' && card.design?.html) {
    // AI 设计已生成：直接渲染 HTML
    return (
      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden shadow-2xl relative"
        style={{ width, height, background: card.design.colors?.bg || stylePreset.baseColor }}
      >
        {/* dangerouslySetInnerHTML — 渲染 AI 生成的卡片 HTML */}
        <div
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: card.design.html }}
        />
      </div>
    );
  }

  if (card.imageStatus === 'generating' || card.imageStatus === 'pending') {
    // 图片未生成：显示占位符
    return (
      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden shadow-lg relative flex flex-col"
        style={{ width, height, background: stylePreset.baseColor }}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full border-2 border-dashed animate-spin"
                 style={{ borderColor: stylePreset.palette[0], borderTopColor: 'transparent' }} />
            <p className="text-xs text-gray-400">生成中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (card.imageStatus === 'error') {
    return (
      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden shadow-lg relative flex items-center justify-center"
        style={{ width, height, background: stylePreset.baseColor }}
      >
        <div className="text-center p-3">
          <p className="text-xs text-red-400 mb-1">图片生成失败</p>
          <p className="text-[10px] text-gray-400">{card.imageError || '重试'}</p>
        </div>
      </div>
    );
  }

  // Fallback: 基础图片叠加渲染（AI 设计未就绪时）
  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden shadow-lg relative"
      style={{ width, height, background: stylePreset.baseColor }}
    >
      {srcRef.current && (
        <img
          src={srcRef.current}
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
