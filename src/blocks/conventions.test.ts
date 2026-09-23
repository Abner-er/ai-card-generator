/**
 * conventions.test.ts — 静态约定扫描（棘轮）
 *
 * 每条规则 = 一个历史缺陷的「一句话总结」。不测行为、只测写法：
 * 换任何主题、任何人新写代码，只要重新引入同类写法，npm run check 直接红。
 *
 *  - R1 [A-1] 禁 split(/\s+/).length 数字数——中文恒失真成 1，统一走 countChars
 *  - R2 [D]   禁 `.title.slice(0, N)` 硬截标题——英文腰斩，统一走 trimTitle；
 *             确属视觉宽度需要的（图节点标签、toast 里的 URL 等）同行标 allow-truncation 豁免
 *  - R3 [B]   禁 catch 后 return mock*()——失败静默降级假内容；
 *             确属产品需求的兜底同行标 allow-silent-fallback 豁免
 *  - R4 [E]   拆解提示词必须真正引用所选风格（buildSystemPrompt 声明了 style 参数，
 *             函数体就必须在提示词模板里用 ${style.xxx} 注入，否则用户选的风格传不到 LLM）
 *  - R5 [自检采纳断层] selfCheck 提示词必须保留"事实错误必给修正后完整 bullets"铁律，
 *             删掉它"一键采纳"就又改不掉错误要点（历史 bug：36 GHz 错值残留 B 版）
 *
 * 扫描范围：src/** 的 .ts/.tsx，排除 *.test.ts（本文件自身会提到这些模式）。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../', import.meta.url)); // src/

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC_DIR);

function violations(label: string, check: (line: string, i: number, lines: string[]) => boolean): string[] {
  const bad: string[] = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const s = line.trim();
      // 整行注释不参与扫描（注释里提到禁用模式是文档说明，不是违规写法）；
      // 代码行的行尾注释仍保留在 line 里，供 allow-* 豁免标记使用
      if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) return;
      if (check(line, i, lines)) {
        bad.push(`${relative(SRC_DIR, f)}:${i + 1}  [${label}]  ${line.trim()}`);
      }
    });
  }
  return bad;
}

describe('静态约定扫描：同类缺陷写法不得复活', () => {
  it('扫描至少覆盖到源码文件（防止路径配置失效导致空转）', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it('R1 [A-1] 不允许用 split(/\\s+/).length 数字数（中文必失真，统一 countChars）', () => {
    const bad = violations('R1 字数统计', (line) => /split\(\s*\/\\s\+\s*\/\s*\)\.length/.test(line));
    expect(bad, `中文文本没有空格，分词法数字数恒失真。请改用 textUtil.countChars：\n${bad.join('\n')}`).toEqual([]);
  });

  it('R2 [D] 标题值不允许 .title.slice(0,N) 硬截（英文必腰斩，统一 trimTitle）', () => {
    const bad = violations(
      'R2 标题截断',
      (line) => /\.title\.slice\(\s*0\s*,\s*\d+\s*\)/.test(line) && !line.includes('allow-truncation'),
    );
    expect(bad, `标题截断必须走 textUtil.trimTitle（词边界回退+去尾标点）。确属视觉截断请同行加 // allow-truncation 注释：\n${bad.join('\n')}`).toEqual([]);
  });

  it('R3 [B] catch 之后不允许 return mock*（失败必须显式抛错给调用方）', () => {
    const bad = violations(
      'R3 静默降级',
      (line, _i, lines) => {
        if (!/catch\s*[({]/.test(line) && !/\.catch\(/.test(line)) return false;
        const next = lines.slice(_i + 1, _i + 7);
        return next.some((l) => /return\s+mock\w*\s*\(/.test(l) && !l.includes('allow-silent-fallback'));
      },
    );
    expect(bad, `LLM/网络失败必须 throw，由 UI toast 给用户。mock 只能走显式 opts.mock/settings.mock 分支；确需静默兜底请标 allow-silent-fallback：\n${bad.join('\n')}`).toEqual([]);
  });

  it('R4 [E] 拆解提示词必须真正引用所选风格（buildSystemPrompt 不得吞掉 style 参数）', () => {
    const path = join(SRC_DIR, 'blocks', 'decompose.ts');
    const src = readFileSync(path, 'utf8');
    const fn = src.match(/function buildSystemPrompt\(style: ModuleStyle\): string \{([\s\S]*?)\n\}/);
    expect(fn, 'decompose.ts 应存在 buildSystemPrompt(style)').toBeTruthy();
    const body = fn![1];
    expect(
      body,
      `buildSystemPrompt 声明了 style 参数却没在提示词模板里用 \${style.xxx} 注入，用户选的风格会一直传不到 LLM（历史 bug：选手绘仍出 AI 建议风格）。请在系统提示词内把 preset.style 的 artStyle/palette/mood 等原样写进 seriesStyle 约束。`,
    ).toContain('${style.');
  });

  it('R5 [自检采纳断层] 自检提示词必须保留"事实错误必给修正后完整 bullets"铁律', () => {
    const path = join(SRC_DIR, 'blocks', 'selfCheck.ts');
    const src = readFileSync(path, 'utf8');
    // 历史 bug：自检只给 suggestion 不给修正后的完整 bullets，"一键采纳"改不掉错误要点
    // （如"36 GHz"错值残留在 B 版）。采纳逻辑只认 improvedModules.bullets，铁律不得被删。
    expect(
      src,
      `selfCheck.ts 的提示词必须包含铁律：确认要点(bullet)有事实错误时，"必须给出该模块修正后的完整 bullets"，否则一键采纳无法真正改掉内容。`,
    ).toContain('必须给出该模块修正后的完整 bullets');
  });
});
