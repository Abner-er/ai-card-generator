import type { StylePreset } from '../types';

/**
 * 风格预设集合
 * 定义可视化风格的底色、质感与配色方案，用于 Stage 3 Prompt 工程阶段
 * stylePrompt 均为英文视觉风格描述，不包含任何中文文字内容
 *
 * P2 新增：
 * - fixedConstraints: 100% 固定约束（品牌一致性，永不改变）
 * - dynamicSlots: 100% 动态插槽（根据内容关系动态填充）
 */

// ==================== 水彩自然 ====================
const watercolorNature: StylePreset = {
  id: 'watercolor-nature',
  name: '水彩自然',
  nameEn: 'Watercolor Nature',
  stylePrompt:
    'watercolor hand-painted illustration, soft pigment bleed, delicate brushwork, natural science illustration style, gentle pastel palette, organic textures',
  baseColor: '#f9f6f0',
  texture: 'watercolor paper texture, soft wet-on-wet pigment diffusion, subtle grain',
  palette: ['#a8c4a2', '#e8b4a0', '#f5e6c8', '#9ab5c4', '#d4a5a5'],
  // P2: 固定约束 — 品牌一致性保障
  fixedConstraints: 'soft pigment bleed edges, delicate brushwork visible, organic textures only, no hard geometric shapes, no digital noise, no neon effects',
  // P2: 动态插槽 — 根据内容关系动态填充
  dynamicSlots: [
    'lighting mood (dawn/morning/midday/golden/twilight)',
    'subject pose and expression',
    'background habitat details',
    'color saturation level',
  ],
};

// ==================== 粘土风 ====================
const clayArt: StylePreset = {
  id: 'clay-art',
  name: '粘土风',
  nameEn: 'Clay Art',
  stylePrompt:
    '3D clay art style, matte clay texture, soft sculptural lighting, warm earth tones, diorama aesthetic, tactile handcrafted feel, rounded organic forms',
  baseColor: '#f5f0e6',
  texture: '3D clay render, soft matte surface, subtle fingerprints and sculpt marks, gentle ambient occlusion',
  palette: ['#d4a574', '#c08552', '#a67c52', '#e8c4a0', '#8b6f47'],
  fixedConstraints: 'matte clay texture throughout, soft sculptural lighting, rounded organic forms, no sharp edges, no photorealistic surfaces, no digital effects',
  dynamicSlots: [
    'scene diorama composition',
    'clay figure pose and expression',
    'environmental props and accessories',
    'warm earth tone variation',
  ],
};

// ==================== 赛博霓虹 ====================
const cyberpunkNeon: StylePreset = {
  id: 'cyberpunk-neon',
  name: '赛博霓虹',
  nameEn: 'Cyberpunk Neon',
  stylePrompt:
    'cyberpunk aesthetic, dark moody background, vibrant neon glow, futuristic sci-fi atmosphere, high contrast lighting, holographic highlights, chromatic aberration',
  baseColor: '#0f0f1a',
  texture: 'dark gradient surface, glossy neon reflections, subtle digital noise, glowing edge light',
  palette: ['#00d4ff', '#ff006e', '#8338ec', '#06ffa5', '#ffbe0b'],
  fixedConstraints: 'dark moody background, vibrant neon glow effects, high contrast lighting, no natural daylight, no soft pastels, no watercolor textures',
  dynamicSlots: [
    'neon color scheme emphasis',
    'sci-fi environment details',
    'glow intensity and spread',
    'holographic element placement',
  ],
};

// ==================== 极简扁平 ====================
const minimalFlat: StylePreset = {
  id: 'minimal-flat',
  name: '极简扁平',
  nameEn: 'Minimal Flat',
  stylePrompt:
    'flat design illustration, clean minimal style, isometric perspective, soft gradients, geometric shapes, modern infographic aesthetic, ample negative space',
  baseColor: '#f0f4f8',
  texture: 'clean flat surface, subtle soft gradient, smooth vector-like finish, no texture noise',
  palette: ['#4a90d9', '#7ec8e3', '#a8d8a8', '#f4a261', '#e76f51'],
  fixedConstraints: 'clean flat surfaces, geometric precision, isometric or orthographic perspective, no photorealistic textures, no brush strokes, no clay textures',
  dynamicSlots: [
    'geometric composition layout',
    'color palette emphasis',
    'icon and badge placement',
    'gradient direction and intensity',
  ],
};

// ==================== 中国水墨 ====================
const chineseInk: StylePreset = {
  id: 'chinese-ink',
  name: '中国水墨',
  nameEn: 'Chinese Ink',
  stylePrompt:
    'traditional Chinese ink wash painting, gongbi fine brushwork, rice paper texture, monochrome ink tones with subtle color accents, elegant composition, classical aesthetic',
  baseColor: '#f5f0e6',
  texture: 'rice paper texture, ink wash gradient, subtle paper fiber, traditional xuan paper grain',
  palette: ['#3a3a3a', '#6b5d4f', '#8b7355', '#c4a777', '#a8b5a0'],
  fixedConstraints: 'rice paper texture background, ink wash gradient effects, traditional brushwork visible, monochrome ink base, no neon or digital effects, no plastic or glossy surfaces',
  dynamicSlots: [
    'ink density and wash technique',
    'traditional seal stamp placement',
    'botanical or subject brushwork style',
    'subtle color accent level',
  ],
};

export const stylePresets: StylePreset[] = [
  watercolorNature,
  clayArt,
  cyberpunkNeon,
  minimalFlat,
  chineseInk,
];
