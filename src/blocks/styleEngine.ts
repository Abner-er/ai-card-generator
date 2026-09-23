/**
 * blocks/styleEngine.ts — 系列风格 + 生图提示词 + 信息区文字版式
 *
 * 混合导出法（Agnes-hardened 分支）：每个模块 = 一张「纯插画」位图（由 Agnes 生成，无字）
 * + 标题/正文/要点以清晰的 HTML/Canvas 文字叠加（导出与预览同一条路径）。
 * 这样 Agnes 只需稳定输出插画主体，彻底绕开它画不出多行中文的老问题。
 *
 * buildImagePrompt 只负责把「插画主体 + 风格」拼成一个交给 Agnes 的正面提示词（纯插画、禁字）。
 *
 * textTheme：每个视觉风格配套一套「信息区文字版式」(variant)，让代码叠字也有
 * 杂志/手帐/黑板/复古印刷/极简 等多样式，与插画风格呼应，但仍保持代码文字的清晰可读。
 */
import type { KnowledgeModule, Layout, ModuleStyle, ModuleType, Ratio, TextTheme, TextVariant } from './types';

export interface StylePreset {
  id: string;
  label: string;
  style: ModuleStyle;
}

/** 字体栈映射：CSS 与 Canvas 共用，保证预览/导出一致 */
export function fontStack(font: TextTheme['font']): string {
  switch (font) {
    case 'serif':
      return '"Songti SC","SimSun",serif';
    case 'kai':
      return '"Kaiti SC","KaiTi","楷体",serif';
    case 'mono':
      return '"Courier New",monospace';
    default:
      return '"PingFang SC","Microsoft YaHei",sans-serif';
  }
}

