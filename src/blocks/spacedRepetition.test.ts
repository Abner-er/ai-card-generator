/**
 * spacedRepetition.test.ts — mergeGeneratedCards 回归测试
 *
 * 历史 bug：第二次生成系列时模块 id（m1/m2…）与第一次重复，
 * 旧逻辑按 id 去重把新卡整组静默丢弃 → 系列组复习为空、toast 虚报添加数。
 */
import { describe, it, expect } from 'vitest';
import type { SM2Card } from './spacedRepetition';
import { mergeGeneratedCards } from './spacedRepetition';

function card(id: string, source?: string, over: Partial<SM2Card> = {}): SM2Card {
  return {
    id,
    question: `Q-${id}`,
    answer: `A-${id}`,
    nextReview: new Date().toISOString(),
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    createdAt: new Date().toISOString(),
    status: 'new',
    source,
    ...over,
  };
}

describe('mergeGeneratedCards', () => {
  it('跨系列撞 id（m1 重复）不得丢卡：两个系列的卡全部共存', () => {
    const seriesA = [card('card-gA-m1', '系列A'), card('card-gA-m2', '系列A')];
    const seriesB = [card('card-gB-m1', '系列B'), card('card-gB-m2', '系列B')];
    const merged = mergeGeneratedCards(seriesA, seriesB);
    expect(merged).toHaveLength(4);
    expect(merged.map((c) => c.id).sort()).toEqual(
      ['card-gA-m1', 'card-gA-m2', 'card-gB-m1', 'card-gB-m2'].sort(),
    );
  });

  it('同名系列重生成 = 整组替换，不留旧版本', () => {
    const oldA = [card('card-gA-m1', '系列A'), card('card-gA-m2', '系列A')];
    const keepB = [card('card-gB-m1', '系列B')];
    const regenA = [card('card-gC-m1', '系列A', { question: '新问题' })];
    const merged = mergeGeneratedCards([...oldA, ...keepB], regenA);
    expect(merged).toHaveLength(2);
    const aCards = merged.filter((c) => c.source === '系列A');
    expect(aCards).toHaveLength(1);
    expect(aCards[0].id).toBe('card-gC-m1');
    expect(aCards[0].question).toBe('新问题');
  });

  it('无 source 的历史/种子卡不受替换影响；空生成结果原样返回', () => {
    const legacy = [card('card-m1'), card('seed-1')];
    expect(mergeGeneratedCards(legacy, [card('card-gD-m1', '新系列')])).toHaveLength(3);
    expect(mergeGeneratedCards(legacy, [])).toBe(legacy);
  });
});
