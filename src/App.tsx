/**
 * App.tsx — 知识卡片 · 提示词工坊
 *
 * 设计方向：Soft Glass（柔软玻璃感）
 * - 天蓝→靛蓝渐变主色，深灰蓝背景
 * - 半透明玻璃卡片 + backdrop-filter 模糊
 * - 12-16px 大圆角，柔和阴影
 * - DM Sans 字体，现代工具感
 *
 * 两步流程：
 * ① 输入主题 / 文本 + 风格预设 → AI 拆解知识模块并自动分组为页面
 * ② 每页展示一条手抄报式生图提示词（多模块融合），支持复制 / 导出
 *
 * 新增：内容质量自检（规则快检 + LLM 交叉自检）
 * 新增：暗黑 / 亮色主题切换（CSS 变量驱动）
 * 新增：图片页码编号开关
 * 新增：间隔重复学习系统（SM-2 算法）
 * 新增：多格式输入（PDF/Markdown/网页）
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardPage, DecomposedModule, DecomposeResult, KnowledgeModule, ModuleStyle } from './blocks/types';
import { STYLE_PRESETS, getPreset, buildPagePrompt, buildAnchorPrompt, REFERENCE_WORKFLOW, recommendStyle } from './blocks/styleEngine';
import type { PageBadgePos, PageBadgeFormat } from './blocks/styleEngine';
import { decomposeKnowledge } from './blocks/decompose';
import { checkQuality, type QualityReport, type QualityIssue } from './blocks/qualityCheck';
import { diffTokens } from './blocks/textDiff';
import { selfCheckContent, type SelfCheckResult, type SelfCheckIssue } from './blocks/selfCheck';
import { extractFromURL } from './blocks/contentExtractor';
import { expandForLearn } from './blocks/expandForLearn';
import type { LearnModule } from './blocks/types';
import StudyView from './StudyView';
import QuizView from './QuizView';
import LearnBrowseView from './LearnBrowseView';
import BatchExportView from './BatchExportView';
import type { SM2Card } from './blocks/spacedRepetition';
import { getDueCards, mergeGeneratedCards } from './blocks/spacedRepetition';

import CardGallery from './CardGallery';
import ConceptGraph from './ConceptGraph';
import AdminView from './AdminView';
// pdfjs 主体懒加载（见 extractPDF），worker 是独立静态资源、不增加主 bundle
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import StepErrorBoundary from './StepErrorBoundary';
import { getSettings, loadRuntimeSettings, saveRuntimeSettings, subscribe } from './blocks/settings';
import { getImageProvider } from './blocks/imageProvider';

type Step = 'input' | 'prompts' | 'study' | 'quiz' | 'export' | 'admin' | 'learn';
type Theme = 'dark' | 'light';
type InputType = 'text' | 'file' | 'url';

/**
 * 步骤条顺序。步骤之间不做线性锁定：任意一步可直接跳转（复习、测验、导出
 * 不要求先"完成"前面的步骤），空数据由各自的视图空态或 EmptyStage 兜底。
 */
const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'input', label: '输入' },
  { id: 'prompts', label: '提示词' },
  { id: 'study', label: '复习' },
  { id: 'quiz', label: '测验' },
  { id: 'export', label: '导出' },
];

// B 模型改进建议的单条改写项（类型从 SelfCheckResult.improvedModules 推导）
type ImprovedMod = NonNullable<SelfCheckResult['improvedModules']>[number];
// 改进建议的 UI 消费结构：建议内容 + 是否已采纳 + 采纳前原文（用于对比与撤销展示）
interface ImprovementEntry {
  imp: ImprovedMod;
  adopted: boolean;
  before?: DecomposedModule;
}

/** 对比展示只需要内容三字段（不依赖运行时装饰字段） */
type ContentLike = Pick<DecomposedModule, 'title' | 'body' | 'bullets'>;

/** 把 B 模型建议字段并入现有模块，得到“采纳后”版本（未提供的字段保留原文） */
function buildAfter(current: DecomposedModule, imp: ImprovedMod): DecomposedModule {
  return {
    ...current,
    title: imp.title?.trim() || current.title,
    body: imp.body?.trim() || current.body,
    bullets: imp.bullets?.length ? imp.bullets : current.bullets,
  };
}