/** UI 可选的风格预设（也作为拆解时的系列风格建议） */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'flat',
    label: '专业医学插画',
    style: {
      artStyle: '专业医学插画、写实科学图示、清晰解剖风格',
      palette: '真实人体与医学色调、柔和低饱和、高可读',
      mood: '专业、清晰、可信赖',
      typography: '科学图示质感、细腻光影、干净边缘的医学插画材质',
      lighting: '柔和漫射工作室光照、均匀照明、无硬阴影、清晰可读',
      camera: '微距特写、科学纪录片视角、正面平视、剖面展开',
      material: '光滑科学插画质感、精准干净的边缘、真实器官与组织纹理',
      background: '#f7f7f5',
      textTheme: {
        variant: 'magazine',
        bg: '#ffffff',
        cardBg: '#f7f7f5',
        titleColor: '#1a1a1a',
        bodyColor: '#444444',
        accent: '#2b2b2b',
        deco: '#2b2b2b',
        font: 'sans',
        titleUnderline: true,
      },
    },
  },
  {
    id: 'watercolor',
    label: '清新水彩',
    style: {
      artStyle: '清新水彩手绘',
      palette: '米白底 + 柔和自然色（草绿/天蓝/暖橘）',
      mood: '治愈、温柔、文艺',
      typography: '水彩湿画法晕染、纸纹吸水、边缘自然扩散的柔和质感',
      lighting: '柔和自然日光、清晨暖光、温润漫射、无强对比',
      camera: '平视自然视角、柔焦背景、舒适自然的构图',
      material: '湿画法水彩晕染、纸张纤维吸水、半透明色层叠加、自然扩散边缘',
      background: '#fbf8f2',
      textTheme: {
        variant: 'bujo',
        bg: '#fdfbf7',
        cardBg: '#fbf8f2',
        titleColor: '#3a4a5a',
        bodyColor: '#4a5a6a',
        accent: '#6a8caf',
        deco: '#c98a8a',
        font: 'kai',
        titleBlock: true,
      },
    },
  },
  {
    id: 'clay',
    label: '3D 黏土',
    style: {
      artStyle: '3D 黏土风格、圆润立体',
      palette: '暖色奶油 + 马卡龙点缀',
      mood: '可爱、温暖、童趣',
      typography: '哑光黏土表面、圆润立体、柔和漫反射的立体材质',
      lighting: '柔和工作室光照、带方向性高光、温暖环境光、次表面散射',
      camera: '四分之三角度、略俯视、玩具摄影视角、圆润立体感',
      material: '哑光黏土表面、柔和次表面散射、圆润雕塑形态、指痕纹理',
      background: '#fdf3ec',
      textTheme: {
        variant: 'minimal',
        bg: '#fffdfb',
        cardBg: '#fdf3ec',
        titleColor: '#5a4636',
        bodyColor: '#6a5648',
        accent: '#e8a87c',
        deco: '#e8a87c',
        font: 'sans',
        titleBlock: true,
      },
    },
  },
  {
    id: 'ink',
    label: '国风水墨',
    style: {
      artStyle: '国风水墨、留白意境',
      palette: '宣纸米白 + 墨黑 + 印章红',
      mood: '雅致、沉静、有韵味',
      typography: '宣纸纤维纹理、水墨浓淡晕染、大面积留白的东方质感',
      lighting: '柔和漫射自然光、墨纸对比、内敛柔和的环境光',
      camera: '正面平视、卷轴画构图、居中对称、大面积留白',
      material: '宣纸纤维纹理、墨色浓淡渐变晕染、干笔飞白、墨溅边缘',
      background: '#f5f1e8',
      textTheme: {
        variant: 'minimal',
        bg: '#f5f1e8',
        cardBg: '#f5f1e8',
        titleColor: '#2b2b2b',
        bodyColor: '#4a4a4a',
        accent: '#9c2b2b',
        deco: '#9c2b2b',
        font: 'serif',
        titleUnderline: true,
      },
    },
  },
  {
    id: 'cyber',
    label: '赛博霓虹',
    style: {
      artStyle: '赛博朋克、霓虹光效',
      palette: '深蓝紫底 + 霓虹青/品红',
      mood: '科技、未来、酷炫',
      typography: '霓虹光晕、全息渐变、光滑数字表面的科技感材质',
      lighting: '霓虹辉光照明、高对比色光源、青色与品红边缘光、暗部深邃',
      camera: '戏剧性低角度、鱼眼畸变、动态荷兰式倾斜',
      material: '全息光泽表面、铬合金反射、LED 发光、玻璃与金属质感',
      background: '#14132b',
      textTheme: {
        variant: 'chalk',
        bg: '#14132b',
        cardBg: '#14132b',
        titleColor: '#6fe3ff',
        bodyColor: '#cfe8ff',
        accent: '#ff4fd8',
        deco: '#6fe3ff',
        font: 'mono',
      },
    },
  },
  {
    id: 'minimal',
    label: '极简线条',
    style: {
      artStyle: '极简线条插画、大量留白',
      palette: '纯白 + 一点黑灰 + 单一强调色',
      mood: '干净、克制、高级',
      typography: '极简线条、大量留白、单一线描的克制质感',
      lighting: '均匀照明、左上柔和方向光、极简阴影',
      camera: '平视正面或俯视、居中构图、大量负空间',
      material: '干净矢量线条、平涂色块、无纹理、利落几何边缘',
      background: '#fafafa',
      textTheme: {
        variant: 'minimal',
        bg: '#ffffff',
        cardBg: '#fafafa',
        titleColor: '#111111',
        bodyColor: '#555555',
        accent: '#111111',
        deco: '#111111',
        font: 'sans',
      },
    },
  },
  {
    id: 'doodle',
    label: '手绘涂鸦',
    style: {
      artStyle: '手绘涂鸦、马克笔勾线、手帐感',
      palette: '柔和粉彩、浅蓝/薄荷绿/奶油黄/浅粉',
      mood: '童趣、亲切、活泼',
      typography: '马克笔勾线、手绘笔触、轻微纸纹的涂鸦质感',
      lighting: '明亮均匀光照、活泼色彩光、无阴影',
      camera: '随性平视、快照构图、略微倾斜',
      material: '马克笔笔触、可见墨水渗透、纸张颗粒纹理、手绘轮廓线',
      background: '#fdf8f3',
      textTheme: {
        variant: 'bujo',
        bg: '#fffef9',
        cardBg: '#fdf8f3',
        titleColor: '#333333',
        bodyColor: '#555555',
        accent: '#ff8c42',
        deco: '#7ec8e3',
        font: 'kai',
      },
    },
  },
  {
    id: 'crayon',
    label: '蜡笔油画棒',
    style: {
      artStyle: '蜡笔/油画棒质感、笔触明显、边缘微糙',
      palette: '浓艳暖色 + 白色底、高饱和但不刺眼',
      mood: '稚拙、温暖、有手工感',
      typography: '蜡笔油画棒笔触、边缘微糙、厚涂质感的手工材质',
      lighting: '温暖自然日光、柔和金色光晕、舒适环境光',
      camera: '儿童视角、朴素构图、略微倾斜',
      material: '厚蜡笔笔触、可见纸张齿痕、厚重覆盖质感、粗糙边缘',
      background: '#fffdf7',
      textTheme: {
        variant: 'bujo',
        bg: '#fffdf7',
        cardBg: '#fffdf7',
        titleColor: '#4a3b2a',
        bodyColor: '#5a4a38',
        accent: '#e0853e',
        deco: '#d9b44a',
        font: 'kai',
      },
    },
  },
  {
    id: 'journal',
    label: '子弹手帐',
    style: {
      artStyle: '手帐手绘风、细腻笔触、圆点网格纹理、纸张肌理',
      palette: '莫兰迪彩 + 米白纸张、低饱和',
      mood: '自律、治愈、有条理',
      typography: '纸张纤维、细腻手绘线条、圆点网格纹理的手帐质感',
      lighting: '柔和台灯光照、温暖聚焦光晕、舒适环境光',
      camera: '俯视平铺、手帐页面视角、居中构图',
      material: '纸张圆点网格纹理、精细笔线、和纸胶带层叠、微妙纸纹',
      background: '#f6f2ea',
      textTheme: {
        variant: 'bujo',
        bg: '#f6f2ea',
        cardBg: '#f6f2ea',
        titleColor: '#4a5a4a',
        bodyColor: '#5a6a5a',
        accent: '#c2a878',
        deco: '#ffe08a',
        font: 'kai',
        titleBlock: true,
      },
    },
  },
  {
    id: 'picturebook',
    label: '儿童绘本',
    style: {
      artStyle: '儿童绘本插画、圆润角色、温馨场景、故事感',
      palette: '暖黄/天蓝/草绿、明亮柔和',
      mood: '温馨、讲故事、易亲近',
      typography: '绘本柔和渲染、圆润造型、温馨光感的故事书质感',
      lighting: '温暖故事书光照、柔和金色时刻光晕、温柔阴影',
      camera: '广角叙事视角、与角色平视、沉浸式场景',
      material: '柔和数字绘画质感、圆润笔触、水彩式融合、平滑渐变',
      background: '#fef9f0',
      textTheme: {
        variant: 'magazine',
        bg: '#fffdf8',
        cardBg: '#fef9f0',
        titleColor: '#5a3a2a',
        bodyColor: '#6a4a3a',
        accent: '#f0a040',
        deco: '#f0a040',
        font: 'sans',
        titleBlock: true,
      },
    },
  },
  {
    id: 'sketch',
    label: '铅笔素描',
    style: {
      artStyle: '铅笔素描、细腻排线、纸纹质感、单色素描',
      palette: '石墨灰阶、米白纸、单一淡彩点缀',
      mood: '学院、沉静、理性',
      typography: '铅笔排线、石墨灰阶、纸纹的素描质感',
      lighting: '单一方向光源、明暗对比法、柔和渐变阴影',
      camera: '学院派研究视角、四分之三侧视、分析性构图',
      material: '石墨铅笔排线、交叉影线、纸张纤维纹理、涂抹的石墨色调',
      background: '#f7f4ee',
      textTheme: {
        variant: 'minimal',
        bg: '#f7f4ee',
        cardBg: '#f7f4ee',
        titleColor: '#444444',
        bodyColor: '#5a5a5a',
        accent: '#666666',
        deco: '#888888',
        font: 'serif',
      },
    },
  },
  {
    id: 'penwash',
    label: '钢笔淡彩',
    style: {
      artStyle: '钢笔淡彩、线稿 + 淡淡水彩晕染',
      palette: '留白多、淡蓝/淡褐/淡绿、墨线勾勒',
      mood: '文艺、精致、博物志',
      typography: '钢笔淡墨线稿、淡淡水彩晕染、纸纹的博物志质感',
      lighting: '明亮自然日光、柔和漫射、轻微阴影',
      camera: '博物学插画视角、平视或略微四分之三视角',
      material: '钢笔墨线稿、淡淡水彩晕染、纸张纹理、精准笔触、透明色层',
      background: '#faf7f1',
      textTheme: {
        variant: 'minimal',
        bg: '#faf7f1',
        cardBg: '#faf7f1',
        titleColor: '#5a5040',
        bodyColor: '#6a6050',
        accent: '#8a9a8a',
        deco: '#8a9a8a',
        font: 'serif',
      },
    },
  },
  {
    id: 'collage',
    label: '纸拼贴',
    style: {
      artStyle: '纸艺拼贴质感、不同纸张的撕边与层叠、丰富纸纹肌理',
      palette: '米色牛皮纸 + 彩色卡纸、低饱和拼贴色',
      mood: '复古、手工、个性',
      typography: '撕边纸张层叠、纸纹肌理、拼贴边缘的纸艺质感',
      lighting: '侧面斜射光、纸张层间投射阴影、有质感的照明',
      camera: '俯视平铺、略微倾斜、拼贴画构图',
      material: '撕边纸张边缘、层叠卡纸、瓦楞纸板、薄纸、胶水痕迹',
      background: '#efe7d8',
      textTheme: {
        variant: 'riso',
        bg: '#efe7d8',
        cardBg: '#efe7d8',
        titleColor: '#3a3a3a',
        bodyColor: '#4a4a4a',
        accent: '#d98324',
        deco: '#4a7a9a',
        font: 'serif',
        titleBlock: true,
      },
    },
  },
  {
    id: 'chalkboard',
    label: '黑板粉笔',
    style: {
      artStyle: '粉笔手绘质感、深墨绿底、白/黄/粉粉笔线条与笔触、粉画风',
      palette: '深墨绿/深灰底 + 白/黄/粉粉笔色',
      mood: '课堂、教学、亲切',
      typography: '粉笔飞白笔触、深墨绿底、粉质纹理的粉笔质感',
      lighting: '粉笔粉尘环境光、柔和教室照明、粉笔痕迹微微发光',
      camera: '正面教室视角、居中构图',
      material: '粉笔粉末质感、涂抹粉笔痕、黑板擦条纹、深哑光石板表面',
      background: '#33403a',
      textTheme: {
        variant: 'chalk',
        bg: '#33403a',
        cardBg: '#33403a',
        titleColor: '#f5f5f0',
        bodyColor: '#e8e8e0',
        accent: '#ffd86b',
        deco: '#ffd86b',
        font: 'kai',
      },
    },
  },
  {
    id: 'riso',
    label: '复古印刷',
    style: {
      artStyle: 'Risograph 复古印刷、套色错位、网点颗粒',
      palette: '荧光粉/蓝/黄 + 米色纸、高对比套色',
      mood: '复古、艺术、设计感',
      typography: '网点颗粒、套色错位、粗糙印刷肌理的复古质感',
      lighting: '均匀平光、微暖复古色调、无硬阴影',
      camera: '平面设计视角、俯视或鸟瞰、海报构图',
      material: 'Risograph 半调网点、套色错位、大豆油墨质感、米纸纹理',
      background: '#f5efe2',
      textTheme: {
        variant: 'riso',
        bg: '#f5efe2',
        cardBg: '#f5efe2',
        titleColor: '#1a1a1a',
        bodyColor: '#3a3a3a',
        accent: '#ff5fa2',
        deco: '#4a90d9',
        font: 'sans',
        titleBlock: true,
      },
    },
  },
  {
    id: 'comic',
    label: '波普漫画',
    style: {
      artStyle: '波普漫画风、半调网点、粗黑描边、高对比色块',
      palette: '高饱和原色、红/黄/蓝、黑边强调',
      mood: '张力、活泼、抓眼',
      typography: '半调网点、粗黑描边、高对比色块的波普漫画质感',
      lighting: '高对比戏剧性光照、粗放阴影色块、漫画式明暗',
      camera: '动感英雄角度、戏剧性前缩、动作构图',
      material: '粗黑墨线描边、平涂色块、半调网点、新闻纸纹理',
      background: '#fdf6ef',
      textTheme: {
        variant: 'magazine',
        bg: '#fffdf9',
        cardBg: '#fdf6ef',
        titleColor: '#1a1a1a',
        bodyColor: '#333333',
        accent: '#ff3b30',
        deco: '#1a1a1a',
        font: 'sans',
        titleBlock: true,
      },
    },
  },
  {
    id: 'pixel',
    label: '像素复古',
    style: {
      artStyle: '8-bit 像素艺术、复古游戏风、方块边缘、像素字体',
      palette: '高饱和电子色、黑底或深蓝底 + 亮绿/亮粉',
      mood: '怀旧、游戏、数字',
      typography: '8-bit 方块像素、硬边缘、低分辨率纹理的复古数字质感',
      lighting: '平涂像素光照、无渐变、方块阴影、8-bit 抖动',
      camera: '正交俯视或横版侧视、像素画构图',
      material: '硬像素边缘、方块 8-bit 色块、有限调色板、无抗锯齿',
      background: '#1b1f3b',
      textTheme: {
        variant: 'chalk',
        bg: '#1b1f3b',
        cardBg: '#1b1f3b',
        titleColor: '#5dff8f',
        bodyColor: '#cfeaff',
        accent: '#ff5dce',
        deco: '#5dff8f',
        font: 'mono',
      },
    },
  },
  {
    id: 'scribble',
    label: '潦草速写',
    style: {
      artStyle: '潦草速写、松散手绘线条、未完成感、笔记风',
      palette: '黑墨线 + 米白纸 + 淡彩点缀（淡蓝/淡棕）',
      mood: '随性、亲切、探索中',
      typography: '潦草手写体、松散快速线条、速写笔触感',
      lighting: '自然侧光、纸面微反射、柔和投影',
      camera: '平视手账视角、略微倾斜的随性构图',
      material: '钢笔/铅笔快速线条、纸张纤维、墨水洇染、大量留白',
      background: '#faf7f0',
      textTheme: {
        variant: 'bujo',
        bg: '#fffdf8',
        cardBg: '#faf7f0',
        titleColor: '#333333',
        bodyColor: '#555555',
        accent: '#6a8caf',
        deco: '#c9a86a',
        font: 'kai',
      },
    },
  },
  {
    id: 'flat-design',
    label: '扁平化设计',
    style: {
      artStyle: '扁平化设计、几何色块、无阴影无渐变',
      palette: '明亮对比色、蓝/橙/黄/绿、干净纯色',
      mood: '现代、清晰、高效',
      typography: '粗体无衬线、高对比、扁平化图标式文字',
      lighting: '无光照、平涂均匀、无阴影',
      camera: '正面平视、居中对称、图标式构图',
      material: '纯色色块、无纹理、干净矢量边缘、无渐变',
      background: '#f5f5f5',
      textTheme: {
        variant: 'minimal',
        bg: '#ffffff',
        cardBg: '#f5f5f5',
        titleColor: '#1a1a1a',
        bodyColor: '#555555',
        accent: '#2563eb',
        deco: '#2563eb',
        font: 'sans',
      },
    },
  },
  {
    id: 'isometric',
    label: '等距三维',
    style: {
      artStyle: '等距三维插画、30度角、无透视畸变',
      palette: '柔和3D色调、蓝绿+暖橙、低饱和',
      mood: '结构化、专业、空间感',
      typography: '3D立体字效、等距视角文字、干净工业感',
      lighting: '柔和三点光照、上方主光、无硬阴影',
      camera: '等距30度俯角、无透视畸变、结构化视角',
      material: '光滑3D表面、柔和哑光材质、圆角边缘',
      background: '#f0f2f5',
      textTheme: {
        variant: 'data',
        bg: '#f0f2f5',
        cardBg: '#f0f2f5',
        titleColor: '#1e3a5f',
        bodyColor: '#3a5070',
        accent: '#2b8a9a',
        deco: '#2b8a9a',
        font: 'sans',
      },
    },
  },
  {
    id: 'woodcut',
    label: '木刻版画',
    style: {
      artStyle: '木刻版画、黑白高对比、粗犷刀痕',
      palette: '纯黑 + 米白 + 单一红色点缀',
      mood: '力量、古朴、震撼',
      typography: '木刻字体感、粗犷有力、黑白分明',
      lighting: '高对比单方向光、强烈明暗交界',
      camera: '正面平视、居中构图、海报式',
      material: '木刻刀痕、木纹残留、油墨不均匀、纸张压印',
      background: '#f5f0e8',
      textTheme: {
        variant: 'riso',
        bg: '#f5f0e8',
        cardBg: '#f5f0e8',
        titleColor: '#1a1a1a',
        bodyColor: '#333333',
        accent: '#9c2b2b',
        deco: '#1a1a1a',
        font: 'serif',
        titleBlock: true,
      },
    },
  },
  {
    id: 'engraving',
    label: '蚀刻版画',
    style: {
      artStyle: '蚀刻版画、精细排线、交叉影线、铜版质感',
      palette: '深褐墨色 + 米白纸 + 淡金点缀',
      mood: '学术、权威、古典',
      typography: '铜版蚀刻字体、精细线刻文字、古典学术感',
      lighting: '单方向光、细腻明暗渐变、学术照明',
      camera: '学术研究视角、正面或四分之三侧视',
      material: '铜版蚀刻线条、交叉影线、精细排线、旧纸张纹理',
      background: '#f4f0e6',
      textTheme: {
        variant: 'minimal',
        bg: '#f4f0e6',
        cardBg: '#f4f0e6',
        titleColor: '#3a2a1a',
        bodyColor: '#5a4a3a',
        accent: '#8a6a3a',
        deco: '#8a6a3a',
        font: 'serif',
        titleUnderline: true,
      },
    },
  },
  {
    id: 'gouache',
    label: '水粉画',
    style: {
      artStyle: '水粉画、不透明色块、覆盖力强、笔触明显',
      palette: '浓郁色块、暖橘/深绿/藏蓝、高饱和但不刺眼',
      mood: '温暖、厚重、有手工感',
      typography: '水粉笔触、不透明色块文字、厚重覆盖感',
      lighting: '自然柔光、色块间微妙明暗、无高光',
      camera: '平视自然视角、画面饱满',
      material: '水粉厚涂、不透明覆盖、干净色块边缘、纸张纹理',
      background: '#fbf5ee',
      textTheme: {
        variant: 'magazine',
        bg: '#fffdf8',
        cardBg: '#fbf5ee',
        titleColor: '#4a3520',
        bodyColor: '#5a4530',
        accent: '#c97a3a',
        deco: '#c97a3a',
        font: 'sans',
        titleUnderline: true,
      },
    },
  },
  {
    id: 'origami',
    label: '折纸风格',
    style: {
      artStyle: '折纸风格、几何折叠、利落棱角、层次分明',
      palette: '柔和纸色 + 亮色点缀、浅粉/浅蓝/米白',
      mood: '精致、巧妙、空间感',
      typography: '折纸几何文字、棱角分明的字体感',
      lighting: '侧光投射折痕阴影、层次分明',
      camera: '四分之三角度、展示折叠层次',
      material: '纸张折叠、利落棱角、投影层次、哑光纸面',
      background: '#f8f6f0',
      textTheme: {
        variant: 'minimal',
        bg: '#f8f6f0',
        cardBg: '#f8f6f0',
        titleColor: '#3a3a3a',
        bodyColor: '#5a5a5a',
        accent: '#e07a5f',
        deco: '#3a7a8a',
        font: 'sans',
      },
    },
  },
  {
    id: 'ghibli',
    label: '吉卜力风格',
    style: {
      artStyle: '吉卜力风格、手绘动画感、水彩背景、温暖叙事',
      palette: '温暖自然色、草绿/天蓝/暖黄、柔和饱和',
      mood: '治愈、怀旧、温暖',
      typography: '手写温暖字体、柔和圆润、动画标题感',
      lighting: '柔和自然光、金色时刻暖光、温柔阴影',
      camera: '广角叙事视角、与角色平视、沉浸式',
      material: '手绘水彩背景、赛璐璐角色层、柔和笔触、温暖渐变',
      background: '#f9f5ec',
      textTheme: {
        variant: 'magazine',
        bg: '#fffdf6',
        cardBg: '#f9f5ec',
        titleColor: '#4a3a2a',
        bodyColor: '#5a4a3a',
        accent: '#8aae5a',
        deco: '#d9a441',
        font: 'sans',
        titleBlock: true,
      },
    },
  },
  {
    id: 'bauhaus',
    label: '包豪斯',
    style: {
      artStyle: '包豪斯风格、原色几何、功能主义、极简构成',
      palette: '红/黄/蓝三原色 + 黑白、纯粹',
      mood: '理性、结构、现代主义',
      typography: '无衬线几何字体、粗壮、功能主义排版',
      lighting: '均匀光照、无阴影、平面化',
      camera: '正面平视、网格构图、几何对称',
      material: '纯色色块、无纹理、干净利落的几何边缘',
      background: '#f5f5f0',
      textTheme: {
        variant: 'data',
        bg: '#f5f5f0',
        cardBg: '#f5f5f0',
        titleColor: '#1a1a1a',
        bodyColor: '#333333',
        accent: '#dc2626',
        deco: '#1a1a1a',
        font: 'sans',
        titleBlock: true,
      },
    },
  },
  {
    id: 'cel-shading',
    label: '赛璐璐',
    style: {
      artStyle: '赛璐璐、动画风、粗线描边+平涂色块',
      palette: '高饱和动画色、蓝天/草绿/角色色',
      mood: '活泼、年轻、二次元',
      typography: '动画标题字体、粗描边文字、活力感',
      lighting: '高对比动画光照、明暗分明、色彩鲜明',
      camera: '动感视角、戏剧性构图、动画分镜感',
      material: '粗黑描边、平涂色块、无渐变、动画赛璐璐片质感',
      background: '#f5f8ff',
      textTheme: {
        variant: 'magazine',
        bg: '#fffefb',
        cardBg: '#f5f8ff',
        titleColor: '#2a2a4a',
        bodyColor: '#3a3a5a',
        accent: '#5a8acc',
        deco: '#ff6b6b',
        font: 'sans',
        titleBlock: true,
      },
    },
  },
  {
    id: 'infographic',
    label: '手绘信息图',
    style: {
      artStyle: '手绘信息图、马克笔勾线涂鸦、手账拼贴感、每个知识点配一个拟物小插画',
      palette: '米白纸张底 + 柔和粉彩（薄荷绿/天蓝/奶油黄/浅粉）+ 黑色勾线强调',
      mood: '亲切、活泼、有温度、轻松科普',
      typography: '手写风标题、圆角标签框、气泡对话框、编号圆圈，文字分区清晰',
      lighting: '明亮均匀平光、无阴影、平涂色彩',
      camera: '俯视平铺整页、四宫格或多分区排版、板块间用虚线与手绘箭头串联',
      material: '马克笔勾线、和纸胶带、贴纸、回形针、星星小装饰、纸张颗粒纹理',
      background: '#fdf9f0',
      textTheme: {
        variant: 'bujo',
        bg: '#fffdf6',
        cardBg: '#fdf9f0',
        titleColor: '#333333',
        bodyColor: '#555555',
        accent: '#ff8c42',
        deco: '#7ec8e3',
        font: 'kai',
        titleBlock: true,
      },
    },
  },
];

