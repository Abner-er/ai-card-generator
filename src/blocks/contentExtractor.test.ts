/**
 * contentExtractor 回归测试
 *
 * 钉死的历史缺陷：
 *  - [A-1] 字数统计用 split(/\s+/).length → 中文正文 wordCount 恒等于 1
 *  - [B]   提取失败（HTTP 错误 / 空正文）静默返回假内容
 *  - [C]   smartExtract 死代码链路（零调用 + 失败降级启发式）永久杜绝
 *  - [D]   detectTitle 末路用 slice 硬截 → 英文标题腰斩
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import * as contentExtractor from './contentExtractor';
import { extractFromURL, extractFromMarkdown } from './contentExtractor';
import { countChars } from './textUtil';

function httpResp(ok: boolean, status: number, body: unknown) {
  return { ok, status, json: async () => body, text: async () => '' };
}

afterEach(() => vi.unstubAllGlobals());

describe('extractFromURL：失败显式抛错，成功口径正确', () => {
  it('[B 回归] 代理返回错误时抛出接口给定的 error，而不是空结果', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => httpResp(false, 502, { error: '目标站点连接超时' })));
    await expect(
      extractFromURL('https://example.com/a', { mock: false }),
    ).rejects.toThrow('目标站点连接超时');
  });

  it('[B 回归] HTTP 错误且无 error 字段时抛带状态码的错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => httpResp(false, 500, null)));
    await expect(
      extractFromURL('https://example.com/a', { mock: false }),
    ).rejects.toThrow(/网页抓取失败（HTTP 500）/);
  });

  it('[B 回归] 正文为空抛「未能提取到正文」，绝不返回空白内容装作成功', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => httpResp(true, 200, { title: 'X', content: '  \n\n  ' })));
    await expect(
      extractFromURL('https://example.com/a', { mock: false }),
    ).rejects.toThrow(/未能提取到正文/);
  });

  it('[A-1 回归] 中文正文 wordCount = 非空白字符数（旧算法会算成 1 词）', async () => {
    const cn = 'Wi-Fi 8 是下一代无线局域网技术，它将带来更快的速度和更低的延迟。';
    vi.stubGlobal('fetch', vi.fn(async () => httpResp(true, 200, { title: '标题', content: cn })));
    const r = await extractFromURL('https://example.com/a', { mock: false });
    expect(r.wordCount).toBe(countChars(cn));
    expect(r.wordCount).toBeGreaterThan(20); // 旧算法 split(/\s+/).length 只有 5
  });

  it('[D 回归] 无 title 时 detectTitle 取首行并按词边界截断', async () => {
    const first = 'Introduction to Transformer Architecture and Attention Mechanisms Explained';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => httpResp(true, 200, { title: '', content: first + '\n更多正文内容' })),
    );
    const r = await extractFromURL('https://example.com/a', { mock: false });
    expect(r.title).toBe('Introduction to Transformer');
    expect(r.title).not.toMatch(/Arch/); // 单词没被腰斩成 "…Arch"
  });

  it('正文里以 - / # 开头的行不被当 markdown 删掉（只折叠空行）', async () => {
    const content = '- 第一条要点\n# 这不是标题而是内容\n第二条内容';
    vi.stubGlobal('fetch', vi.fn(async () => httpResp(true, 200, { title: 'T', content })));
    const r = await extractFromURL('https://example.com/a', { mock: false });
    expect(r.content).toContain('- 第一条要点');
    expect(r.content).toContain('# 这不是标题而是内容');
  });

  it('显式 mock 模式返回示例数据（mock 只从显式入口进入）', async () => {
    const r = await extractFromURL('https://example.com', { mock: true });
    expect(r.title).toBe('示例网页内容');
    expect(r.sourceType).toBe('url');
  });
});

describe('extractFromMarkdown：markdown 口径', () => {
  it('[A-1 回归] wordCount 数的是非空白字符，不再是分词数（中文旧口径会算成个位数）', async () => {
    const md = '# 标题\n\n这是一段没有任何空格分隔的中文正文用来验证字数统计口径。';
    const r = await extractFromMarkdown(md);
    // 28 个非空白字符（27 汉字 + 1 句号）；旧算法 split(/\s+/).length 清完标题行后只剩 1
    expect(r.wordCount).toBe(28);
  });
});

describe('死代码链路（C 类）永久杜绝', () => {
  it('[C 回归] smartExtract 死函数已从源码中删除且不再导出', () => {
    const src = readFileSync(new URL('./contentExtractor.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/function\s+smartExtract/);
    expect(src).not.toMatch(/useLLM/);
    expect((contentExtractor as Record<string, unknown>).smartExtract).toBeUndefined();
  });
});
