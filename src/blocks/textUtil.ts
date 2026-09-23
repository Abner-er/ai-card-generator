/**
 * blocks/textUtil.ts — 文本处理共享规则
 *
 * 这里集中放「标题截断」和「字数统计」两条全局规则。
 * 历史上多处代码各自写了 slice(0, N) 硬截断和 split(/\s+/) 字数统计，
 * 换到中英语混合/纯中文主题时就出 bug（"Wi-Fi 8 vs Wi-Fi 7 v" 断词、
 * 中文文章字数恒等于 1）。所有涉及标题、字数的地方一律走本文件，
 * 新代码不要再手写同类逻辑（conventions 回归测试会扫描拦截）。
 */

/** 标题智能截断：
 * - 中文信息密度高，默认上限 32（可按场景收紧）；
 * - 若切断点落在英文/数字单词中间，回退到上一个空格，避免 "…7 v" 式断词；
 * - 去掉结尾悬挂的标点（，。、,;:!? 等），避免截出半句话。
 */
export function trimTitle(raw: unknown, fallback = '', limit = 32): string {
  const t = String(raw ?? '').trim();
  if (!t) return fallback;
  if (t.length <= limit) return t;
  let cut = t.slice(0, limit);
  const nextCh = t[limit];
  const lastCh = cut[cut.length - 1];
  // 切断点两侧都是词字符 → 落在单词内部，回退到最近空格
  if (/[A-Za-z0-9]/.test(nextCh) && /[A-Za-z0-9&%.+\-]/.test(lastCh)) {
    const sp = cut.lastIndexOf(' ');
    if (sp > 6) cut = cut.slice(0, sp);
  }
  return cut.replace(/[，。、,;；:：!！？\s]+$/, '') || fallback;
}

/** 字数统计：非空白字符数。中文一字计一，英文按字母计（近似可读字数）。
 * 禁止再用 text.split(/\s+/).length —— 对无空格分隔的中文恒等于 1。 */
export function countChars(text: string): number {
  return String(text ?? '').replace(/\s/g, '').length;
}