export function getPreset(id: string): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[0];
}

/** 给预设补一个安全浅色底（防止 style.background 缺失） */
export function presetBackground(p: StylePreset): string {
  return p.style.background ?? '#faf8f3';
}

/** 取信息区主题（缺省回退到极简） */
export function getTextTheme(style?: ModuleStyle): TextTheme {
  return (
    style?.textTheme ?? {
      variant: 'minimal',
      bg: '#ffffff',
      cardBg: '#fafafa',
      titleColor: '#1a1a1a',
      bodyColor: '#555',
      accent: '#1a1a1a',
      deco: '#1a1a1a',
      font: 'sans',
    }
  );
}

/**
 * 布局维度（与风格解耦）：决定模块图里文字与图形的空间排布骨架。
 * 针对免费 Agnes 的中文文字天花板，所有布局都收敛为「单一聚焦主体插画」的海报式排布，
 * 避免触发 AI 在纸片/标签/黑板等容器里乱填文字。
 */
export interface LayoutPreset {
  id: Layout;
  label: string;
  /** 空间排布指令（写进生图提示词） */
  hint: string;
}

export const LAYOUTS: LayoutPreset[] = [
  { id: 'sparse', label: '极简留白', hint: '开阔构图：主体位于画面中心或黄金分割点，四周大量留白，突出主体本身，画面有呼吸感。' },
  { id: 'balanced', label: '平衡分布', hint: '平衡构图：主体与相关环境元素左右或上下均衡分布，画面稳定且有空间层次。' },
  { id: 'dense', label: '密集有序', hint: '饱满构图：主体周围布满相关的细节与小元素，画面丰富但不杂乱，有探索感。' },
  { id: 'list', label: '竖向清单', hint: '主次构图：主体占据主要位置，旁边或下方自然排列 2~4 个相关联的小视觉元素。' },
  { id: 'comparison', label: '左右对照', hint: '对照构图：两个相关对象分居画面左右或上下，形成鲜明对比，背景统一。' },
  { id: 'flow', label: '步骤流程', hint: '流程构图：画面具有从左到右或从上到下的叙事方向，主体与路径、阶段图形共同推进。' },
  { id: 'mindmap', label: '中心放射', hint: '放射构图：中心主体向外放射出 3~5 条关联线，连接周围相关元素，整体呈网络状。' },
  { id: 'quadrant', label: '四象限', hint: '四象限构图：画面自然分成四个视觉区域，每个区域放置一个相关元素或场景片段。' },
  { id: 'bigNumber', label: '数字主视觉', hint: '数字主视觉构图：一个巨大的、图形化的数量意象或符号作为画面核心，主体环绕其周围。' },
];

