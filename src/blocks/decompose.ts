/**
 * blocks/decompose.ts — 知识拆解服务（LLM）
 *
 * 把主题或原始文本，拆成「知识点级」最小模块（搭积木的原子）。
 * 每个模块只讲一个清晰知识点；整套共享一个 seriesStyle（视觉统一）。
 * 每个模块的 visualHint 描述该模块图的配图主体——由 AI 生成完整模块图时使用。
 */
import type { DecomposeResult, DecomposedModule, CardPage, Layout, ModuleStyle, ModuleType, Ratio } from './types';
import { getPreset, TYPE_DEFAULT_RATIO, DEFAULT_LAYOUT } from './styleEngine';
import { getSettings } from './settings';
import { gatewayFetch } from './gateway';
import { trimTitle } from './textUtil';

export interface DecomposeOptions {
  /** UI 选定的风格预设 id，作为系列风格建议传给 LLM */
  stylePresetId?: string;
  mock?: boolean;
}

export async function decomposeKnowledge(
  input: string,
  opts: DecomposeOptions = {},
): Promise<DecomposeResult> {
  const useMock = opts.mock ?? getSettings().mock;
  if (useMock) {
    return mockDecompose(input);
  }

  const preset = getPreset(opts.stylePresetId ?? 'flat');
  const system = buildSystemPrompt(preset.style);
  const user = `主题或文本：\n${input}`;

  try {
    const resp = await gatewayFetch('/ai-api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getSettings().text.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: getSettings().text.temperature,
        // 输出上限：不设则模型默认上限偏小，JSON 常生成到一半被掐断导致 parse 失败
        max_tokens: 8000,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`知识拆解失败: ${resp.status} ${txt.slice(0, 160)}`);
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseDecompose(text, preset.style);
    if (parsed && parsed.modules.length) return parsed;
    throw new Error('模型输出无法解析为有效模块结构，请重试或更换模型');
  } catch (err) {
    // 此前任何失败都静默降级 mock：用户以为拿到的是 AI 拆解，实际是模板——
    // 与「URL 提取内容凭空编造」同根因。现在显式抛错，由调用方 toast 给用户；
    // mock 只在设置里显式开启 Mock 模式（opts.mock / settings.mock）时才会走到。
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg.startsWith('知识拆解失败') ? msg : `知识拆解失败：${msg}`);
  }
}

function buildSystemPrompt(style: ModuleStyle): string {
  return `你是一个知识拆解与排版专家。把用户给定的主题或文本，拆解成一系列「最小知识点模块」，然后把相关模块分组到「页面」上——每页是一张信息密度高的手抄报式知识图，可能包含多个知识模块。

规则：

【模块拆解】
- 模块数量：根据内容 8~18 个，覆盖全面但不重复。
- 每个模块：title（短标题 ≤20 字）、body（正文 ≤80 字，清晰说明核心知识）、bullets（可选，2~5 条，每条 ≤30 字）。
- type 从以下选：cover(封面大标题) / definition(定义) / fact(事实) / step(步骤) / compare(对比) / timeline(时间线) / stat(数据) / quote(金句) / tip(贴士) / section(分节)。
- 第一个模块必须是 type=cover（系列大标题）。
- icon 用单个 emoji（可选）。
- visualHint（必填）：描述该模块在画面中的配图主体或场景。使用具体、可识别的真实视觉元素，不要抽象象征或隐喻。

【页面分组——核心】
- 把模块分组为 2~6 张「页面」，每页包含 2~5 个相关模块，组成一张信息密度高的手抄报式知识图。
- 分组原则：内容相关的模块放同一页（例如「定义+原理」一页，「原因+对比」一页，「步骤+总结」一页）。
- 每页的 visualHint 描述整体画面布局：大标题位置、各模块用不同颜色的圆角文本框区分、箭头或流程线串联、信息密度高、布局饱满整齐。
- visualHint 必须把内容分配到画面的顶部、中部、底部，让整张画布被信息铺满；严禁出现「留白」「空白」「空出」「轻微纹理填充」等会让画面局部没有内容的描述。
- 每页 ratio 建议：封面页用 3:4，内容页用 3:4 或 9:16（竖版适合手机阅读）。
- 页面数量根据信息量自动决定：信息少 2 页，信息多 5~6 页。

【系列风格——必须严格遵守】
用户已选定一个整体视觉风格预设，整个系列（seriesStyle、每一页画面、每个模块配图）都必须统一采用该风格。请把以下各项原样填入输出 JSON 的 seriesStyle 对应字段，不要自行更改、扩展或替换为类似风格：
- artStyle：${style.artStyle}
- palette：${style.palette}
- mood：${style.mood}
- typography：${style.typography}
- lighting：${style.lighting}
- camera：${style.camera}
- material：${style.material}

只返回如下 JSON（不要任何解释、不要 markdown 代码块、不要反引号）：
{
  "seriesTitle": "系列名",
  "seriesStyle": {"artStyle":"...","palette":"...","mood":"...","typography":"..."},
  "modules": [
    {"id":"m1","type":"cover","title":"...","body":"...","bullets":[],"icon":"📘","visualHint":"...","ratio":"3:4"},
    {"id":"m2","type":"definition","title":"...","body":"...","bullets":[],"icon":"💡","visualHint":"...","ratio":"4:3"}
  ],
  "pages": [
    {"id":"p1","title":"封面与定义","moduleIds":["m1","m2"],"ratio":"3:4","visualHint":"大标题居上方，下方分两个彩色圆角文本框，左侧定义模块蓝色框，右侧补充说明绿色框，整体竖版布局"},
    {"id":"p2","title":"原理与对比","moduleIds":["m3","m4","m5"],"ratio":"3:4","visualHint":"上半部分流程图模块用箭头串联，下半部分对比表格双栏布局，各模块用不同颜色圆角框区分"}
  ]
}`;
}

