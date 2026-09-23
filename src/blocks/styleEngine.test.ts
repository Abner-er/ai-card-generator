/**
 * styleEngine 生图提示词标题回归测试
 *
 * 钉死的历史缺陷：
 *  生图 prompt 里副标题只写「下方一行副标题」抽象占位、不给具体文字，
 *  生图模型每次自行发挥 → 同一张多次生成副标题漂移。
 */
import { describe, it, expect } from 'vitest';
import { buildPagePrompt, buildAnchorPrompt } from './styleEngine';
import type { ModuleStyle } from './types';

const style: ModuleStyle = {
  artStyle: '扁平插画',
  palette: '蓝灰',
  mood: '专业',
  typography: '圆润手写',
  lighting: '柔和',
  camera: '平视',
  material: '手绘线',
};

describe('生图提示词标题固定（防副标题漂移回归）', () => {
  it('内容页：副标题固定为系列标题，且带「不得更改」约束', () => {
    const p = buildPagePrompt(
      { title: '注意力机制', ratio: '3:4' },
      [{ type: 'definition', title: '注意力', body: '正文', bullets: [], icon: '' }],
      style,
      { seriesTitle: 'Transformer 图解' },
    );
    expect(p).toContain('大号主标题「注意力机制」');
    expect(p).toContain('下方一行副标题「Transformer 图解」');
    expect(p).toContain('此副标题文字为固定内容');
  });

  it('封面页：副标题用固定定位文案，不与系列主标题重复', () => {
    const p = buildPagePrompt(
      { title: '封面', ratio: '3:4' },
      [{ type: 'cover', title: '封面', body: '正文', bullets: [], icon: '' }],
      style,
      { seriesTitle: 'Transformer 图解', totalPages: 4 },
    );
    expect(p).toContain('大号主标题「Transformer 图解」');
    expect(p).toContain('下方一行副标题「知识图解 · 4 页」');
  });

  it('风格锚点图：副标题固定为系列定位文案并约束不得改字', () => {
    const p = buildAnchorPrompt('Transformer 图解', style);
    expect(p).toContain('下方一行副标题「知识图解 · 全系列」');
    expect(p).toContain('不得更改或临场发挥');
  });

  it('页面与锚点底部总结：须带固定格式约束，防悬空占位（仍由模型写，但版式定死）', () => {
    const page = buildPagePrompt(
      { title: '注意力机制', ratio: '3:4' },
      [{ type: 'definition', title: '注意力', body: '正文', bullets: [], icon: '' }],
      style,
      { seriesTitle: 'Transformer 图解' },
    );
    expect(page).toContain('固定格式：只能是一句连贯的话');
    expect(page).toContain('不得写成列表');

    const anchor = buildAnchorPrompt('Transformer 图解', style);
    expect(anchor).toContain('固定格式：只能是一句连贯的话');
  });
});