const LAYOUT_HINT: Record<Layout, string> = Object.fromEntries(
  LAYOUTS.map((l) => [l.id, l.hint]),
) as Record<Layout, string>;

/** 每个模块类型 → 默认布局（拆解时写入，UI 可改）。用更丰富的构图打破单一感。 */
export const DEFAULT_LAYOUT: Record<ModuleType, Layout> = {
  cover: 'sparse',
  definition: 'balanced',
  fact: 'list',
  step: 'flow',
  compare: 'comparison',
  timeline: 'flow',
  stat: 'bigNumber',
  quote: 'sparse',
  tip: 'balanced',
  section: 'dense',
};

/** 各类型的版式构图提示：强调不同镜头/场景/构图，避免每张都像证件照 */
const TYPE_HINT: Record<ModuleType, string> = {
  cover: '封面页：开阔场景，主视觉与环境共同构成整体氛围，有空间纵深感，像一幅完整的场景插画，大标题醒目地融入画面上方或中央。',
  definition: '定义页：清晰展示概念核心，可以是剖面、内部结构、特写或主体在环境中的典型状态，标题和定义文字融入画面。',
  fact: '知识点页：主体在真实场景中呈现，允许相关配角元素或环境细节辅助说明，标题和要点文字清晰排列在画面中。',
  step: '步骤页：动态场景，主体正在执行某个动作，画面有方向感和先后次序，步骤文字编号融入流程。',
  compare: '对比页：两个相关对象并列或分屏呈现，形成视觉对照，对比标签文字融入画面。',
  timeline: '时间线页：同一主体在时间中的变化，或按阶段展开的场景序列感，时间节点文字标注融入画面。',
  stat: '数据页：用一个巨大的视觉符号或数量意象作为核心，主体围绕它组织，数字与标签文字醒目地融入画面。',
  quote: '金句页：与金句含义直接对应的具象场景，金句文字以优美排版融入画面，主体与场景自然融合。',
  tip: '贴士页：轻量生活化小场景，主体与一两个提示性小元素自然互动，贴士文字融入画面。',
  section: '分节页：与分节主题直接相关的具象场景，有形式感，分节标题文字融入画面。',
};

