/**
 * textUtil 回归测试
 *
 * 钉死的历史缺陷：
 *  - [D-1] decompose.ts 用 slice(0, 20) 截标题 → "Wi-Fi 8 vs Wi-Fi 7 v"（英文单词被腰斩）
 *  - [D-2] 截断后结尾悬挂标点/空格
 *  - [A-1] 字数统计用 split(/\s+/).length → 中文文章恒等于 1
 */
import { describe, it, expect } from 'vitest';
import { trimTitle, countChars } from './textUtil';

describe('trimTitle：任何语言的标题截断都不许腰斩', () => {
  it('[D-1 回归] 切断点落在英文单词中间时回退到词边界', () => {
    // 用户截图里的真实案例：20 字硬截正好切在 "version" 的 v 上
    const t = 'Wi-Fi 8 vs Wi-Fi 7 version comparison guide for everyone';
    expect(trimTitle(t, '', 20)).toBe('Wi-Fi 8 vs Wi-Fi 7');
  });

  it('[D-1 回归] 版本号含空格/&/-/. 的词组不被拆散', () => {
    const t = 'R&D budget for Q3 hit 2.5 billion dollars last fiscal year';
    const cut = trimTitle(t, '', 13);
    // "R&D budget for…" 切在 "for" 中间 → 必须回退到完整词 "R&D budget"
    expect(cut).toBe('R&D budget');
  });

  it('中文标题按长度截断即可（中文没有词边界）', () => {
    const t = '这是一段非常长的中文标题用来测试截断行为是否符合预期应该没问题吧';
    expect(trimTitle(t, '', 20)).toBe(t.slice(0, 20).replace(/[，。]+$/, ''));
  });

  it('[D-2 回归] 截断后结尾悬挂的标点/空格被清掉', () => {
    const t = '为什么工作越久，赚钱越难？这是正文的更多内容，远超截断上限了还有一堆';
    const cut = trimTitle(t, '', 13); // 第13字正好是"？"
    // 中文无词边界，按长度截；结尾悬挂的"？"被清掉，保留到"难"
    expect(cut).toBe('为什么工作越久，赚钱越难');
    expect(cut).not.toMatch(/[，。、,;；:：!！?\s]$/);
  });

  it('未超上限的标题原样返回（短英文标题不许被动过）', () => {
    expect(trimTitle('Wi-Fi 8 开卖')).toBe('Wi-Fi 8 开卖');
    expect(trimTitle('Transformer')).toBe('Transformer');
  });

  it('空值/全空格返回 fallback', () => {
    expect(trimTitle(undefined, '知识图解')).toBe('知识图解');
    expect(trimTitle('   ', '知识图解')).toBe('知识图解');
    expect(trimTitle(null, 'FB')).toBe('FB');
  });

  it('截断后只剩标点时返回 fallback 而不是空串', () => {
    expect(trimTitle('，。、，。、abcdef', 'FB', 3)).toBe('FB');
  });
});

describe('countChars：中英文混合的字数口径统一', () => {
  it('[A-1 回归] 纯中文文章字数不再是 1（split(/\\s+/) 的历史失真）', () => {
    const cn = '职场沟通需要掌握很多技巧';
    expect(cn.split(/\s+/).length).toBe(1); // 旧算法的失真实证
    expect(countChars(cn)).toBe(12);
  });

  it('空白字符不计入', () => {
    expect(countChars('hello world 你好')).toBe(12);
  });

  it('空串为 0', () => {
    expect(countChars('')).toBe(0);
  });
});
