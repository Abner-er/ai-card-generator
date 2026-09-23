/**
 * spacedRepetition.ts — SM-2 间隔重复算法
 *
 * 实现 Anki 核心算法，根据用户自评结果动态计算下次复习时间
 * 算法参数（初始难度因子、下限、简单加成）来自后台管理 → 学习参数
 */
import { getSettings } from './settings';

export interface SM2Card {
  id: string;
  question: string;
  answer: string;
  /** 上次复习日期（ISO 字符串） */
  lastReview?: string;
  /** 下次复习日期（ISO 字符串） */
  nextReview: string;
  /** 难度间隔（0-5，0=完全不懂，5=完美记住） */
  easeFactor: number;
  /** 当前间隔天数 */
  interval: number;
  /** 连续正确次数（用于快速判定） */
  repetitions: number;
  /** 卡片创建时间 */
  createdAt: string;
  /** 状态：new/learning/graduating/mastered */
  status: CardStatus;
  /** 来源系列标题：用于「只复习这一组」过滤与卡片归属展示（旧数据可能缺失） */
  source?: string;
  /** 是否有对应的图文卡原图（IndexedDB 中存有该卡 id 对应图片时为 true） */
  hasImage?: boolean;
}

export type CardStatus = 'new' | 'learning' | 'graduating' | 'mastered';

export interface ReviewResult {
  /** 用户评分：0=再次学习，1=困难，2=正常，3=简单 */
  rating: 0 | 1 | 2 | 3;
  /** 更新后的卡片数据 */
  card: SM2Card;
}

/**
 * 合并新生成的闪卡进已有卡片库（历史 bug：旧逻辑按 id 去重丢弃，
 * 而模块 id 是 m1/m2… 跨系列重复，导致第二次生成的整组卡被静默丢掉、
 * 系列组复习变空）。新语义：同名系列重生成 = 整组替换（内容变了就该看到新卡），
 * 不同系列互不影响。
 */
export function mergeGeneratedCards(prev: SM2Card[], generated: SM2Card[]): SM2Card[] {
  if (generated.length === 0) return prev;
  const sources = new Set(generated.map((c) => c.source).filter((s): s is string => !!s));
  return [...prev.filter((c) => !(c.source && sources.has(c.source))), ...generated];
}

export function createSM2Card(id: string, question: string, answer: string): SM2Card {
  const now = new Date().toISOString();
  return {
    id,
    question,
    answer,
    nextReview: now,
    easeFactor: getSettings().study.initialEase,
    interval: 0,
    repetitions: 0,
    createdAt: now,
    status: 'new',
  };
}

export function reviewCard(card: SM2Card, rating: 0 | 1 | 2 | 3): ReviewResult {
  const { easeFactor, interval, repetitions } = card;
  const { minEase, easyBonus } = getSettings().study;

  let newEase = easeFactor;
  let newInterval = interval;
  let newRepetitions = repetitions;
  let newStatus: CardStatus = card.status;

  // SM-2 算法核心逻辑
  if (rating === 0) {
    // 再次学习：重置间隔
    newRepetitions = 0;
    newInterval = 1;
    newEase = Math.max(minEase, easeFactor - 0.2);
    newStatus = 'learning';
  } else if (rating === 1) {
    // 困难：间隔增长慢，难度降低
    newRepetitions += 1;
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newEase = Math.max(minEase, easeFactor - 0.15);
    newStatus = repetitions >= 2 ? 'graduating' : 'learning';
  } else if (rating === 2) {
    // 正常：按标准间隔增长
    newRepetitions += 1;
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newStatus = repetitions >= 2 ? 'graduating' : 'learning';
  } else {
    // 简单：间隔快速增长
    newRepetitions += 1;
    if (repetitions === 0) {
      newInterval = 3;
    } else if (repetitions === 1) {
      newInterval = 10;
    } else {
      newInterval = Math.round(interval * easeFactor * easyBonus);
    }
    newEase = easeFactor + 0.15;
    newStatus = 'mastered';
  }

  // 确保间隔为正整数
  newInterval = Math.max(1, newInterval);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    rating,
    card: {
      ...card,
      lastReview: new Date().toISOString(),
      easeFactor: parseFloat(newEase.toFixed(2)),
      interval: newInterval,
      repetitions: newRepetitions,
      status: newStatus,
      nextReview: nextReview.toISOString(),
    },
  };
}

/** 到期卡片队列：按到期时间升序 = 逾期最久的优先（Anki 同款策略），而非随机 */
export function getDueCards(cards: SM2Card[], now = new Date()): SM2Card[] {
  return cards
    .filter(c => new Date(c.nextReview) <= now)
    .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());
}

export function getStats(cards: SM2Card[]): {
  total: number;
  due: number;
  new: number;
  learning: number;
  graduating: number;
  mastered: number;
  streak: number;
} {
  const now = new Date();
  const due = getDueCards(cards, now).length;
  
  // 计算连续学习天数（简化版：看是否有最近7天内的复习记录）
  let streak = 0;
  const lastReviewDate = cards.reduce((latest, c) => {
    if (!c.lastReview) return latest;
    const d = new Date(c.lastReview);
    return d > latest ? d : latest;
  }, new Date(0));
  
  if (lastReviewDate.getTime() > 0) {
    const diffDays = Math.floor((now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) streak = 1; // 今天或昨天有学习
  }

  return {
    total: cards.length,
    due,
    new: cards.filter(c => c.status === 'new').length,
    learning: cards.filter(c => c.status === 'learning').length,
    graduating: cards.filter(c => c.status === 'graduating').length,
    mastered: cards.filter(c => c.status === 'mastered').length,
    streak,
  };
}