/**
 * 生成 Agnes 提示词（图文一体分支）：精简结构，去掉重复，每句话只说一件事。
 * 结构：风格基底 → 构图场景 → 画面文字 → 禁止项
 */
export function buildImagePrompt(
  m: Pick<KnowledgeModule, 'type' | 'title' | 'body' | 'bullets' | 'icon' | 'visualHint' | 'layout'>,
  style: ModuleStyle,
  opts?: { anchor?: boolean },
): string {
  const parts: string[] = [];

  // 1. 风格基底
  parts.push(`一幅${style.artStyle}风格的知识卡片插画。配色：${style.palette}。整体氛围：${style.mood}。`);

  // 2. 构图 + 场景（合并 TYPE_HINT 与 LAYOUT_HINT，去重复）
  const compose = `${TYPE_HINT[m.type] ?? ''} ${LAYOUT_HINT[m.layout] ?? ''}`.trim();
  if (compose) parts.push(compose);

  // 3. 核心场景（visualHint）
  if (m.visualHint) {
    parts.push(`画面主体与场景：${m.visualHint}。与主体直接相关的细节要丰富，无关装饰不要加。`);
  }

  // 4. 光照 + 镜头 + 材质（各一句话）
  if (style.lighting) parts.push(`光照：${style.lighting}。`);
  if (style.camera) parts.push(`视角：${style.camera}。`);
  if (style.material) parts.push(`材质：${style.material}。`);

  // 5. 画面文字（标题 + 正文 + 要点 + 图标，一句话写完）
  const textParts: string[] = [];
  textParts.push(`「${m.title}」作为最大标题文字渲染在画面中`);
  if (m.body) textParts.push(`，正文「${m.body}」字号次之，放在标题下方`);
  if (m.bullets && m.bullets.length > 0) {
    const bulletList = m.bullets.map((b, i) => `${i + 1}. ${b}`).join('、');
    textParts.push(`，要点「${bulletList}」字号最小，竖向排列`);
  }
  if (m.icon) textParts.push(`，可融入「${m.icon}」图标作为装饰`);
  textParts.push(`。所有文字清晰可读，大小有层级，与插画风格融为一体。`);
  parts.push(textParts.join(''));

  // 6. 锚点参考
  if (opts?.anchor) {
    parts.push('本系列已有锚点图作为参考，保持配色和画风统一；但内容按主体全新构图。');
  }

  // 7. 禁止项
  parts.push('禁止：标注线、说明线、指示线、无关装饰、抽象色块、纯装饰性边框。');

  return parts.join(' ');
}

