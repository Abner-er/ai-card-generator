import type { StylePreset } from '../types';

/**
 * 卡片主题 — 由 StylePreset + cardIndex 动态生成
 * 控制渲染器的配色、字体、圆角、阴影等视觉属性
 */
export interface CardTheme {
  bgPrimary: string;
  bgSecondary: string;
  bgOverlay: string;
  textPrimary: string;
  textSecondary: string;
  textOnImage: string;
  accent: string;
  accentLight: string;
  accentSecondary: string;
  fontFamily: string;
  titleWeight: number;
  borderRadius: number;
  cardBorder: string;
  shadowColor: string;
  gradientDirection: string;
  titleBg: string;
  quoteBg: string;
  palette: string[];
}

const DEFAULT_THEME: CardTheme = {
  bgPrimary: '#F5F5F0',
  bgSecondary: '#ffffff',
  bgOverlay: 'rgba(255,252,245,0.94)',
  textPrimary: '#1a1a2e',
  textSecondary: '#555555',
  textOnImage: '#ffffff',
  accent: '#5B4FC4',
  accentLight: 'rgba(91,79,196,0.08)',
  accentSecondary: '#2563EB',
  fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
  titleWeight: 700,
  borderRadius: 10,
  cardBorder: '1px solid #E5E7EB',
  shadowColor: 'rgba(0,0,0,0.08)',
  gradientDirection: 'to bottom',
  titleBg: '#5B4FC4',
  quoteBg: '#1a1a2e',
  palette: ['#5B4FC4', '#2563EB', '#7C3AED', '#059669', '#D97706'],
};

function rotatePalette(palette: string[], index: number): string {
  return palette[index % palette.length];
}

function darken(hex: string, amount: number = 0.3): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function withAlpha(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

const GRADIENT_DIRECTIONS = [
  'to bottom',
  'to bottom left',
  'to bottom right',
  '135deg',
  'to top left',
  'to top right',
];

/**
 * 根据 StylePreset 和 cardIndex 生成卡片主题
 * 同一系列中每张卡片的强调色会轮换，渐变方向也会变化
 */
export function getCardTheme(preset: StylePreset | undefined, cardIndex: number = 0): CardTheme {
  if (!preset) return DEFAULT_THEME;

  const accent = rotatePalette(preset.palette, cardIndex);
  const accentSecondary = rotatePalette(preset.palette, cardIndex + 1);
  const gradientDirection = GRADIENT_DIRECTIONS[cardIndex % GRADIENT_DIRECTIONS.length];

  switch (preset.id) {
    case 'watercolor-nature':
      return {
        bgPrimary: '#f9f6f0',
        bgSecondary: '#ffffff',
        bgOverlay: 'rgba(255,252,248,0.93)',
        textPrimary: '#2d2d2d',
        textSecondary: '#5a5a5a',
        textOnImage: '#ffffff',
        accent,
        accentLight: withAlpha(accent, 0.08),
        accentSecondary,
        fontFamily: '"Noto Serif SC", "Songti SC", serif',
        titleWeight: 700,
        borderRadius: 12,
        cardBorder: `1px solid ${withAlpha(accent, 0.15)}`,
        shadowColor: 'rgba(0,0,0,0.06)',
        gradientDirection,
        titleBg: accent,
        quoteBg: darken(accent, 0.4),
        palette: preset.palette,
      };

    case 'clay-art':
      return {
        bgPrimary: '#f5f0e6',
        bgSecondary: '#fffdf8',
        bgOverlay: 'rgba(255,252,245,0.94)',
        textPrimary: '#4a3520',
        textSecondary: '#6b5b45',
        textOnImage: '#ffffff',
        accent,
        accentLight: withAlpha(accent, 0.1),
        accentSecondary,
        fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
        titleWeight: 800,
        borderRadius: 16,
        cardBorder: `2px solid ${withAlpha(accent, 0.2)}`,
        shadowColor: 'rgba(120,80,30,0.12)',
        gradientDirection,
        titleBg: accent,
        quoteBg: darken(accent, 0.3),
        palette: preset.palette,
      };

    case 'cyberpunk-neon':
      return {
        bgPrimary: '#0f0f1a',
        bgSecondary: '#1a1a2e',
        bgOverlay: 'rgba(15,15,26,0.88)',
        textPrimary: '#e0e0ff',
        textSecondary: '#a0a0c0',
        textOnImage: '#ffffff',
        accent,
        accentLight: withAlpha(accent, 0.15),
        accentSecondary,
        fontFamily: '"JetBrains Mono", "Noto Sans SC", monospace',
        titleWeight: 700,
        borderRadius: 6,
        cardBorder: `1px solid ${withAlpha(accent, 0.4)}`,
        shadowColor: withAlpha(accent, 0.3),
        gradientDirection,
        titleBg: accent,
        quoteBg: '#000010',
        palette: preset.palette,
      };

    case 'minimal-flat':
      return {
        bgPrimary: '#f0f4f8',
        bgSecondary: '#ffffff',
        bgOverlay: 'rgba(255,255,255,0.92)',
        textPrimary: '#1a1a2e',
        textSecondary: '#555555',
        textOnImage: '#ffffff',
        accent,
        accentLight: withAlpha(accent, 0.08),
        accentSecondary,
        fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
        titleWeight: 600,
        borderRadius: 8,
        cardBorder: '1px solid #E5E7EB',
        shadowColor: 'rgba(0,0,0,0.05)',
        gradientDirection,
        titleBg: accent,
        quoteBg: '#1a1a2e',
        palette: preset.palette,
      };

    case 'chinese-ink':
      return {
        bgPrimary: '#f5f0e6',
        bgSecondary: '#fffef9',
        bgOverlay: 'rgba(245,240,230,0.92)',
        textPrimary: '#2d2d2d',
        textSecondary: '#5a5a55',
        textOnImage: '#ffffff',
        accent,
        accentLight: withAlpha(accent, 0.08),
        accentSecondary,
        fontFamily: '"Noto Serif SC", "Songti SC", "SimSun", serif',
        titleWeight: 700,
        borderRadius: 4,
        cardBorder: `1px solid ${withAlpha(accent, 0.12)}`,
        shadowColor: 'rgba(60,50,30,0.08)',
        gradientDirection,
        titleBg: accent,
        quoteBg: '#2d2d2d',
        palette: preset.palette,
      };

    default:
      return { ...DEFAULT_THEME, accent, accentSecondary, gradientDirection, palette: preset.palette };
  }
}
