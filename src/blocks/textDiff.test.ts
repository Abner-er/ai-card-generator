import { describe, it, expect } from 'vitest';
import { diffTokens } from './textDiff';

describe('diffTokens', () => {
  it('[D-diff-1] 完全相同 → 全部 same，且从左到右贯通', () => {
    const toks = diffTokens('WiFi 7', 'WiFi 7');
    expect(toks.every(t => t.kind === 'same')).toBe(true);
    expect(toks.map(t => t.text).join('')).toBe('WiFi 7');
  });

  it('[D-diff-2] 全书替换 → 左全 del、右全 add（删/增分别只在各自一侧出现）', () => {
    const toks = diffTokens('abc def', 'xyz');
    const left = toks.filter(t => t.kind !== 'add').map(t => t.text).join('');
    const right = toks.filter(t => t.kind !== 'del').map(t => t.text).join('');
    expect(left).toBe('abc def');
    expect(right).toBe('xyz');
    expect(toks.some(t => t.kind === 'del')).toBe(true);
    expect(toks.some(t => t.kind === 'add')).toBe(true);
  });

  it('[D-diff-3] 知识订正（图里 36GHz）→ 旧值标 del、新值标 add，公共部分保留 same', () => {
    // 题设场景：Wi-Fi 7 频段由 “36 GHz 频谱” 改为 “2.4/5/6 GHz 频段”
    const toks = diffTokens('Wi-Fi 7: 36 GHz 频谱', 'Wi-Fi 7: 2.4/5/6 GHz 频段');
    const delText = toks.filter(t => t.kind === 'del').map(t => t.text).join('');
    const addText = toks.filter(t => t.kind === 'add').map(t => t.text).join('');
    // 旧错误值 “36” 应被删除，纠正值 “2.4/5/6” 应被新增
    expect(delText).toContain('36');
    expect(delText).toContain('谱');          // “频谱”→“频段”：尾字变化
    expect(addText).toContain('2.4');
    expect(addText).toContain('段');
    // 两版共有的 “GHz” 必须保留为 same，不能误删（这是订正保留的常识信息）
    const delHasGHz = toks.some(t => t.kind === 'del' && t.text.includes('GHz'));
    expect(delHasGHz).toBe(false);
  });

  it('[D-diff-4] 中文改写（既有词变化）', () => {
    const toks = diffTokens('支持 320MHz 信道', '支持 320MHz 信道和 4K-QAM');
    const addText = toks.filter(t => t.kind === 'add').map(t => t.text).join('');
    expect(addText).toContain('4K-QAM');
    const delText = toks.filter(t => t.kind === 'del').map(t => t.text).join('');
    expect(delText).toBe('');
  });

  it('[D-diff-5] 空串安全', () => {
    expect(diffTokens('', '').length).toBe(0);
    const toks = diffTokens('', '新增内容');
    expect(toks.every(t => t.kind === 'add')).toBe(true);
  });

  it('[D-diff-6] 英文数字连写词不被拆碎（4K-QAM、320MHz 是整体）', () => {
    const toks = diffTokens('4K-QAM', '4K-QAM');
    const joined = toks.filter(t => t.kind === 'same').map(t => t.text).join('');
    expect(joined).toBe('4K-QAM');
  });
});