/**
 * 生成多模块手抄报式提示词：多个知识模块融合在一张图里，
 * 每个模块是独立的内容板块，信息密度高。
 */
export type PageBadgePos = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';
export type PageBadgeFormat = 'cn' | 'slash' | 'dot';

const POS_WORDS: Record<PageBadgePos, string> = {
  tl: '左上角', tc: '上边缘正中', tr: '右上角',
  bl: '左下角', bc: '下边缘正中', br: '右下角',
};

function badgeLabel(fmt: PageBadgeFormat, n: number, total: number): string {
  if (fmt === 'slash') return `${n} / ${total}`;
  if (fmt === 'dot') return `${n} · ${total}`;
  return `第 ${n} / ${total} 页`;
}

/**
 * 清洗拆解模型产出的布局描述：剔除「底部留白」「大面积空白」这类句子。
 * 生图模型会忠实执行这些指令，导致画面出现无内容的空白带（实测踩坑）。
 */
function sanitizeLayoutHint(hint: string): string {
  return hint
    .split(/[，。；、]/)
    .filter((seg) => seg.trim() && !/留白|空白|空出|空隙|不放置|无需内容|轻微纹理/.test(seg))
    .join('，');
}

/** 统一负面约束：全系列共用，逐张写入提示词末尾，防止风格漂移 */
const NEGATIVE_UNIFIED =
  '负面约束（全图一致）：无 3D 渲染、无照片写实、无阴暗色调、无乱码错别字、无模糊扭曲图形、无杂乱背景，禁止逐张更换背景色、字体与配色方案。';

/**
 * 系列统一设定块（风格圣经）：只由 style 推导，同一 style 输出逐字一致，
 * 在同组每一张提示词开头原样复用。这是「同组生图一致」的主抓手。
 * 锁死五件事：背景、配色角色、标题处理、卡片样式、装饰与字体。
 */
export function buildSeriesBible(style: ModuleStyle): string {
  const bg = style.background ? `${style.background} 纯色底` : '同一干净纯色底';
  return [
    '【系列统一设定 · 同组每张逐字复用，禁止逐张改动】',
    `画风：${style.artStyle}，全系列一致。`,
    `背景：全部图固定同一${bg}；不得逐张更换背景颜色，不得添加点阵、网格、纸张纹理、笔记本孔等背景变化。`,
    `配色（固定色彩角色，全图一致）：仅使用这套调色板——${style.palette}。其中主色用于主标题文字与卡片标题条，辅色用于卡片描边与分隔，强调色用于小图标与高亮数字，最浅色用于卡片底色。严禁逐张更换配色方案或临时引入新颜色。`,
    '标题处理：全系列统一——主标题大号粗体（主色），下方一行小字副标题，配手绘下划线装饰；每张同一处理手法。',
    '卡片样式：统一为白色圆角卡片 + 轻微投影 + 一致圆角，卡片顶部一条彩色标题条；卡片风格、圆角、间距全图一致。',
    `装饰与字体：统一装饰词汇（${style.material || '手绘小图标、引线'}），统一字体（${style.typography || '圆润手写风'}），不逐张新增无关装饰。`,
  ].join(' ');
}

/**
 * 风格锚点图提示词：先出这一张封面锁定整组风格，
 * 之后每张生成时把它当「参考图」上传（I2I），把一致性拉到接近 Codex 的像素级。
 */
/** 确定性的系列副标题文案：生图 prompt 必须给出具体副标题文字，
 *  否则生图模型每次自行发挥、同一张多次生成副标题会漂移（多次生图实测踩坑）。 */
function seriesSubtitle(opts: { hasCover: boolean; seriesTitle?: string; totalPages?: number }): string {
  if (opts.hasCover) {
    const p = opts.totalPages && opts.totalPages > 0 ? `${opts.totalPages} 页` : '全系列';
    return `知识图解 · ${p}`;
  }
  return opts.seriesTitle || '知识图解';
}

export function buildAnchorPrompt(seriesTitle: string, style: ModuleStyle): string {
  const subtitle = seriesSubtitle({ hasCover: true });
  const parts: string[] = [];
  parts.push('【风格锚点图 · 请先生成这一张，之后所有页面都把它作为参考图】');
  parts.push(buildSeriesBible(style));
  parts.push(
    `构图（系列封面）：顶部大字号系列主标题「${seriesTitle}」（主色、粗体、手绘下划线），下方一行副标题「${subtitle}」（此副标题文字为固定内容，不得更改或临场发挥）；` +
    '中部为整组 3-5 个核心知识点卡片预览（与后续页同款白色圆角卡片，每张含彩色标题条 + 简短文字）；' +
    '底部一条通栏横幅写一句系列总结（固定格式：只能是一句连贯的话，8~14 字）；内容铺满画布，边缘不得留空白带。',
  );
  if (style.lighting) parts.push(`光照：${style.lighting}。`);
  if (style.camera) parts.push(`视角：${style.camera}。`);
  parts.push(NEGATIVE_UNIFIED);
  parts.push('本张为整组风格锚点，后续每张都需与它的配色、字体、卡片样式、背景、装饰语言完全一致。');
  return parts.join(' ');
}

/** 参考图工作流引导：在 UI 展示，也写进批量导出头部 */
export const REFERENCE_WORKFLOW =
  '一致性使用步骤：1) 先用「风格锚点图」提示词在千问生成一张，锁定整组风格；' +
  '2) 生成后续每一页时，把这张锚点图作为「参考图」上传（千问支持参考图/多图输入），再粘贴该页提示词；' +
  '3) 锚点图保证吉祥物、配色、版式像素级一致，每张开头的「系列统一设定」块作为兜底，防止风格漂移。';

/** 从页面标题中剥离结构/功能词前缀（封面/首页/目录/引言/总结 等），让画面主标题只反映内容主题 */
const PAGE_ROLE_WORDS = ['封面', '首页', '目录', '引言', '导语', '前言', '开篇', '结尾', '结语', '收尾', '总结', '概述', '总览', '综述', '开屏', 'intro', 'index'];
function stripPageRoleWord(raw: string): string {
  if (!raw) return '';
  let t = raw.trim();
  // 反复剥离开头的结构词（含 "封面与/"封面、/"封面：" 等分隔）
  let changed = true;
  while (changed) {
    changed = false;
    for (const w of PAGE_ROLE_WORDS) {
      if (t === w) { t = ''; changed = true; break; }
      const re = new RegExp(`^${w}\\s*[、，,；;:：/・·|]?\\s*`);
      if (re.test(t)) { t = t.replace(re, ''); changed = true; break; }
    }
  }
  // 剩余若是纯连接词（与/及/和）开头，也剥掉，避免出现「与定义」这类残段
  return t.replace(/^[与及和、，,；;。．]+/, '').trim();
}

