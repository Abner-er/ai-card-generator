/**
 * decompose 回归测试
 *
 * 钉死的历史缺陷：
 *  - [B-1] HTTP 失败 / 输出不可解析时静默降级 mockDecompose——
 *          用户以为拿到 AI 拆解，实际是模板（与"URL 提取凭空编造"同根因）
 *  - [D]   seriesTitle 用 slice 硬截导致英文腰斩
 *  - mock 只允许从显式入口（opts.mock / settings.mock）进入
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { decomposeKnowledge } from './decompose';

function httpResp(ok: boolean, status: number, body: unknown, text = '') {
  return { ok, status, json: async () => body, text: async () => text };
}

function llmResp(content: string) {
  return httpResp(true, 200, { choices: [{ message: { content } }] });
}

afterEach(() => vi.unstubAllGlobals());

describe('decomposeKnowledge：失败必须显式抛错，不许伪装成功', () => {
  it('[B-1 回归] HTTP 5xx 抛「知识拆解失败」，而不是返回 mock 模板', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => httpResp(false, 500, null, 'Internal Server Error')));
    const p = decomposeKnowledge('Transformer 入门', { mock: false });
    await expect(p).rejects.toThrow(/知识拆解失败/);
  });

  it('[B-1 回归] 模型输出无法解析时抛「无法解析」，而不是静默给假结果', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => llmResp('抱歉，我无法完成这个任务。')));
    const p = decomposeKnowledge('Transformer 入门', { mock: false });
    await expect(p).rejects.toThrow(/无法解析/);
  });

  it('[B-1 回归] 解析出空模块列表同样抛错（modules 为空 = 失败）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => llmResp(JSON.stringify({ seriesTitle: 'X', modules: [] }))));
    const p = decomposeKnowledge('Transformer 入门', { mock: false });
    await expect(p).rejects.toThrow(/知识拆解失败/);
  });

  it('错误信息不被重复加前缀（内层已带「知识拆解失败」时不叠两层）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => httpResp(false, 500, null, 'boom')));
    const p = decomposeKnowledge('x', { mock: false });
    await expect(p).rejects.toThrow(/^知识拆解失败: 500/);
  });

  it('显式 mock:true 才走 mock 结构（cover 打头 + 自动分页）', async () => {
    const r = await decomposeKnowledge('Transformer', { mock: true });
    expect(r.modules[0].type).toBe('cover');
    expect(r.pages.length).toBeGreaterThan(0);
    expect(r.seriesTitle).toBe('Transformer');
  });

  it('[D 回归] seriesTitle 超长英文按词边界回退，不腰斩单词', async () => {
    const longTitle =
      'Introduction to Transformer Architecture and Attention Mechanisms';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        llmResp(
          JSON.stringify({
            seriesTitle: longTitle,
            modules: [{ id: 'm1', type: 'cover', title: '封面', body: '正文' }],
          }),
        ),
      ),
    );
    const r = await decomposeKnowledge('任意输入', { mock: false });
    // 默认上限 32：截断点落在 "Architecture" 中间 → 回退到 "Transformer"
    expect(r.seriesTitle).toBe('Introduction to Transformer');
  });

  it('[E] 模型输出 JSON 字符串内含裸换行时仍能解析（agnese 3.0 转义缺陷兜底）', async () => {
    // 模拟 3.0 在 string 值里直接塞真实换行（标准 JSON 非法），修复器应转义后解析成功
    const raw = `{
  "seriesTitle": "测试",
  "modules": [
    {"id":"m1","type":"cover","title":"封面","body":"第一行\n第二行这里有个真实换行","bullets":["要点一","要点二\n要点三"]}
  ],
  "pages": []
}`;
    vi.stubGlobal('fetch', vi.fn(async () => llmResp(raw)));
    const r = await decomposeKnowledge('任意输入', { mock: false });
    expect(r.modules.length).toBe(1);
    expect(r.modules[0].body).toContain('第二行');
  });

  it('[F 回归] 请求必须显式带 max_tokens（不设则 JSON 生成一半被截断 → 解析失败，历史根因）', async () => {
    let captured: any = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: any, init: any) => {
        captured = JSON.parse(init.body);
        return llmResp('{"seriesTitle":"X","modules":[{"id":"m1","type":"cover","title":"封面","body":"b"}]}');
      }),
    );
    const r = await decomposeKnowledge('任意输入', { mock: false });
    expect(r.modules.length).toBe(1);
    expect(captured.max_tokens).toBe(8000);
  });
});
