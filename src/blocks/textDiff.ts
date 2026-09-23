/** diffTokens — 字符级 LCS 差异。中文按单字、英文/数字按下划线相连词整体，其余单字符兜底 */
export type DiffToken = { kind: 'same' | 'del' | 'add'; text: string };

export function diffTokens(a: string, b: string): DiffToken[] {
  const toks = (s: string): string[] =>
    s.match(/[\u4e00-\u9fff]|[a-zA-Z0-9]+(?:[.%\-][a-zA-Z0-9]+)*|\s+|./g) ?? [];
  const ta = toks(a);
  const tb = toks(b);
  const n = ta.length;
  const m = tb.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = ta[i - 1] === tb[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const out: DiffToken[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ta[i - 1] === tb[j - 1]) { out.push({ kind: 'same', text: ta[i - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { out.push({ kind: 'add', text: tb[j - 1] }); j--; }
    else { out.push({ kind: 'del', text: ta[i - 1] }); i--; }
  }
  return out.reverse();
}