/**
 * 修复 LLM 输出 JSON 的常见语法瑕疵：字符串字面量内的裸换行/硬回车/Tab 未转义，
 * 标准 JSON.parse 会直接抛错（agnes-3.0-flash 等代模型常犯）。用状态机只在字符串值内部
 * 把这些控制字符转义成合法序列，避免误伤字符串外的结构。无法无损修复时返回 null。
 */
function repairJsonControlChars(raw: string): string | null {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { out += ch; esc = false; continue; }
    if (inStr) {
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { out += ch; inStr = false; continue; }
      if (ch === '\n' || ch === '\r' || ch === '\t') {
        // 字符串内的裸控制字符：转义。\r\n 一起出现时只输出一个 \n 避免引入 \r
        out += ch === '\r' && raw[i + 1] === '\n' ? '' : '\\n';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') { out += ch; inStr = true; continue; }
    out += ch;
  }
  return inStr ? null : out;
}

function parseDecompose(text: string, fallbackStyle: ModuleStyle): DecomposeResult | null {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let p: any;
  try {
    try {
      p = JSON.parse(m[0]);
    } catch {
      // 首次解析失败：尝试修复字符串内的裸控制字符后重试（LLM 输出常见）
      const repaired = repairJsonControlChars(m[0]);
      if (repaired != null) {
        try { p = JSON.parse(repaired); }
        catch { throw new Error('unrepairable'); }
      } else {
        throw new Error('unrepairable');
      }
    }
  } catch {
    return null;
  }
  const rawModules = Array.isArray(p.modules) ? p.modules : [];
  const modules: DecomposedModule[] = rawModules
      .filter((x: any) => x && x.title)
      .map((x: any, i: number) => {
        const type = (isValidType(x.type) ? x.type : 'fact') as ModuleType;
        return {
          id: typeof x.id === 'string' && x.id ? x.id : `m${i + 1}`,
          type,
          title: trimTitle(x.title, '', 40),
        body: String(x.body ?? '').slice(0, 200),
        bullets: Array.isArray(x.bullets)
          ? x.bullets.map((b: any) => String(b).slice(0, 50)).slice(0, 5)
          : undefined,
          icon: x.icon ? String(x.icon).slice(0, 4) : undefined,
          visualHint: x.visualHint ? String(x.visualHint).slice(0, 120) : undefined,
          ratio: (isValidRatio(x.ratio) ? x.ratio : TYPE_DEFAULT_RATIO[type]) as Ratio,
          layout: DEFAULT_LAYOUT[type],
        } as DecomposedModule;
      });
    if (!modules.length) return null;
    const seriesStyle: ModuleStyle = p.seriesStyle
      ? {
          artStyle: String(p.seriesStyle.artStyle ?? fallbackStyle.artStyle),
          palette: String(p.seriesStyle.palette ?? fallbackStyle.palette),
          mood: String(p.seriesStyle.mood ?? fallbackStyle.mood),
          typography: String(p.seriesStyle.typography ?? fallbackStyle.typography),
          lighting: p.seriesStyle.lighting ? String(p.seriesStyle.lighting) : fallbackStyle.lighting,
          camera: p.seriesStyle.camera ? String(p.seriesStyle.camera) : fallbackStyle.camera,
          material: p.seriesStyle.material ? String(p.seriesStyle.material) : fallbackStyle.material,
        }
      : fallbackStyle;
    const seriesTitle = trimTitle(p.seriesTitle, '知识图解');
    const pages = parsePages(p.pages, modules);
    return { seriesTitle, seriesStyle, modules, pages };
}

function parsePages(raw: unknown, modules: DecomposedModule[]): CardPage[] {
  if (!Array.isArray(raw) || !raw.length) return autoPages(modules);
  return raw
    .filter((x: any) => x && Array.isArray(x.moduleIds) && x.moduleIds.length)
    .map((x: any, i: number) => ({
      id: typeof x.id === 'string' && x.id ? x.id : `p${i + 1}`,
      title: trimTitle(x.title),
      moduleIds: x.moduleIds.map((id: any) => String(id)),
      ratio: (isValidRatio(x.ratio) ? x.ratio : '3:4') as Ratio,
      visualHint: x.visualHint ? String(x.visualHint).slice(0, 200) : undefined,
    }));
}

function autoPages(modules: DecomposedModule[]): CardPage[] {
  if (!modules.length) return [];
  const pages: CardPage[] = [];
  const pageSize = 3;
  for (let i = 0; i < modules.length; i += pageSize) {
    const chunk = modules.slice(i, i + pageSize);
    pages.push({
      id: `p${pages.length + 1}`,
      title: chunk[0].title,
      moduleIds: chunk.map((m) => m.id),
      ratio: '3:4',
      visualHint: undefined,
    });
  }
  return pages;
}

function isValidType(t: unknown): boolean {
  return typeof t === 'string' && ['cover', 'definition', 'fact', 'step', 'compare', 'timeline', 'stat', 'quote', 'tip', 'section'].includes(t);
}
function isValidRatio(r: unknown): boolean {
  return typeof r === 'string' && ['1:1', '3:4', '4:3', '9:16', '16:9', '2:3', '3:2'].includes(r);
}

/** Mock 拆解：仅在显式开启 Mock 模式时使用（不再是 LLM 失败的静默兜底） */
function mockDecompose(input: string, style?: ModuleStyle): DecomposeResult {
  const text = (input || '').trim();
  const isLong = text.length > 60;
  const theme = isLong ? trimTitle(text, '知识图解', 24) : text || '知识图解';
  const sentences = isLong
    ? text
        .split(/[。！？\n；;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 4)
        .slice(0, 14)
    : [];

  const modules: DecomposedModule[] = [];
  const add = (m: Omit<DecomposedModule, 'layout'>) => {
    modules.push({ ...m, layout: DEFAULT_LAYOUT[m.type] });
  };

  add({
    id: 'm1',
    type: 'cover',
    title: isLong ? trimTitle(text, '知识图解', 20) : text || '知识图解',
    body: isLong ? '核心要点一览' : '一键拆解知识点',
    bullets: [],
    icon: '📘',
    visualHint: `与"${theme}"相关的完整主体场景，居中、清晰、可识别`,
    ratio: '3:4',
  });

  if (isLong) {
    sentences.forEach((s, i) => {
      add({
        id: `m${i + 2}`,
        type: i % 5 === 4 ? 'tip' : 'fact',
        title: trimTitle(s, '要点', 16),
        body: s.slice(0, 40), // allow-truncation: mock 正文限长占位，非标题
        bullets: [],
        icon: i % 5 === 4 ? '💡' : '🔍',
        visualHint: `与"${s.slice(0, 12)}"直接相关的单一主体插画，干净背景，只有这个主体`,
        ratio: '1:1',
      });
    });
    add({
      id: `m${modules.length + 1}`,
      type: 'quote',
      title: '小结',
      body: '理解本质，胜过死记硬背。',
      bullets: [],
      icon: '✨',
      visualHint: `与"${theme}"氛围相关的抽象主体图形`,
      ratio: '3:4',
    });
  } else {
    const elseModules: Array<Omit<DecomposedModule, 'layout'>> = [
      { id: 'm2', type: 'definition', title: '是什么', body: `${text || '主题'}的核心定义，一句话说清。`, bullets: [], icon: '💡', visualHint: `与"${text || '主题'}"概念相关的抽象主体图形`, ratio: '4:3' },
      { id: 'm3', type: 'fact', title: '要点一', body: '第一个关键知识点，简明扼要。', bullets: ['细节 A', '细节 B'], icon: '🔍', visualHint: `与要点一相关的单一主体插画，干净背景`, ratio: '1:1' },
      { id: 'm4', type: 'fact', title: '要点二', body: '第二个关键知识点，配示例。', bullets: ['细节 C'], icon: '🔍', visualHint: `与要点二相关的单一主体插画，干净背景`, ratio: '1:1' },
      { id: 'm5', type: 'step', title: '怎么做', body: '操作步骤，循序渐进。', bullets: ['先…', '再…', '后…'], icon: '🧭', visualHint: `步骤流程的单一示意图标，居中清晰`, ratio: '9:16' },
      { id: 'm6', type: 'stat', title: '关键数据', body: '用数字说话。', bullets: [], icon: '📊', visualHint: `数据可视化主体（图表/数字），干净背景`, ratio: '3:4' },
      { id: 'm7', type: 'quote', title: '金句', body: '一句有记忆点的总结。', bullets: [], icon: '✨', visualHint: `与"${theme}"氛围相关的抽象主体图形`, ratio: '3:4' },
      { id: 'm8', type: 'tip', title: '贴士', body: '一个实用提醒。', bullets: [], icon: '💡', visualHint: `提示相关的单一小插画（如灯泡）`, ratio: '1:1' },
    ];
    elseModules.forEach(add);
  }

  const seriesStyle: ModuleStyle =
    style ?? {
      artStyle: '扁平矢量插画',
      palette: '明亮多彩、低饱和',
      mood: '轻松现代',
      typography: '粗体无衬线、高对比',
      lighting: '均匀漫射光、柔和无硬阴影',
      camera: '平视正面、居中构图',
      material: '干净矢量色块、平滑边缘、无纹理',
    };

  return {
    seriesTitle: theme,
    seriesStyle,
    modules,
    pages: autoPages(modules),
  };
}