export function buildPagePrompt(
  page: { title: string; ratio: string; visualHint?: string },
  modules: Array<Pick<KnowledgeModule, 'type' | 'title' | 'body' | 'bullets' | 'icon'>>,
  style: ModuleStyle,
  opts?: {
    anchor?: boolean;
    /** 系列标题：封面页（含 cover 模块）用它作主标题，避免「封面与定义」这类结构词混入画面文字 */
    seriesTitle?: string;
    pageNumber?: number;
    totalPages?: number;
    pagePos?: PageBadgePos;
    pageFormat?: PageBadgeFormat;
  },
): string {
  const parts: string[] = [];

  // 主标题决策：封面页用系列标题；非封面页用页面标题（并剥离轻量的页面结构词前缀）
  const hasCover = modules.some((m) => m.type === 'cover');
  const mainTitle = hasCover && opts?.seriesTitle
    ? opts.seriesTitle
    : stripPageRoleWord(page.title);
  const subtitle = seriesSubtitle({ hasCover, seriesTitle: opts?.seriesTitle, totalPages: opts?.totalPages });

  // 1. 系列统一设定块（逐字复用，同组一致的主抓手）
  parts.push(buildSeriesBible(style));

  // 2. 固定版式骨架（不再由逐页 visualHint 决定，消除版式随机漂移）
  parts.push(
    `本张版面（全系列统一骨架）：顶部标题区——大号主标题「${mainTitle}」+ 下方一行副标题「${subtitle}」（此副标题文字为固定内容，不得更改或临场发挥）+ 手绘下划线；` +
    `中部为 ${modules.length} 个白色圆角内容卡片，按网格/纵向排布，每张卡片顶部一条彩色标题条、下方为正文或要点，卡片大小与间距一致；` +
    '底部一条通栏横幅承载本页一句话总结（固定格式：只能是一句连贯的话，8~14 字，概括本页模块共同主题；全页仅此一句，不得写成列表、分条或成段）。内容铺满整个画布：顶部、中部、底部都要有信息或插画承载，画面任何边缘不得出现无内容的空白带。',
  );

  // 2.5 页码编号（可选）：位置精确到角，样式全图一致
  if (typeof opts?.pageNumber === 'number' && typeof opts?.totalPages === 'number' && opts.totalPages > 0) {
    const pos = POS_WORDS[opts.pagePos ?? 'tr'];
    const label = badgeLabel(opts.pageFormat ?? 'cn', opts.pageNumber, opts.totalPages);
    parts.push(
      `在画面${pos}、紧贴边缘约 5% 边距处，单独显示一行很小的文字「${label}」：` +
      `纯文字、无底纹、无边框，字号约为模块标题的三分之一，颜色与画面正文文字色一致，手绘笔触；` +
      `该编号全图仅出现这一次，数字必须与「${label}」完全一致，不得改写、增删或重复。`,
    );
  }

  // 3. 逐页内容槽（唯一逐张变化的部分）
  modules.forEach((m, i) => {
    const sections: string[] = [];
    sections.push(`卡片${i + 1}「${m.title}」`);
    if (m.body) sections.push(m.body);
    if (m.bullets && m.bullets.length > 0) {
      sections.push('要点：' + m.bullets.map((b, j) => `${j + 1}. ${b}`).join('、'));
    }
    parts.push(sections.join('，') + '。');
  });

  // 3.5 本页主体配图（visualHint 降级为卡片插画素材，不再决定布局）
  if (page.visualHint) {
    const cleaned = sanitizeLayoutHint(page.visualHint);
    if (cleaned) {
      parts.push(`本页卡片内插画主体：${cleaned}。（仅作为卡片内的插画素材，不改变上述统一版面骨架与配色角色。）`);
    }
  }

  // 4. 光照 + 镜头（风格级，全系列一致）
  if (style.lighting) parts.push(`光照：${style.lighting}。`);
  if (style.camera) parts.push(`视角：${style.camera}。`);

  // 5. 文字层级
  parts.push('所有文字清晰可读，大小有层级（卡片标题最大、正文中等、要点稍小），与插画风格融为一体。');

  // 6. 锚点参考（用户上传参考图时，这一行强化「对齐锚点」）
  if (opts?.anchor) {
    parts.push('本系列已有锚点图作为参考，严格对齐其配色、字体、卡片样式、背景与装饰语言；仅内容按本页全新组织。');
  }

  // 7. 统一负面约束
  parts.push(NEGATIVE_UNIFIED);
  parts.push('禁止：标注线、说明线、指示线、抽象色块、纯装饰性边框、大面积空白、无内容的空白带。');

  return parts.join(' ');
}

// ===== 风格推荐引擎 =====

interface StyleRule {
  keywords: string[];
  presetId: string;
  reason: string;
  weight: number;
}