interface PageData {
  page: CardPage;
  modules: KnowledgeModule[];
  prompt: string;
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getInitialCards(): SM2Card[] {
  try {
    const saved = localStorage.getItem('study-cards');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load study cards:', e);
  }
  return [];
}

export default function App() {
  const [step, setStep] = useState<Step>('input');
  const [input, setInput] = useState('');
  // 默认视觉风格来自后台设置（'auto' = 跟随 AI 推荐），不再硬编码 flat
  const [stylePresetId, setStylePresetId] = useState(getSettings().ui.stylePresetId);
  const [settingsTick, setSettingsTick] = useState(0);
  const cfg = getSettings();
  const useMock = cfg.mock;
  /** 应用标识（后台设置可改）：导航栏标题、副标题、浏览器标签页 */
  const appName = cfg.app.name;
  const appSubtitle = cfg.app.subtitle;
  const [pages, setPages] = useState<PageData[]>([]);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesStyle, setSeriesStyle] = useState<ModuleStyle | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  // 生成失败时的持久红色错误条（toast 2 秒就消失，单靠它用户看不清失败原因）
  const [genError, setGenError] = useState('');
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // 间隔重复学习状态
  const [studyCards, setStudyCards] = useState<SM2Card[]>(getInitialCards);
  const [inputType, setInputType] = useState<InputType>('text');
  // 上传文件后的持久反馈（避开仅弹 toast 造成的「看着没加载」歧义）
  const [loadedFile, setLoadedFile] = useState<{ name: string; chars: number; truncated: boolean; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevStepRef = useRef<Step>('input');
  // 复习范围：undefined = 全局到期队列；字符串 = 只复习该系列（组内入口）
  const [studyScope, setStudyScope] = useState<string | undefined>(undefined);
  // 闪卡 id 的生成批次前缀：模块 id 是 m1/m2… 序号，跨系列必然重复，
  // 不加批次前缀会导致第二次生成的卡与第一次撞 id（历史 bug：整组被去重丢弃）
  const [genTag, setGenTag] = useState(() => `g${Date.now().toString(36)}`);
  const cardIdOf = useCallback((moduleId: string) => `card-${genTag}-${moduleId}`, [genTag]);
  const dueCount = useMemo(() => getDueCards(studyCards).length, [studyCards]);
  // 图卡联动：图文卡落库后给对应闪卡打「有图」标记（stable 引用，供 CardGallery 回调）
  const markCardImage = useCallback((cardId: string) => {
    setStudyCards((prev) => {
      const target = prev.find((c) => c.id === cardId);
      if (!target || target.hasImage) return prev;
      return prev.map((c) => (c.id === cardId ? { ...c, hasImage: true } : c));
    });
  }, []);

  // 持久化学习卡片
  useEffect(() => {
    localStorage.setItem('study-cards', JSON.stringify(studyCards));
  }, [studyCards]);

  // 启动时拉取后台配置（server/local 模式自动判定）；配置变更时刷新 UI
  useEffect(() => {
    loadRuntimeSettings().then(() => setSettingsTick(t => t + 1));
    return subscribe(() => setSettingsTick(t => t + 1));
  }, []);

  const [rawResult, setRawResult] = useState<DecomposeResult | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [selfCheckResult, setSelfCheckResult] = useState<SelfCheckResult | null>(null);
  const [selfCheckBusy, setSelfCheckBusy] = useState(false);
  const [showIssues, setShowIssues] = useState(true);
  // 学习页：扩写后的完整学习内容 + 扩写状态
  const [learnData, setLearnData] = useState<Map<string, LearnModule> | null>(null);
  const [learnBusy, setLearnBusy] = useState(false);
  // 页码角标：初值取后台设置的默认输出选项
  const [showPageNumber, setShowPageNumber] = useState(getSettings().ui.pageNumber);
  const [pageBadgePos, setPageBadgePos] = useState<PageBadgePos>(getSettings().ui.pagePos);
  const [pageBadgeFormat, setPageBadgeFormat] = useState<PageBadgeFormat>(getSettings().ui.pageFormat);
  const [showGraph, setShowGraph] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  // 风格锚点图：App 内直接用当前生图服务商生成（无需外部手动出图）
  const [anchorImg, setAnchorImg] = useState<string | null>(null);
  const [anchorBusy, setAnchorBusy] = useState(false);

  // B 模型改进建议的采纳状态（可撤销）
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Array<{ id: string; before: DecomposedModule }>>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 浏览器标签页标题跟随设置中的应用名称（index.html 里的静态 title 只是首屏兜底）
  useEffect(() => {
    document.title = appSubtitle ? `${appName} · ${appSubtitle}` : appName;
  }, [appName, appSubtitle]);

  // 切换步骤时回到顶部：否则从长页面底部跳转后，新步骤顶部的「← 返回」按钮会被滚出视口，
  // 用户看不到返回入口、误以为"回不去"，只能手动刷新（历史 bug）
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // 防御：提示词/学习页依赖本次生成结果，若处于无结果的中间态（整块空白、页面上没有返回入口），
  // 自动退回输入页，避免把用户困死在当前步骤
  useEffect(() => {
    const stranded = (step === 'learn' && (!seriesStyle || pages.length === 0))
      || (step === 'prompts' && pages.length === 0);
    if (stranded) setStep('input');
  }, [step, seriesStyle, pages.length]);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2000);
  }, []);

  /** 步骤跳转：记住来处，返回按钮就能回到用户真正来的那一步（步骤不再线性锁定） */
  const gotoStep = (next: Step) => {
    if (next === step) return;
    prevStepRef.current = step;
    setStep(next);
  };

  /** 返回来处；来处就是当前步（首次进入或直接跳转）时：有生成结果回提示词页，没有则回输入页 */
  const backStep = () => {
    const target: Step = prevStepRef.current === step
      ? (pages.length > 0 ? 'prompts' : 'input')
      : prevStepRef.current;
    setStep(target);
  };

  // 学习页是复习的延伸阅读，步骤条上归入「复习」一格
  const navStep: Step = step === 'learn' ? 'study' : step;
  const stepIndex = STEPS.findIndex((s) => s.id === navStep);

  const rec = useMemo(() => (input.trim().length >= 3 ? recommendStyle(input) : null), [input]);
  // 'auto' = 跟随 AI 推荐：解析成模型推荐的预设（无推荐时回退首个预设），
  // 必须在使用 getPreset 之前完成——getPreset 对未知 id 会静默回退成 flat
  const effectivePresetId = stylePresetId === 'auto' ? (rec?.presetId ?? STYLE_PRESETS[0].id) : stylePresetId;
  const userOverride = stylePresetId !== 'auto' && rec !== null && stylePresetId !== rec.presetId;

  const moduleMap = useMemo(() => {
    const m = new Map<string, KnowledgeModule>();
    pages.forEach((pg) => pg.modules.forEach((mod) => m.set(mod.id, mod)));
    return m;
  }, [pages]);

  // 学习页：把扩写结果（fullBody/fullBullets/notes）合并进模块
  const mergedLearnModules = useMemo(() => {
    if (!learnData) return pages.flatMap((pg) => pg.modules);
    return pages.flatMap((pg) => pg.modules).map((m) => {
      const lr = learnData.get(m.id);
      if (!lr) return m;
      return { ...m, fullBody: lr.fullBody, fullBullets: lr.fullBullets, notes: lr.notes };
    });
  }, [pages, learnData]);

  const improvementInfo = useMemo(() => {
    const m = new Map<string, ImprovementEntry>();
    selfCheckResult?.improvedModules?.forEach((imp) => {
      let before: DecomposedModule | undefined;
      for (let i = undoStack.length - 1; i >= 0; i--) {
        if (undoStack[i].id === imp.id) { before = undoStack[i].before; break; }
      }
      m.set(imp.id, { imp, adopted: adoptedIds.has(imp.id), before });
    });
    return m;
  }, [selfCheckResult, adoptedIds, undoStack]);

  /** 页码开关/位置/格式任一变化时，重建所有页面的提示词 */
  const applyBadge = useCallback((next: { on: boolean; pos: PageBadgePos; fmt: PageBadgeFormat }) => {
    setShowPageNumber(next.on);
    setPageBadgePos(next.pos);
    setPageBadgeFormat(next.fmt);
    if (pages.length === 0 || !seriesStyle) return;
    const updated = pages.map((pg, i) => ({
      ...pg,
      prompt: buildPagePrompt(pg.page, pg.modules, seriesStyle, {
        seriesTitle,
        pageNumber: next.on ? i + 1 : undefined,
        totalPages: next.on ? pages.length : undefined,
        pagePos: next.pos,
        pageFormat: next.fmt,
      }),
    }));
    setPages(updated);
  }, [pages, seriesStyle, seriesTitle]);

  // 后台设置里的默认风格/输出选项变化时同步到当前会话。
  // 用 uiRef 比对"上次同步过的值"：只改模型等无关项时不会覆盖用户在输入步骤里的手动选择。
  const uiRef = useRef(getSettings().ui);
  useEffect(() => {
    const ui = getSettings().ui;
    const prev = uiRef.current;
    const styleChanged = ui.stylePresetId !== prev.stylePresetId;
    const badgeChanged = ui.pageNumber !== prev.pageNumber
      || ui.pagePos !== prev.pagePos
      || ui.pageFormat !== prev.pageFormat;
    if (!styleChanged && !badgeChanged) return;
    uiRef.current = ui;
    if (styleChanged) setStylePresetId(ui.stylePresetId);
    if (badgeChanged) applyBadge({ on: ui.pageNumber, pos: ui.pagePos, fmt: ui.pageFormat });
  }, [settingsTick, applyBadge]);

  const handleDecompose = async (content: string) => {
    if (!content.trim()) {
      showToast('请先输入或上传内容');
      return;
    }
    setGenError('');
    setBusy(true);
    setSelfCheckResult(null);
    setAdoptedIds(new Set());
    setUndoStack([]);
    try {
      const res = await decomposeKnowledge(content, { stylePresetId: effectivePresetId, mock: getSettings().mock });
      setRawResult(res);
      const qr = checkQuality(res);
      setQualityReport(qr);

      const style = res.seriesStyle;
      const moduleMap = new Map<string, KnowledgeModule>();
      res.modules.forEach((m, i) => {
        moduleMap.set(m.id, { ...m, status: 'done', order: i, enabled: true, span: 'half' });
      });
      const pageList: PageData[] = res.pages.map((pg, i) => {
        const mods = pg.moduleIds
          .map((id) => moduleMap.get(id))
          .filter((m): m is KnowledgeModule => !!m);
        return {
          page: pg,
          modules: mods,
          prompt: buildPagePrompt(pg, mods, style, {
            seriesTitle: res.seriesTitle,
            pageNumber: showPageNumber ? i + 1 : undefined,
            totalPages: showPageNumber ? res.pages.length : undefined,
            pagePos: showPageNumber ? pageBadgePos : undefined,
            pageFormat: showPageNumber ? pageBadgeFormat : undefined,
          }),
        };
      });
      setPages(pageList);
      setSeriesTitle(res.seriesTitle);
      setSeriesStyle(style);

      // 生成闪卡并保存：id 带本次批次前缀，避免跨系列撞 id；
      // 合并语义 = 同名系列整组替换、不同系列共存（mergeGeneratedCards）
      const tag = `g${Date.now().toString(36)}`;
      setGenTag(tag);
      const newCards: SM2Card[] = res.modules.map((m) => ({
        id: `card-${tag}-${m.id}`,
        question: m.title,
        answer: m.body,
        nextReview: new Date().toISOString(),
        easeFactor: getSettings().study.initialEase,
        interval: 0,
        repetitions: 0,
        createdAt: new Date().toISOString(),
        status: 'new',
        source: res.seriesTitle,
      }));
      setStudyCards((prev) => mergeGeneratedCards(prev, newCards));

      setStep('prompts');
      showToast(`生成 ${pageList.length} 页 · 质检发现 ${qr.issues.length} 个问题 · 本组闪卡 ${newCards.length} 张`);

      // 后台自动扩写学习内容（不阻塞主流程；失败时学习页按骨架显示并 toast 提示）
      runExpandLearn(res.modules, res.seriesStyle);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败';
      setGenError(msg); // 持久展示，用户能看清到底哪儿失败了
      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

  /** 后台扩写学习内容：进入学习页可浏览完整内容；若进行中则用骨架兜底 */
  const runExpandLearn = useCallback(async (
    modules: DecomposedModule[],
    style: ModuleStyle,
  ) => {
    setLearnBusy(true);
    try {
      const map = await expandForLearn(modules, style, { mock: getSettings().mock });
      setLearnData(map);
    } catch (e) {
      // 扩写失败：学习页按骨架显示（不再伪造"已扩写"内容），并提示用户
      showToast(e instanceof Error ? e.message : '学习内容扩写失败，将显示精简版');
    } finally {
      setLearnBusy(false);
    }
  }, []);

  const handleSelfCheck = async () => {
    if (!rawResult) return;
    setSelfCheckBusy(true);
    try {
      const result = await selfCheckContent(rawResult, { mock: getSettings().mock });
      setSelfCheckResult(result);
      // 新一轮质检：上一轮采纳已固化进内容，采纳/撤销状态清零，避免新建议被旧状态误标
      setAdoptedIds(new Set());
      setUndoStack([]);
      const n = result.issues.length;
      showToast(n > 0 ? `AI 质检发现 ${n} 个问题` : 'AI 质检通过，未发现明显问题');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '质检失败');
    } finally {
      setSelfCheckBusy(false);
    }
  };

  const copyOne = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    showToast('已复制到剪贴板');
  };

  /** 用新模块列表整体提交：更新 rawResult、重跑规则快检、重建页面 prompt、同步闪卡 */
  const commitModules = (newModules: DecomposedModule[], adds: Array<{ id: string; before: DecomposedModule }>) => {
    if (!rawResult || !seriesStyle) return;
    const newRaw = { ...rawResult, modules: newModules };
    setRawResult(newRaw);
    setQualityReport(checkQuality(newRaw));
    setUndoStack((s) => [...s, ...adds]);
    setAdoptedIds((prev) => {
      const n = new Set(prev);
      adds.forEach((a) => n.add(a.id));
      return n;
    });
    // 同步学习闪卡的问答（SM2 复习参数不动）
    const changed = new Map<string, { question: string; answer: string }>(adds.map((a) => {
      const after = newModules.find((m) => m.id === a.id)!;
      return [cardIdOf(a.id), { question: after.title, answer: after.body }] as const;
    }));
    setStudyCards((prev) => prev.map((c) => (changed.has(c.id) ? { ...c, ...changed.get(c.id)! } : c)));
    // 重建各页 prompt（模块内容变了，提示词必须跟着变；装饰字段从现有 pages 保留）
    const decoMap = new Map<string, KnowledgeModule>();
    pages.forEach((pg) => pg.modules.forEach((m) => decoMap.set(m.id, m)));
    const enriched: KnowledgeModule[] = newModules.flatMap((m) => {
      const cur = decoMap.get(m.id);
      return cur ? [{ ...cur, ...m }] : [];
    });
    const pageList: PageData[] = newRaw.pages.map((pg, i) => {
      const mods = pg.moduleIds
        .map((id) => enriched.find((m) => m.id === id))
        .filter((m): m is KnowledgeModule => !!m);
      return {
        page: pg,
        modules: mods,
        prompt: buildPagePrompt(pg, mods, seriesStyle, {
          seriesTitle,
          pageNumber: showPageNumber ? i + 1 : undefined,
          totalPages: showPageNumber ? newRaw.pages.length : undefined,
          pagePos: showPageNumber ? pageBadgePos : undefined,
          pageFormat: showPageNumber ? pageBadgeFormat : undefined,
        }),
      };
    });
    setPages(pageList);
  };

  /** 采纳单条 B 模型修改 */
  const applyImprovement = (imp: ImprovedMod) => {
    if (!rawResult) return;
    const before = rawResult.modules.find((m) => m.id === imp.id);
    if (!before) {
      showToast('未找到对应模块，无法采纳');
      return;
    }
    const after = buildAfter(before, imp);
    commitModules(rawResult.modules.map((m) => (m.id === imp.id ? after : m)), [{ id: imp.id, before }]);
    showToast('已采纳 B 模型修改 · 规则快检已更新');
  };

  /** 批量采纳全部未处理的修改建议 */
  const applyAllImprovements = (list: ImprovedMod[]) => {
    if (!rawResult) return;
    let modules = rawResult.modules;
    const adds: Array<{ id: string; before: DecomposedModule }> = [];
    list.forEach((imp) => {
      const before = modules.find((m) => m.id === imp.id);
      if (!before) return;
      const after = buildAfter(before, imp);
      adds.push({ id: imp.id, before });
      modules = modules.map((m) => (m.id === imp.id ? after : m));
    });
    if (!adds.length) return;
    commitModules(modules, adds);
    showToast(`已采纳 ${adds.length} 条修改 · 可撤销`);
  };

  /** 撤销某个模块的采纳，恢复它最近一次被改前的原文 */
  const undoAdopt = (id: string) => {
    if (!rawResult) return;
    let idx = -1;
    for (let i = undoStack.length - 1; i >= 0; i--) {
      if (undoStack[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;
    const rec = undoStack[idx];
    const newStack = undoStack.filter((_, i) => i !== idx);
    setUndoStack(newStack);
    setAdoptedIds((prev) => {
      const n = new Set(prev);
      if (!newStack.some((r) => r.id === id)) n.delete(id);
      return n;
    });
    const newModules = rawResult.modules.map((m) => (m.id === id ? rec.before : m));
    commitModules(newModules, []);
    setStudyCards((prev) => prev.map((c) => (c.id === cardIdOf(id) ? { ...c, question: rec.before.title, answer: rec.before.body } : c)));
    showToast('已撤销，恢复原文');
  };

  const stylePreset = getPreset(effectivePresetId);

  // 概念图谱数据：全部模块 + 当前选中模块（图谱按钮开关 showGraph）
  const allModules = useMemo(() => pages.flatMap((pg) => pg.modules), [pages]);
  const selectedModule = useMemo(
    () => allModules.find((m) => m.id === selectedModuleId) ?? null,
    [allModules, selectedModuleId],
  );

  /** 风格锚点图提示词：先出这张锁风格，后续每页把它当参考图上传 */
  const anchorPrompt = seriesStyle ? buildAnchorPrompt(seriesTitle, seriesStyle) : '';

  /** App 内直接生成锚点图：走当前生图服务商（Qwen / SenseNova），生成后下载用于外部生图参考 */
  const genAnchorImg = async () => {
    if (!seriesStyle) return;
    setAnchorBusy(true);
    try {
      const prov = getImageProvider(useMock);
      const url = await prov.generate(buildAnchorPrompt(seriesTitle, seriesStyle), {
        ratio: '16:9',
        onProgress: (m) => showToast(m),
      });
      setAnchorImg(url);
      showToast('风格锚点图已生成，外部生图时把它上传作参考图');
    } catch (e) {
      showToast('锚点图生成失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAnchorBusy(false);
    }
  };

  const downloadAnchor = () => {
    if (!anchorImg) return;
    const a = document.createElement('a');
    a.href = anchorImg;
    a.download = `${seriesTitle || 'style'}-anchor.png`;
    a.click();
  };

  const copyAll = () => {
    const all = pages
      .map((pg, i) => `#${String(i + 1).padStart(2, '0')} ${pg.page.title} (${pg.modules.length} modules)\n\n${pg.prompt}\n`)
      .join('\n' + '—'.repeat(40) + '\n\n');
    const full = `${seriesTitle}\n${stylePreset.label} · ${pages.length} pages\n\n【风格锚点图 · 先生成这张，之后每页把它当参考图】\n${anchorPrompt}\n\n${REFERENCE_WORKFLOW}\n\n${'—'.repeat(40)}\n\n${all}`;
    navigator.clipboard.writeText(full);
    showToast(`已复制锚点图 + 全部 ${pages.length} 页提示词`);
  };

  const exportJson = () => {
    const data = {
      seriesTitle,
      stylePreset: stylePreset.id,
      seriesStyle,
      quality: qualityReport,
      selfCheck: selfCheckResult,
      pages: pages.map((pg) => ({
        id: pg.page.id,
        title: pg.page.title,
        ratio: pg.page.ratio,
        visualHint: pg.page.visualHint,
        modules: pg.modules.map((m) => ({
          id: m.id, type: m.type, title: m.title, body: m.body, bullets: m.bullets, icon: m.icon,
        })),
        prompt: pg.prompt,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seriesTitle || 'prompts'}-pages.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 JSON');
  };

  const exportTxt = () => {
    const all = pages
      .map((pg, i) => `#${String(i + 1).padStart(2, '0')} ${pg.page.title} (${pg.modules.length} modules)\n\n${pg.prompt}\n`)
      .join('\n' + '—'.repeat(40) + '\n\n');
    const full = `${seriesTitle}\n${stylePreset.label} · ${pages.length} pages\n\n【风格锚点图 · 先生成这张，之后每页把它当参考图】\n${anchorPrompt}\n\n${REFERENCE_WORKFLOW}\n\n${'—'.repeat(40)}\n\n${all}`;
    const blob = new Blob([full], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seriesTitle || 'prompts'}-pages.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 TXT');
  };

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    let content: string;

    try {
      if (ext === 'pdf') {
        content = await extractPDF(file);
      } else {
        content = await readFileAsText(file);
      }

      // 超出上限按语义截断（按字符数近似估算，避免一次塞入过长的内容拖垮拆解）
      const MAX_INPUT = 20000;
      const originalLen = content.length;
      const truncated = originalLen > MAX_INPUT;
      if (truncated) content = content.slice(0, MAX_INPUT);
      setInput(truncated ? content + '\n…（内容较长已截断）' : content);
      // 存下加载信息，界面上持续显示（toast 2 秒就消失，单靠它用户看不出加载了什么）
      setLoadedFile({ name: file.name, chars: originalLen, truncated, preview: content.slice(0, 200) });
      showToast(`已加载 ${file.name}（${originalLen} 字${truncated ? `，超长已截断为 ${content.length}` : ''}）`);
    } catch (err) {
      showToast('文件读取失败：' + (err instanceof Error ? err.message : '未知错误'));
    }

    // 清空 input 以便重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 处理 URL 提取（服务端代理抓取正文，失败会明确报错，不再静默降级）
  const handleURLSubmit = async () => {
    let url = input.trim();
    if (!url) {
      showToast('请输入有效的 URL');
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    setBusy(true);
    try {
      const result = await extractFromURL(url, { mock: getSettings().mock });
      if (result.content.trim().length < 8) {
        throw new Error('提取到的正文过短，请改为复制粘贴文本');
      }
      const hasTitle = result.title && !result.content.includes(result.title);
      setInput(hasTitle ? `# ${result.title}\n\n${result.content}` : result.content);
      showToast(`已提取《${result.title || url.slice(0, 30)}》正文 ${result.wordCount} 字`); // allow-truncation: toast 里 URL 展示截断
    } catch (err) {
      showToast('URL 提取失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.page}>
      {/* 顶部导航 */}
      <nav style={S.nav} className="fade-in">
        <div style={S.navLeft}>
          <div style={S.logoIcon}>✦</div>
          <div style={S.logoText}>
            <span style={S.logoTitle}>{appName}</span>
            {appSubtitle && <span style={S.logoSub}>{appSubtitle}</span>}
          </div>
        </div>
        <div style={S.navRight}>
          {useMock && <span style={S.mockBadge}>MOCK</span>}
          {/* 快捷入口常驻：不必先走完前面的步骤，空数据由各视图空态兜底 */}
          {step !== 'study' && (
            <button
              style={S.studyBtn}
              onClick={() => { setStudyScope(undefined); gotoStep('study'); }}
              title="复习闪卡（逾期最久优先）"
            >
              📚 复习{studyCards.length === 0 ? '' : dueCount > 0 ? (
                <span style={{
                  marginLeft: 6, background: 'var(--error)', color: '#fff',
                  borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                }}>{dueCount}</span>
              ) : ' ✓'}
            </button>
          )}
          {step !== 'quiz' && (
            <button style={S.navBtn} onClick={() => gotoStep('quiz')} title="按本组知识点出测验题">
              📝 测验
            </button>
          )}
          {step !== 'export' && (
            <button style={S.navBtn} onClick={() => gotoStep('export')} title="批量导出全部提示词">
              📦 批量导出
            </button>
          )}
          <button style={S.iconBtn} onClick={() => gotoStep('admin')} title="后台管理">
            ⚙️
          </button>
          <button style={S.iconBtn} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="切换主题">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      {/* 步骤指示器（后台管理页不显示）：可点，任意步骤直接跳转或回退 */}
      {step !== 'admin' && (
      <div style={S.stepBar} className="fade-in">
        {STEPS.map((s, i) => (
          <Fragment key={s.id}>
            {i > 0 && (
              <div style={{ ...S.stepLine, ...(stepIndex >= i ? S.stepLineActive : {}) }} />
            )}
            <StepDot
              active={navStep === s.id}
              done={stepIndex > i}
              num={i + 1}
              label={s.label}
              onClick={() => gotoStep(s.id)}
            />
          </Fragment>
        ))}
      </div>
      )}

      {/* 主内容区：错误边界兜底——任何子视图渲染抛错都给出可恢复出口，而不是整树卸载逼用户手动刷新 */}
      <main style={S.main}>
        <StepErrorBoundary stepKey={step} onEscape={() => { setStep('input'); setStudyScope(undefined); }}>
        {step === 'input' && (
          <div style={S.card} className="fade-in">
            <div style={S.cardHead}>
              <span style={S.kicker}>第一步</span>
              <h2 style={S.h2}>输入知识内容</h2>
              <p style={S.h2desc}>输入主题、粘贴文本、上传文件或 URL，AI 自动拆解为结构化模块并生成闪卡</p>
            </div>

            {/* 输入方式切换 */}
            <div style={S.inputTypeSwitch}>
              <button
                style={{ ...S.inputTypeBtn, ...(inputType === 'text' ? S.inputTypeBtnActive : {}) }}
                onClick={() => setInputType('text')}
              >
                ✏️ 手动输入
              </button>
              <button
                style={{ ...S.inputTypeBtn, ...(inputType === 'file' ? S.inputTypeBtnActive : {}) }}
                onClick={() => setInputType('file')}
              >
                📁 上传文件
              </button>
              <button
                style={{ ...S.inputTypeBtn, ...(inputType === 'url' ? S.inputTypeBtnActive : {}) }}
                onClick={() => setInputType('url')}
              >
                🔗 URL 提取
              </button>
            </div>

            {/* 手动输入 */}
            {inputType === 'text' && (
              <div style={S.field}>
                <label style={S.label}>主题或文本</label>
                <textarea
                  style={S.textarea}
                  placeholder="例如：HTTP1.1 vs HTTP2 / 504网关超时 / 光合作用原理…"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setGenError(''); }}
                  rows={6}
                />
              </div>
            )}

            {/* 文件上传 */}
            {inputType === 'file' && (
              <div style={S.field}>
                <label style={S.label}>选择文件（PDF / Markdown / TXT）</label>
                <div style={S.fileDropZone} onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.md,.markdown,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <div style={S.fileIcon}>📄</div>
                  <div style={S.fileText}>
                    <div style={S.fileTitle}>点击选择文件或拖拽到此处</div>
                    <div style={S.fileHint}>支持 PDF、Markdown、纯文本</div>
                  </div>
                </div>
                {loadedFile && (
                  <div style={S.loadedCard}>
                    <div style={S.loadedHeader}>
                      <span style={S.loadedTitle}>✓ 已加载：{loadedFile.name}</span>
                      <span style={S.loadedMeta}>
                        {loadedFile.chars} 字{loadedFile.truncated ? ` · 已截断` : ''}
                      </span>
                    </div>
                    <div style={S.loadedPreview}>{loadedFile.preview}{loadedFile.truncated ? ' …' : ''}</div>
                  </div>
                )}
              </div>
            )}

            {/* URL 提取 */}
            {inputType === 'url' && (
              <div style={S.field}>
                <label style={S.label}>网页 URL</label>
                <div style={S.urlRow}>
                  <input
                    style={S.urlInput}
                    placeholder="https://example.com/article"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); setGenError(''); }}
                  />
                  <button style={S.urlBtn} onClick={handleURLSubmit} disabled={busy}>
                    提取
                  </button>
                </div>
              </div>
            )}

            {/* AI 推荐 */}
            {rec && (
              <div style={userOverride ? S.recDim : S.recBox}>
                <div style={S.recIcon}>✨</div>
                <div style={{ flex: 1 }}>
                  <div style={S.recTitle}>
                    AI 推荐风格：<b>{STYLE_PRESETS.find(p => p.id === rec.presetId)?.label}</b>
                  </div>
                  <div style={S.recReason}>{rec.reason}</div>
                </div>
                {!userOverride ? (
                  <span style={S.recOk}>✓ 已应用</span>
                ) : (
                  <button style={S.recBtn} onClick={() => setStylePresetId(rec.presetId)}>采用</button>
                )}
              </div>
            )}

            <div style={S.field}>
              <label style={S.label}>视觉风格</label>
              <div style={S.chipWrap}>
                <button
                  style={{ ...S.chip, ...(stylePresetId === 'auto' ? S.chipActive : {}) }}
                  onClick={() => setStylePresetId('auto')}
                  title="每次生成时按输入内容自动推荐风格（后台管理可改默认值）"
                >
                  ✨ 跟随 AI
                </button>
                {STYLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    style={{ ...S.chip, ...(stylePresetId === p.id ? S.chipActive : {}) }}
                    onClick={() => setStylePresetId(p.id)}
                  >
                    {p.label}
                    {rec?.presetId === p.id && <span style={S.chipStar}> ✦</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* 选项行 */}
            <div style={S.optsRow}>
              <OptCard title="AI 调用模式">
                <div style={S.seg}>
                  <button style={{ ...S.segBtn, ...(!useMock ? S.segOn : {}) }} onClick={() => saveRuntimeSettings({ mock: false })}>
                    真实调用
                  </button>
                  <button style={{ ...S.segBtn, ...(useMock ? S.segOn : {}) }} onClick={() => saveRuntimeSettings({ mock: true })}>
                    占位预览
                  </button>
                </div>
              </OptCard>
              <OptCard title="输出选项">
                <label style={S.checkRow}>
                  <input
                    type="checkbox"
                    checked={showPageNumber}
                    onChange={(e) => applyBadge({ on: e.target.checked, pos: pageBadgePos, fmt: pageBadgeFormat })}
                    style={S.check}
                  />
                  <span style={S.checkLabel}>在图上标注页码编号</span>
                </label>
                {showPageNumber && (
                  <div style={S.badgeOptsRow}>
                    <select
                      style={S.miniSelect}
                      value={pageBadgePos}
                      onChange={(e) => applyBadge({ on: true, pos: e.target.value as PageBadgePos, fmt: pageBadgeFormat })}
                      title="页码位置"
                    >
                      <option value="tl">左上角</option>
                      <option value="tc">上边缘正中</option>
                      <option value="tr">右上角</option>
                      <option value="bl">左下角</option>
                      <option value="bc">下边缘正中</option>
                      <option value="br">右下角</option>
                    </select>
                    <select
                      style={S.miniSelect}
                      value={pageBadgeFormat}
                      onChange={(e) => applyBadge({ on: true, pos: pageBadgePos, fmt: e.target.value as PageBadgeFormat })}
                      title="页码格式"
                    >
                      <option value="cn">第 X / N 页</option>
                      <option value="slash">X / N</option>
                      <option value="dot">X · N</option>
                    </select>
                  </div>
                )}
              </OptCard>
            </div>

            <button
              style={{ ...S.submitBtn, ...(busy ? S.disabled : {}) }}
              disabled={busy}
              onClick={() => handleDecompose(input)}
            >
              {busy ? '处理中…' : '生成提示词'}
              <span style={S.submitArr}>→</span>
            </button>
            {genError && (
              <div style={S.error} role="alert">
                <strong>生成失败：</strong>{genError}
                <div style={S.errorHint}>可按上一步返回调整内容后重试；也检查「后台管理」里的模型配置是否正确。</div>
              </div>
            )}
          </div>
        )}

        {step === 'prompts' && (
          <div className="fade-in">
            {/* 系列信息卡 */}
            <div style={S.seriesCard}>
              <div style={S.seriesLeft}>
                <button style={S.backBtn} onClick={() => gotoStep('input')}>← 返回</button>
                <div>
                  <div style={S.seriesKicker}>{stylePreset.label} · {pages.length} 页 · {studyCards.length} 张闪卡</div>
                  <h2 style={S.seriesTitle}>{seriesTitle}</h2>
                </div>
              </div>
              <div style={S.seriesBtns}>
                <button
                  style={S.ghostBtn}
                  onClick={() => { setStudyScope(seriesTitle); gotoStep('study'); }}
                >
                  复习
                </button>
                <button style={S.ghostBtn} onClick={copyAll}>复制全部</button>
                <button style={S.ghostBtn} onClick={exportTxt}>TXT</button>
                <button style={S.primaryBtn} onClick={exportJson}>JSON</button>
                <button 
                  style={{ ...S.ghostBtn, ...(showGraph ? S.btnActive : {}) }}
                  onClick={() => setShowGraph(!showGraph)}
                >
                  图谱
                </button>
              </div>
            </div>

            {/* 质检面板 */}
            {qualityReport && (
              <QualityPanel
                report={qualityReport}
                selfCheckResult={selfCheckResult}
                selfCheckBusy={selfCheckBusy}
                onSelfCheck={handleSelfCheck}
                showIssues={showIssues}
                setShowIssues={setShowIssues}
                moduleMap={moduleMap}
                improvementInfo={improvementInfo}
                onApply={applyImprovement}
                onApplyAll={applyAllImprovements}
                onUndo={undoAdopt}
              />
            )}

            {/* 提示词卡片列表：锚点图在最前，其后逐页 */}
            <div style={S.promptList} className="stagger">
              {anchorPrompt && (
                <article style={{ ...S.promptCard, border: '1.5px solid var(--accent)' }}>
                  <div style={S.pcHead}>
                    <div style={S.pcLeft}>
                      <div style={S.pcIndex}>
                        <span style={S.pcIndexNum}>锚</span>
                      </div>
                      <div>
                        <h3 style={S.pcTitle}>风格锚点图 · 先生成这张</h3>
                        <div style={S.pcMeta}>
                          <span>整组风格基准</span>
                          <span style={S.metaDot}>·</span>
                          <span>后续每页把它当参考图</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={{ ...S.copyBtn, ...(anchorBusy ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                        disabled={anchorBusy}
                        onClick={genAnchorImg}
                      >
                        {anchorBusy ? '生成中…' : anchorImg ? '重生成锚点图' : '⚡ AI 生成锚点图'}
                      </button>
                      <button style={S.copyBtn} onClick={() => copyOne(anchorPrompt)}>复制</button>
                    </div>
                  </div>
                  {anchorImg && (
                    <div style={{ padding: '0 16px 12px' }}>
                      <img
                        src={anchorImg}
                        alt="风格锚点图"
                        style={{ width: '100%', maxWidth: 420, borderRadius: 10, border: '1px solid var(--border)', display: 'block' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                        <button style={S.copyBtn} onClick={downloadAnchor}>下载锚点图</button>
                        <span style={{ ...S.learnDesc, fontSize: 12 }}>外部生图时把这张图上传作参考图，即可锁住整组风格</span>
                      </div>
                    </div>
                  )}
                  <div style={{ ...S.learnDesc, padding: '0 16px 10px' }}>{REFERENCE_WORKFLOW}</div>
                  <pre style={S.promptText}>{anchorPrompt}</pre>
                </article>
              )}
              {pages.map((pg, i) => (
                <PromptCard
                  key={pg.page.id}
                  index={i + 1}
                  pageData={pg}
                  onCopy={() => copyOne(pg.prompt)}
                />
              ))}
            </div>

            {seriesStyle && pages.length > 0 && (
              <>
                <CardGallery
                  modules={pages.flatMap(pg => pg.modules)}
                  style={seriesStyle}
                  seriesTitle={seriesTitle}
                  useMock={useMock}
                  cardKeyPrefix={`card-${genTag}-`}
                  onToast={showToast}
                  onImageGenerated={markCardImage}
                />

                {/* 路 C：学习页 */}
                <div style={S.learnBox}>
                  <div style={S.learnInfo}>
                    <b style={S.learnTitle}>📚 学习页</b>
                    <span style={S.learnDesc}>
                      在本页直接浏览全部知识点：画报式配图 + 完整正文与要点，点文字即可就地编辑。
                      {learnBusy && ' 正在扩充内容…'}
                    </span>
                  </div>
                  <button style={S.learnBtn} onClick={() => setStep('learn')}>
                    进入学习页
                  </button>
                </div>

                {/* 概念关系图谱：由系列卡「图谱」按钮开关 */}
                {showGraph && (
                  <div style={S.graphSection} className="fade-in">
                    <div style={S.graphTitle}>概念关系图谱 · 点击节点查看模块</div>
                    <ConceptGraph
                      modules={allModules}
                      selectedModuleId={selectedModuleId ?? undefined}
                      onSelectModule={(m) => setSelectedModuleId(m.id)}
                    />
                    {selectedModule && (
                      <div style={S.moduleDetail}>
                        <b style={{ color: 'var(--text-bright)' }}>{selectedModule.title}</b>
                        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.7, color: 'var(--text-mute)' }}>
                          {selectedModule.body}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 'learn' && seriesStyle && pages.length > 0 && (
          <LearnBrowseView
            modules={mergedLearnModules}
            groups={pages.map(pg => ({ title: pg.page.title, moduleIds: pg.page.moduleIds }))}
            seriesTitle={seriesTitle}
            seriesStyle={seriesStyle}
            learnBusy={learnBusy}
            onContentChange={(updated) => {
              // 编辑后的模块写回 pages（保持同一次工作流内编辑可见）
              const byId = new Map(updated.map(m => [m.id, m]));
              setPages(prev => prev.map(pg => ({
                ...pg,
                modules: pg.modules.map(m => byId.get(m.id) ?? m),
              })));
            }}
            onBack={backStep}
          />
        )}

        {step === 'study' && (
          <StudyView
            cards={studyCards}
            onCardsChange={setStudyCards}
            filterSource={studyScope}
            onBack={backStep}
          />
        )}

        {step === 'quiz' && (
          <QuizView
            modules={pages.flatMap(pg => pg.modules)}
            onBack={backStep}
            onToast={showToast}
          />
        )}

        {step === 'export' && pages.length > 0 && seriesStyle && (
          <BatchExportView
            pages={pages.map(pg => ({
              id: pg.page.id,
              title: pg.page.title,
              moduleIds: pg.page.moduleIds,
              ratio: pg.page.ratio,
              visualHint: pg.page.visualHint,
            }))}
            prompts={pages.map(pg => pg.prompt)}
            style={seriesStyle}
            seriesTitle={seriesTitle}
            onBack={backStep}
            onToast={showToast}
          />
        )}

        {step === 'export' && (pages.length === 0 || !seriesStyle) && (
          <EmptyStage
            icon="📦"
            title="还没有可导出的内容"
            desc="先在「输入」页生成提示词，再回到这里批量导出。"
            actionLabel="去输入页"
            onAction={() => gotoStep('input')}
          />
        )}

        {step === 'admin' && (
          <AdminView onBack={backStep} onToast={showToast} />
        )}
        </StepErrorBoundary>
      </main>

      {toast && <div style={S.toast} className="fade-in">{toast}</div>}
    </div>
  );
}

// ===================== 子组件 =====================

/** 通用空态：当前步骤没有可展示的数据时兜底，并提供明确的出路 */
function EmptyStage({ icon, title, desc, actionLabel, onAction }: { icon: string; title: string; desc: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={S.emptyStage} className="fade-in">
      <div style={S.emptyIcon}>{icon}</div>
      <div style={S.emptyTitle}>{title}</div>
      <div style={S.emptyDesc}>{desc}</div>
      {actionLabel && onAction && (
        <button style={S.ghostBtn} onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

function StepDot({ active, done, num, label, onClick }: { active: boolean; done: boolean; num: number; label: string; onClick?: () => void }) {
  return (
    <button type="button" style={{ ...S.stepDot, ...(done ? { borderColor: 'var(--accent)' } : {}), ...(active ? S.stepDotActive : {}), cursor: 'pointer' }} onClick={onClick} title={`跳转到「${label}」`}>
      <span style={S.stepNum}>{num}</span>
      <span style={S.stepLabel}>{label}</span>
    </button>
  );
}

function OptCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.optCard}>
      <div style={S.optTitle}>{title}</div>
      {children}
    </div>
  );
}

function QualityPanel({
  report, selfCheckResult, selfCheckBusy, onSelfCheck, showIssues, setShowIssues, moduleMap,
  improvementInfo, onApply, onApplyAll, onUndo,
}: {
  report: QualityReport;
  selfCheckResult: SelfCheckResult | null;
  selfCheckBusy: boolean;
  onSelfCheck: () => void;
  showIssues: boolean;
  setShowIssues: (v: boolean) => void;
  moduleMap: Map<string, KnowledgeModule>;
  improvementInfo: Map<string, ImprovementEntry>;
  onApply: (imp: ImprovedMod) => void;
  onApplyAll: (list: ImprovedMod[]) => void;
  onUndo: (id: string) => void;
}) {
  const scoreColor = report.score >= 80 ? 'var(--success)' : report.score >= 60 ? 'var(--warning)' : 'var(--accent)';

  const allIssues = useMemo(() => {
    const list: Array<QualityIssue | SelfCheckIssue & { code?: string; source: 'rule' | 'ai' }> = [
      ...report.issues.map((i) => ({ ...i, source: 'rule' as const })),
      ...(selfCheckResult?.issues.map((i, idx) => ({ ...i, code: `AI-${idx + 1}`, source: 'ai' as const })) ?? []),
    ];
    list.sort((a, b) => ({ error: 0, warning: 1, info: 2 })[a.severity] - ({ error: 0, warning: 1, info: 2 })[b.severity]);
    return list;
  }, [report.issues, selfCheckResult?.issues]);

  // B 模型给了修改建议、但没有任何对应问题条目的模块（透明度考虑：单独列出，不藏在批量按钮里）
  const orphanImprovements = useMemo(() => {
    const issueTargets = new Set(selfCheckResult?.issues.map((i) => i.moduleId) ?? []);
    return (selfCheckResult?.improvedModules ?? []).filter((i) => !issueTargets.has(i.id));
  }, [selfCheckResult]);

  const allEntries = useMemo(() => [...improvementInfo.values()], [improvementInfo]);
  const pendingList = allEntries.filter((e) => !e.adopted).map((e) => e.imp);
  const adoptedCount = allEntries.length - pendingList.length;

  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  return (
    <div style={S.qCard}>
      <div style={S.qTop}>
        {/* 分数 */}
        <div style={S.scoreWrap}>
          <div style={{ ...S.scoreNum, color: scoreColor }}>{report.score}</div>
          <div style={S.scoreLabel}>规则快检</div>
        </div>

        {/* 维度条 */}
        <div style={S.dims}>
          <DimBar label="完整性" score={report.dimensions.completeness} />
          <DimBar label="逻辑性" score={report.dimensions.consistency} />
          <DimBar label="数字" score={report.dimensions.numerics} />
          <DimBar label="风险" score={100 - report.dimensions.riskLevel} />
        </div>

        {/* AI 按钮 */}
        <div style={S.aiCol}>
          {selfCheckResult ? (
            <div style={S.aiScoreWrap}>
              <div style={{
                ...S.aiScoreNum,
                color: selfCheckResult.confidenceScore >= 80 ? 'var(--success)'
                  : selfCheckResult.confidenceScore >= 60 ? 'var(--warning)' : 'var(--accent)'
              }}>
                {selfCheckResult.confidenceScore}
              </div>
              <div style={S.aiScoreLabel}>AI 可信度</div>
            </div>
          ) : (
            <button style={{ ...S.aiBtn, ...(selfCheckBusy ? S.disabled : {}) }} disabled={selfCheckBusy} onClick={onSelfCheck}>
              {selfCheckBusy ? '质检中…' : 'AI 深度质检'}
            </button>
          )}
        </div>
      </div>

      {report.riskLabel !== '低风险' && (
        <div style={report.riskLabel === '高风险' ? S.riskHigh : S.riskMed}>
          ⚠ {report.riskLabel}内容 · 建议专业复核后再发布
        </div>
      )}

      {selfCheckResult?.overallComment && (
        <div style={S.aiComment}>💡 {selfCheckResult.overallComment}</div>
      )}

      {pendingList.length > 0 && (
        <div style={S.batchRow}>
          <span>B 模型提供了 <b>{pendingList.length}</b> 条改写建议</span>
          <button style={S.batchBtn} onClick={() => onApplyAll(pendingList)}>全部采纳</button>
        </div>
      )}
      {adoptedCount > 0 && (
        <div style={S.adoptedNote}>✓ 已采纳 {adoptedCount} 条改写 · 在对应条目里可“恢复原文”</div>
      )}

      <div style={S.issueHead} onClick={() => setShowIssues(!showIssues)}>
        <span>
          <b>{allIssues.length}</b> 个问题
          {errorCount > 0 && <span style={{ color: 'var(--error)' }}> · {errorCount} 严重</span>}
          {warningCount > 0 && <span style={{ color: 'var(--warning)' }}> · {warningCount} 警告</span>}
          {infoCount > 0 && <span style={{ color: 'var(--success)' }}> · {infoCount} 提示</span>}
        </span>
        <span style={S.chev}>{showIssues ? '▲' : '▼'}</span>
      </div>

      {showIssues && allIssues.length > 0 && (
        <div style={S.issueList}>
          {allIssues.map((issue, idx) => (
            <IssueItem
              key={idx}
              issue={issue}
              moduleMap={moduleMap}
              entry={issue.moduleId ? improvementInfo.get(issue.moduleId) : undefined}
              onApply={onApply}
              onUndo={onUndo}
            />
          ))}
        </div>
      )}
      {showIssues && allIssues.length === 0 && orphanImprovements.length === 0 && (
        <div style={S.noIssue}>✓ 未发现问题，内容质量良好</div>
      )}
      {showIssues && orphanImprovements.length > 0 && (
        <div style={S.issueList}>
          {orphanImprovements.map((imp) => (
            <div key={`orphan-${imp.id}`} style={S.issue}>
              <div style={S.issueTop}>
                <span style={{ ...S.badge, ...S.badgeI }}>建议</span>
                <span style={S.issueSrc}>AI 改写</span>
                {moduleMap.get(imp.id) && <span style={S.issueMod}>{moduleMap.get(imp.id)!.title}</span>}
              </div>
              <div style={S.issueMsg}>B 模型认为这张卡可以直接改写得更准（未列出具体问题）</div>
              <ImprovementBlock
                entry={improvementInfo.get(imp.id)!}
                current={moduleMap.get(imp.id)}
                onApply={onApply}
                onUndo={onUndo}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DimBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--accent)';
  return (
    <div style={S.dim}>
      <div style={S.dimTop}>
        <span style={S.dimLabel}>{label}</span>
        <span style={S.dimVal}>{score}</span>
      </div>
      <div style={S.dimTrack}>
        <div style={{ ...S.dimFill, width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function IssueItem({ issue, moduleMap, entry, onApply, onUndo }: {
  issue: QualityIssue | (SelfCheckIssue & { code?: string; source?: string });
  moduleMap: Map<string, KnowledgeModule>;
  entry?: ImprovementEntry;
  onApply: (imp: ImprovedMod) => void;
  onUndo: (id: string) => void;
}) {
  const sev = issue.severity;
  const sevStyle = sev === 'error' ? S.badgeE : sev === 'warning' ? S.badgeW : S.badgeI;
  const sevLabel = sev === 'error' ? '严重' : sev === 'warning' ? '警告' : '提示';
  const src = (issue as any).source === 'ai' ? 'AI 质检' : '规则检测';
  const curMod = issue.moduleId ? moduleMap.get(issue.moduleId) : undefined;
  const modName = curMod?.title;
  // 兜底：AI 报了要点层的事实错误，但改进建议漏给修正后的要点 → 采纳后错误要点仍在，必须明示
  const bulletMiss = (issue as any).source === 'ai' && (issue as any).type === 'accuracy' &&
    !!curMod?.bullets?.length && !!entry && !entry.imp.bullets?.length;

  return (
    <div style={S.issue}>
      <div style={S.issueTop}>
        <span style={{ ...S.badge, ...sevStyle }}>{sevLabel}</span>
        <span style={S.issueSrc}>{src}</span>
        {issue.code && <span style={S.issueCode}>{issue.code}</span>}
        {modName && <span style={S.issueMod}>{modName}</span>}
      </div>
      <div style={S.issueMsg}>{issue.message}</div>
      {issue.suggestion && <div style={S.issueSug}>💡 {issue.suggestion}</div>}
      {entry && (
        <ImprovementBlock
          entry={entry}
          current={curMod}
          onApply={onApply}
          onUndo={onUndo}
          bulletMiss={bulletMiss}
        />
      )}
    </div>
  );
}

/** 改前 / 改后 双栏对比（含逐词差异高亮） */

/** 单侧渲染 diff：side='a' 显示左栏（删的标红），side='b' 显示右栏（新增的标绿） */
function DiffText({ a, b, side }: { a: string; b: string; side: 'a' | 'b' }) {
  const toks = diffTokens(a, b);
  const kept = side === 'a' ? toks.filter(t => t.kind !== 'add') : toks.filter(t => t.kind !== 'del');
  const runs: { kind: 'same' | 'del' | 'add'; text: string }[] = [];
  for (const t of kept) {
    const last = runs[runs.length - 1];
    if (last && last.kind === t.kind) last.text += t.text;
    else runs.push({ ...t });
  }
  return (
    <>
      {runs.map((t, i) =>
        t.kind === 'del' ? <span key={i} style={S.diffDel}>{t.text}</span>
        : t.kind === 'add' ? <span key={i} style={S.diffAdd}>{t.text}</span>
        : <span key={i}>{t.text}</span>)}
    </>
  );
}

function DiffCols({ left, right, leftLabel, rightLabel }: {
  left: ContentLike;
  right: ContentLike;
  leftLabel: string;
  rightLabel: string;
}) {
  const col = (mod: ContentLike, label: string, accent: boolean, side: 'a' | 'b') => (
    <div style={{ ...S.diffCol, ...(accent ? S.diffColNew : {}) }}>
      <div style={S.diffHead}>{label}</div>
      <div style={S.diffTitle}><DiffText a={left.title} b={right.title} side={side} /></div>
      <div style={S.diffBody}><DiffText a={left.body} b={right.body} side={side} /></div>
      {left.bullets?.length || right.bullets?.length ? (
        <ul style={S.diffBullets}>
          {Array.from({ length: Math.max(left.bullets?.length ?? 0, right.bullets?.length ?? 0) }, (_, i) => (
            <li key={i}>
              <DiffText a={left.bullets?.[i] ?? ''} b={right.bullets?.[i] ?? ''} side={side} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
  return (
    <div style={S.diffWrap}>
      {col(left, leftLabel, false, 'a')}
      {col(right, rightLabel, true, 'b')}
    </div>
  );
}

/** B 模型改写建议的采纳交互：先看对比，确认后采纳；已采纳可看原文、可恢复 */
function ImprovementBlock({ entry, current, onApply, onUndo, bulletMiss }: {
  entry: ImprovementEntry;
  current?: KnowledgeModule;
  onApply: (imp: ImprovedMod) => void;
  onUndo: (id: string) => void;
  bulletMiss?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { imp, adopted, before } = entry;
  if (!current) return null;

  if (adopted) {
    return (
      <div style={S.adoptWrap}>
        <div style={S.adoptRow}>
          <span style={S.adoptedTag}>✓ 已采纳 B 版</span>
          <button style={S.linkBtn} onClick={() => setOpen(!open)}>
            {open ? '收起对比' : '查看改前/改后对比'}
          </button>
          <button style={S.undoBtn} onClick={() => onUndo(imp.id)}>恢复原文</button>
        </div>
        {bulletMiss && (
          <div style={S.bulletMissNote}>
            ⚠ 该问题定位在"要点"里的事实错误，但 B 版没给出修正后的要点——采纳后这条要点可能仍是错的内容，请对照上方的修改建议人工核对。
          </div>
        )}
        {open && before && (
          <DiffCols left={before} right={current} leftLabel="改前（原文）" rightLabel="改后（当前 · B 版）" />
        )}
      </div>
    );
  }

  const after = buildAfter(current, imp);
  return (
    <div style={S.adoptWrap}>
      {!open ? (
        <button style={S.viewFixBtn} onClick={() => setOpen(true)}>查看 B 模型改写 →</button>
      ) : (
        <>
          <DiffCols left={current} right={after} leftLabel="当前版本" rightLabel="B 模型建议版" />
          <div style={S.adoptRow}>
            <button
              style={S.adoptConfirmBtn}
              onClick={() => { onApply(imp); setOpen(false); }}
            >
              采纳此修改
            </button>
            <button style={S.linkBtn} onClick={() => setOpen(false)}>收起</button>
          </div>
        </>
      )}
    </div>
  );
}

function PromptCard({ index, pageData, onCopy }: {
  index: number;
  pageData: PageData;
  onCopy: () => void;
}) {
  const { page, modules, prompt } = pageData;
  return (
    <article style={S.promptCard}>
      <div style={S.pcHead}>
        <div style={S.pcLeft}>
          <div style={S.pcIndex}>
            <span style={S.pcIndexNum}>{String(index).padStart(2, '0')}</span>
          </div>
          <div>
            <h3 style={S.pcTitle}>{page.title}</h3>
            <div style={S.pcMeta}>
              <span>{modules.length} 个模块</span>
              <span style={S.metaDot}>·</span>
              <span>{page.ratio}</span>
            </div>
          </div>
        </div>
        <button style={S.copyBtn} onClick={onCopy}>复制</button>
      </div>

      <div style={S.pcTags}>
        {modules.map((m, i) => (
          <span key={i} style={S.tag}>
            {m.icon ? m.icon + ' ' : ''}{m.title}
          </span>
        ))}
      </div>

      <pre style={S.promptText}>{prompt}</pre>
    </article>
  );
}

// ===================== 辅助函数 =====================

async function readFileAsText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  // GBK/GB18030 编码的中文按 UTF-8 误读会产出替换符 U+FFFD；超过 1% 才判定为乱码并用 GB18030 重读
  const badRatio = (utf8.match(/\uFFFD/g) ?? []).length / Math.max(utf8.length, 1);
  if (badRatio >= 0.01) {
    try {
      return new TextDecoder('gb18030').decode(buf);
    } catch {
      /* 浏览器不支持 gb18030 时退回 UTF-8 原文 */
    }
  }
  return utf8;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
/** 懒加载 pdfjs 主体（首次用到 PDF 时拉取，避免首屏多 400KB+）；workerSrc 只需设置一次 */
function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((m) => {
      m.GlobalWorkerOptions.workerSrc = pdfWorker;
      return m;
    });
  }
  return pdfjsPromise;
}

async function extractPDF(file: File): Promise<string> {
  try {
    const pdfjs = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // 文本项按读取顺序拼接；PDF 会把一行字拆成多段，用纵坐标分块避免串行
      const byY = new Map<number, string[]>();
      for (const item of content.items) {
        const t = 'str' in item ? item.str : '';
        if (!t) continue;
        const y = 'transform' in item ? Math.round(item.transform[5]) : 0;
        const block = byY.get(y) ?? [];
        block.push(t);
        byY.set(y, block);
      }
      const line = [...byY.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, toks]) => toks.join(' '))
        .join('\n');
      pages.push(line);
    }
    const text = pages.join('\n\n').trim();
    if (text.length < 8) {
      throw new Error('该 PDF 没有可提取的文本层（可能是扫描件/图片型 PDF），请改用文本版或手动粘贴');
    }
    return text;
  } catch (err) {
    if (err instanceof Error && /没有可提取的文本层/.test(err.message)) throw err;
    throw new Error('PDF 解析失败：' + (err instanceof Error ? err.message : '未知错误'));
  }
}

// ===================== 样式 =====================

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '24px 20px 80px',
    minHeight: '100vh',
    position: 'relative',
    zIndex: 1,
  },

  // —— 顶部导航 ——
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    padding: '12px 16px',
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-sm)',
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'var(--accent-gradient)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: '#fff',
    boxShadow: 'var(--shadow-glow)',
  },
  logoText: { display: 'flex', flexDirection: 'column', gap: 1 },
  logoTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-bright)', lineHeight: 1.2 },
  logoSub: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.02em' },
  navRight: { display: 'flex', alignItems: 'center', gap: 8 },
  mockBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    padding: '4px 10px',
    borderRadius: 999,
    letterSpacing: '0.1em',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background .2s',
  },
  studyBtn: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 10,
    padding: '8px 16px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
    transition: 'transform .15s',
  },
  // 导航栏常驻入口：低调 ghost 样式，避免和「复习」主按钮抢视觉焦点
  navBtn: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '7px 12px',
    cursor: 'pointer',
    transition: 'background .2s',
  },

  // —— 步骤条 ——
  stepBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 24,
  },
  stepDot: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderRadius: 999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    transition: 'all .3s',
  },
  stepDotActive: {
    background: 'var(--accent-gradient)',
    borderColor: 'transparent',
    color: '#fff',
    boxShadow: 'var(--shadow-glow)',
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
  },
  stepLabel: { fontSize: 13, fontWeight: 500 },
  stepLine: {
    width: 48,
    height: 2,
    background: 'var(--border)',
    margin: '0 -2px',
    zIndex: 0,
  },
  stepLineActive: { background: 'var(--accent-gradient)' },

  // —— 空态 ——
  emptyStage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '64px 24px',
    border: '1px dashed var(--border)',
    borderRadius: 16,
    background: 'var(--surface)',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' },
  emptyDesc: { fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.6 },

  // —— 主内容 ——
  main: {},

  // —— 输入卡片 ——
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 32,
    boxShadow: 'var(--shadow-md)',
  },
  cardHead: { marginBottom: 24 },
  kicker: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  h2: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text-bright)',
    marginBottom: 4,
    lineHeight: 1.2,
  },
  h2desc: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 },

  // —— 输入方式切换 ——
  inputTypeSwitch: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
  },
  inputTypeBtn: {
    flex: 1,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  inputTypeBtnActive: {
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    borderColor: 'transparent',
    boxShadow: 'var(--shadow-glow)',
  },

  field: { marginBottom: 20 },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid var(--border-2)',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 1.7,
    resize: 'vertical',
    fontFamily: 'inherit',
    background: 'var(--surface-3)',
    color: 'var(--text)',
    transition: 'border-color .2s, box-shadow .2s',
    minHeight: 120,
  },

  // —— 文件上传 ——
  fileDropZone: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '24px 20px',
    border: '2px dashed var(--border)',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all .2s',
    background: 'var(--surface-3)',
  },
  fileIcon: { fontSize: 32 },
  fileText: { display: 'flex', flexDirection: 'column', gap: 4 },
  fileTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  fileHint: { fontSize: 12, color: 'var(--text-muted)' },
  loadedCard: {
    marginTop: 12,
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--surface-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  loadedHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  loadedTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  loadedMeta: { fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  loadedPreview: {
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 84,
    overflow: 'hidden',
  },

  // —— URL 输入 ——
  urlRow: {
    display: 'flex',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    padding: '12px 14px',
    fontSize: 14,
    border: '1px solid var(--border-2)',
    borderRadius: 10,
    background: 'var(--surface-3)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  },
  urlBtn: {
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
  },

  // —— AI 推荐 ——
  recBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 12,
    background: 'var(--accent-soft)',
    border: '1px solid rgba(var(--accent-rgb), 0.25)',
    marginBottom: 20,
  },
  recDim: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 12,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    marginBottom: 20,
    opacity: 0.6,
  },
  recIcon: { fontSize: 20 },
  recTitle: { fontSize: 13, color: 'var(--text)', fontWeight: 500 },
  recReason: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  recOk: {
    fontSize: 11,
    color: 'var(--success)',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(var(--success-rgb), 0.1)',
  },
  recBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
  },

  // —— 风格 chip ——
  chipWrap: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontSize: 12,
    background: 'var(--surface-2)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '6px 14px',
    cursor: 'pointer',
    transition: 'all .2s',
  },
  chipActive: {
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    borderColor: 'transparent',
    fontWeight: 500,
    boxShadow: 'var(--shadow-glow)',
  },
  chipStar: { fontSize: 10, opacity: 0.9 },

  // —— 选项行 ——
  optsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 24,
  },
  optCard: {
    padding: 14,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },
  optTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 10,
  },
  seg: {
    display: 'inline-flex',
    background: 'var(--surface-3)',
    borderRadius: 8,
    padding: 2,
    border: '1px solid var(--border)',
  },
  segBtn: {
    fontSize: 12,
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all .2s',
    fontWeight: 500,
  },
  segOn: {
    background: 'var(--surface)',
    color: 'var(--text-bright)',
    boxShadow: 'var(--shadow-sm)',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    cursor: 'pointer',
    userSelect: 'none',
  },
  check: { marginTop: 2, width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' },
  checkLabel: { fontSize: 13, color: 'var(--text)', lineHeight: 1.5 },
  badgeOptsRow: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const },
  miniSelect: {
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid var(--border-2)',
    background: 'var(--surface-3)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
    outline: 'none',
  },

  // —— 提交按钮 ——
  submitBtn: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: 'var(--shadow-glow)',
    transition: 'transform .15s, box-shadow .2s, opacity .2s',
  },
  submitArr: { fontSize: 18, transition: 'transform .2s' },
  disabled: { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' },

  // —— 学习页入口 ——
  learnBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
    padding: 18, marginTop: 20, flexWrap: 'wrap',
    background: 'var(--surface)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-md)',
  },
  learnInfo: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 },
  learnTitle: { fontSize: 15, color: 'var(--text-bright)' },
  learnDesc: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 },
  learnBtn: {
    padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
  },

  // —— 系列信息卡 ——
  seriesCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-md)',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  seriesLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all .2s',
  },
  seriesKicker: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginBottom: 2,
  },
  seriesTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-bright)',
    margin: 0,
    lineHeight: 1.2,
  },
  seriesBtns: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  ghostBtn: {
    fontSize: 12,
    background: 'var(--surface-2)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '7px 14px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all .2s',
  },
  primaryBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 8,
    padding: '7px 16px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
    transition: 'opacity .2s',
  },

  // —— 质检面板 ——
  qCard: {
    padding: 18,
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 16,
  },
  qTop: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr 120px',
    gap: 16,
    alignItems: 'center',
  },
  scoreWrap: { textAlign: 'center' },
  scoreNum: { fontSize: 36, fontWeight: 700, lineHeight: 1 },
  scoreLabel: { fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 },
  dims: { display: 'flex', flexDirection: 'column', gap: 6 },
  dim: {},
  dimTop: { display: 'flex', justifyContent: 'space-between', marginBottom: 3 },
  dimLabel: { fontSize: 11, color: 'var(--text-muted)' },
  dimVal: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 },
  dimTrack: { height: 4, borderRadius: 2, background: 'var(--border-2)', overflow: 'hidden' },
  dimFill: { height: '100%', borderRadius: 2, transition: 'width .4s cubic-bezier(0.16,1,0.3,1)' },
  aiCol: { display: 'flex', justifyContent: 'center' },
  aiScoreWrap: { textAlign: 'center' },
  aiScoreNum: { fontSize: 30, fontWeight: 700, lineHeight: 1 },
  aiScoreLabel: { fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 },
  aiBtn: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: 'var(--shadow-glow)',
    transition: 'opacity .2s',
  },
  riskHigh: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.2)',
    borderRadius: 10,
    fontSize: 12,
    color: 'var(--error)',
    fontWeight: 500,
  },
  riskMed: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'rgba(var(--warning-rgb),0.08)',
    border: '1px solid rgba(var(--warning-rgb),0.2)',
    borderRadius: 10,
    fontSize: 12,
    color: 'var(--warning)',
    fontWeight: 500,
  },
  aiComment: {
    marginTop: 10,
    padding: '10px 14px',
    background: 'var(--surface-2)',
    borderRadius: 10,
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  issueHead: {
    marginTop: 12,
    padding: '8px 0',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  chev: { fontSize: 9, color: 'var(--text-muted)' },
  issueList: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  issue: {
    padding: 12,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  issueTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  badge: {
    fontSize: 9,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    letterSpacing: '0.05em',
  },
  badgeE: { background: 'rgba(248,113,113,0.12)', color: 'var(--error)' },
  badgeW: { background: 'rgba(var(--warning-rgb),0.12)', color: 'var(--warning)' },
  badgeI: { background: 'rgba(var(--success-rgb),0.12)', color: 'var(--success)' },
  issueSrc: { fontSize: 9, color: 'var(--text-muted)', background: 'var(--elevated)', padding: '2px 6px', borderRadius: 4 },
  issueCode: { fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' },
  issueMod: { fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic' },
  issueMsg: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 },
  issueSug: { marginTop: 4, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 },
  noIssue: {
    marginTop: 8,
    padding: 14,
    textAlign: 'center',
    color: 'var(--success)',
    fontSize: 12,
    background: 'rgba(var(--success-rgb),0.06)',
    borderRadius: 10,
    fontWeight: 500,
  },

  // —— B 模型改写建议 · 采纳交互 ——
  batchRow: {
    marginTop: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '9px 12px',
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'rgba(var(--accent-rgb),0.06)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  batchBtn: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
  },
  adoptedNote: {
    marginTop: 6,
    fontSize: 11,
    color: 'var(--success)',
    padding: '0 2px',
  },
  adoptWrap: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  adoptRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  adoptedTag: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--success)',
    background: 'rgba(var(--success-rgb),0.1)',
    borderRadius: 6,
    padding: '3px 8px',
  },
  bulletMissNote: {
    marginTop: 6,
    padding: '6px 10px',
    fontSize: 11,
    lineHeight: 1.5,
    color: 'var(--warning)',
    background: 'rgba(var(--warning-rgb),0.12)',
    border: '1px solid rgba(var(--warning-rgb),0.25)',
    borderRadius: 8,
  },
  viewFixBtn: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--accent)',
    borderRadius: 8,
    padding: '5px 12px',
    cursor: 'pointer',
  },
  adoptConfirmBtn: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
  },
  undoBtn: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '5px 10px',
    cursor: 'pointer',
  },
  linkBtn: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: 'none',
    padding: '4px 2px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  diffWrap: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  diffCol: {
    padding: 10,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    minWidth: 0,
  },
  diffColNew: {
    borderColor: 'rgba(var(--success-rgb),0.45)',
    background: 'rgba(var(--success-rgb),0.05)',
  },
  diffHead: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    marginBottom: 6,
  },
  diffTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 },
  diffBody: { fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 },
  diffBullets: {
    margin: '6px 0 0',
    paddingLeft: 16,
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
  },
  diffDel: {
    color: 'var(--error)',
    background: 'rgba(var(--error-rgb),0.16)',
    textDecoration: 'line-through',
    borderRadius: 2,
    padding: '0 1px',
  },
  diffAdd: {
    color: 'var(--success)',
    background: 'rgba(var(--success-rgb),0.18)',
    borderRadius: 2,
    padding: '0 1px',
  },

  // —— 提示词卡片 ——
  promptList: { display: 'flex', flexDirection: 'column', gap: 12 },
  promptCard: {
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow .2s',
  },
  pcHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface-2)',
  },
  pcLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  pcIndex: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 2,
  },
  pcIndexNum: {
    fontSize: 22,
    fontWeight: 700,
    background: 'var(--accent-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
  },
  pcTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-bright)',
    margin: 0,
    marginBottom: 2,
  },
  pcMeta: {
    fontSize: 11,
    color: 'var(--text-muted)',
    display: 'flex',
    gap: 6,
  },
  metaDot: { opacity: 0.5 },
  copyBtn: {
    fontSize: 12,
    background: 'var(--surface-3)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'all .2s',
    fontWeight: 500,
  },
  pcTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '10px 18px',
  },
  tag: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '3px 8px',
  },
  promptText: {
    margin: 0,
    fontSize: 12.5,
    lineHeight: 1.75,
    color: 'var(--text-secondary)',
    background: 'var(--surface-3)',
    padding: '16px 18px',
    borderTop: '1px solid var(--border)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: '"JetBrains Mono", "Noto Sans SC", monospace',
  },

  // —— Toast ——
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: 32,
    transform: 'translateX(-50%)',
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    color: 'var(--text)',
    border: '1px solid var(--border-2)',
    padding: '10px 20px',
    borderRadius: 12,
    fontSize: 13,
    boxShadow: 'var(--shadow-lg)',
    zIndex: 50,
    fontWeight: 500,
  },

  // —— 生成失败持久错误条 ——
  error: {
    marginTop: 14,
    padding: '12px 16px',
    borderRadius: 12,
    background: 'rgba(255, 80, 80, 0.12)',
    border: '1px solid var(--danger, #e5484d)',
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  errorHint: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
  },

  // —— 概念图谱 ——
  graphSection: {
    marginTop: 24,
    padding: 20,
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-md)',
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-bright)',
    margin: '0 0 16px 0',
  },
  moduleDetail: {
    marginTop: 16,
    padding: 16,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },
  moduleDetailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  moduleDetailIcon: {
    fontSize: 24,
  },
  moduleDetailTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-bright)',
  },
  moduleDetailType: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-3)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleDetailBody: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    marginBottom: 12,
  },
  moduleDetailList: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  btnActive: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
};