const STYLE_RULES: StyleRule[] = [
  // 传统/历史/文化
  { keywords: ['古法', '传统', '历史', '古代', '文化', '非遗', '传承', '古典', '民俗', '国风', '汉服', '书法', '节气', '节日'], presetId: 'ink', reason: '传统主题适合国风水墨，体现文化底蕴', weight: 3 },
  { keywords: ['木刻', '雕版', '年画', '版画'], presetId: 'woodcut', reason: '匹配版画主题', weight: 3 },
  { keywords: ['考古', '文物', '碑文', '铭文', '甲骨', '青铜'], presetId: 'engraving', reason: '考古文物适合蚀刻版画风格', weight: 3 },

  // 科技/技术
  { keywords: ['科技', '技术', '代码', '编程', '算法', '程序', '软件', 'HTTP', 'TCP', '协议', '服务器', '网络', '计算机', '互联网', 'API', '前端', '后端', '数据库', '人工智能', 'AI', '机器学习'], presetId: 'cyber', reason: '科技主题适合赛博霓虹风格', weight: 3 },
  { keywords: ['架构', '系统', '部署', '微服务', '容器', '云', 'DevOps', 'K8s', 'Docker'], presetId: 'isometric', reason: '系统架构适合等距三维风格', weight: 3 },
  { keywords: ['数据', '分析', '报表', '统计', '可视化', '指标', '监控'], presetId: 'flat-design', reason: '数据分析适合扁平化设计', weight: 3 },

  // 美食/烹饪
  { keywords: ['美食', '食物', '烹饪', '料理', '菜谱', '食材', '豆腐', '茶', '酒', '咖啡', '烘焙', '面包', '菜', '饭', '面', '汤', '糖', '酱', '糕点', '点心'], presetId: 'doodle', reason: '美食制作适合手绘涂鸦风格，亲切易懂', weight: 2 },
  { keywords: ['甜品', '蛋糕', '巧克力', '冰淇淋', '饮品'], presetId: 'watercolor', reason: '甜品饮品适合水彩风格，柔和精致', weight: 2 },

  // 自然/生态
  { keywords: ['自然', '植物', '花', '树', '动物', '昆虫', '海洋', '森林', '生态', '环境', '生物', '鸟', '鱼'], presetId: 'watercolor', reason: '自然主题适合水彩风格，柔和灵动', weight: 2 },
  { keywords: ['风景', '田园', '乡村', '四季', '山水', '花园'], presetId: 'ghibli', reason: '田园风景适合吉卜力风格，温暖治愈', weight: 2 },

  // 医学/健康
  { keywords: ['医学', '健康', '人体', '疾病', '症状', '治疗', '药', '解剖', '生理', '医院', '养生', '中医'], presetId: 'flat', reason: '医学主题适合专业医学插画风格', weight: 3 },

  // 教育/科普
  { keywords: ['科普', '教学', '教育', '知识', '学习', '课程', '考试', '学生', '笔记', '复习'], presetId: 'journal', reason: '教育科普适合子弹手帐风格', weight: 2 },
  { keywords: ['清单', '盘点', '一览', '汇总', '总结', '入门', '零基础', '知识点', '要素', '几招', '几个'], presetId: 'infographic', reason: '清单/盘点类内容适合手绘信息图，分区清晰、有拟物小插画好记', weight: 2 },

  // 儿童/故事
  { keywords: ['儿童', '童话', '故事', '寓言', '卡通', '动漫', '绘本', '宝宝', '亲子'], presetId: 'picturebook', reason: '儿童故事适合绘本风格', weight: 3 },

  // 流程/步骤（通用，权重低）
  { keywords: ['流程', '步骤', '教程', '操作', '指南', '方法', '工序', '工艺', '怎么做', '制作'], presetId: 'isometric', reason: '流程步骤适合等距三维风格，结构清晰', weight: 1 },

  // 艺术/设计
  { keywords: ['艺术', '设计', '美学', '色彩', '构图', '创意', '美术'], presetId: 'bauhaus', reason: '艺术设计适合包豪斯风格', weight: 2 },

  // 旅行/地理
  { keywords: ['旅行', '旅游', '地理', '城市', '建筑', '地图', '景点', '游记'], presetId: 'ghibli', reason: '旅行主题适合吉卜力风格，温暖治愈', weight: 2 },

  // 商业/金融
  { keywords: ['商业', '金融', '市场', '经济', '股票', '投资', '财务', '营销', '品牌'], presetId: 'flat-design', reason: '商业主题适合扁平化设计', weight: 2 },

  // 情感/心理
  { keywords: ['心理', '情绪', '情感', '关系', '沟通', '社交'], presetId: 'doodle', reason: '情感心理适合手绘涂鸦风格，亲切温暖', weight: 2 },

  // 对比/区别
  { keywords: ['对比', '区别', '差异', 'vs', 'VS', 'Vs', '比较', '证书'], presetId: 'flat-design', reason: '对比类主题适合扁平化设计，双栏排版清晰', weight: 2 },

  // 物理/化学
  { keywords: ['物理', '化学', '实验', '分子', '原子', '反应', '力学', '光学'], presetId: 'flat-design', reason: '理化实验适合扁平化设计', weight: 3 },

  // 运动/健康生活
  { keywords: ['运动', '健身', '跑步', '瑜伽', '体育', '锻炼'], presetId: 'doodle', reason: '运动健身适合手绘涂鸦风格', weight: 2 },
];

export function recommendStyle(input: string): { presetId: string; reason: string } | null {
  const text = input.toLowerCase();
  const scores = new Map<string, { score: number; reason: string }>();

  for (const rule of STYLE_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        const cur = scores.get(rule.presetId);
        const newScore = (cur?.score ?? 0) + rule.weight;
        if (!cur || newScore > cur.score) {
          scores.set(rule.presetId, { score: newScore, reason: rule.reason });
        } else {
          cur.score = newScore;
        }
      }
    }
  }

  // 无命中时返回 null（界面不显示推荐条，避免误导成某个特定风格）
  let bestId: string | null = null;
  let bestScore = 0;
  let bestReason = '';
  for (const [id, { score, reason }] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
      bestReason = reason;
    }
  }

  if (!bestId) return null;
  return { presetId: bestId, reason: bestReason };
}

/** 各类型的默认比例（拆解服务也用它） */
export const TYPE_DEFAULT_RATIO: Record<ModuleType, Ratio> = {
  cover: '3:4',
  definition: '4:3',
  fact: '1:1',
  step: '9:16',
  compare: '16:9',
  timeline: '4:3',
  stat: '3:4',
  quote: '3:4',
  tip: '1:1',
  section: '3:4',
};

/**
 * 信息区「版式装饰」统一描述：网页预览与 Canvas 导出都基于它渲染，
 * 从根上保证两者版式一致。由 variant 决定，不依赖各预设里零散的 titleBlock/titleUnderline。
 */
export interface VariantDecoration {
  /** 卡片顶部是否有一条强调色细装饰条 */
  headerBar: boolean;
  /** 顶部装饰条颜色（默认 deco） */
  headerBarColor?: string;
  /** 标题装饰：underline 粗线 / block 色块 / offset 错位色块 / none */
  titleDeco: 'underline' | 'block' | 'offset' | 'none';
  /** block 色块是否圆角（bujo 荧光笔感） */
  blockRounded?: boolean;
  /** 标题与正文之间是否加一条细分隔线 */
  bodyDivider: boolean;
  /** 要点前缀符号 */
  bulletMark: string;
  /** 要点文字颜色来源 */
  bulletColor: 'accent' | 'body' | 'deco';
  /** 整卡边框（CSS 字符串，深色风用 inset 内描边） */
  cardBorder?: string;
  /** 信息区内边距（px，移动端舒适值） */
  infoPad: number;
  /** 标题与正文的间距（px） */
  titleGap: number;
}

export function getVariantDecoration(variant: TextVariant): VariantDecoration {
  switch (variant) {
    case 'magazine':
      return {
        headerBar: true,
        titleDeco: 'underline',
        bodyDivider: false,
        bulletMark: '▪ ',
        bulletColor: 'accent',
        cardBorder: '1px solid #e8e8e8',
        infoPad: 16,
        titleGap: 10,
      };
    case 'bujo':
      return {
        headerBar: false,
        titleDeco: 'block',
        blockRounded: true,
        bodyDivider: false,
        bulletMark: '● ',
        bulletColor: 'accent',
        cardBorder: '1px solid #e8e8e8',
        infoPad: 16,
        titleGap: 10,
      };
    case 'chalk':
      return {
        headerBar: false,
        titleDeco: 'underline',
        bodyDivider: false,
        bulletMark: '✦ ',
        bulletColor: 'deco',
        cardBorder: 'inset 0 0 0 3px rgba(255,255,255,0.14)',
        infoPad: 16,
        titleGap: 10,
      };
    case 'riso':
      return {
        headerBar: true,
        titleDeco: 'offset',
        bodyDivider: false,
        bulletMark: '■ ',
        bulletColor: 'accent',
        cardBorder: '2px solid #1a1a1a',
        infoPad: 16,
        titleGap: 12,
      };
    case 'data':
      return {
        headerBar: false,
        titleDeco: 'block',
        blockRounded: false,
        bodyDivider: false,
        bulletMark: '· ',
        bulletColor: 'body',
        cardBorder: '1px solid #eee',
        infoPad: 16,
        titleGap: 8,
      };
    case 'minimal':
    default:
      return {
        headerBar: false,
        titleDeco: 'none',
        bodyDivider: true,
        bulletMark: '— ',
        bulletColor: 'body',
        cardBorder: '1px solid #eee',
        infoPad: 18,
        titleGap: 10,
      };
  }
}
