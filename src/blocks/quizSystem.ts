/**
 * quizSystem.ts — 题库测验系统
 *
 * 支持单选题、多选题、判断题三种题型
 * 自动生成测验题目，支持评分和答案解析
 */

import type { KnowledgeModule } from './types';
import { getSettings } from './settings';

export type QuestionType = 'single' | 'multiple' | 'truefalse';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  question: string;
  options: string[];
  correctAnswers: number[]; // 多选题可能多个正确
  explanation: string;
  moduleId?: string;
}

export interface QuizAttempt {
  questionId: string;
  selectedAnswers: number[];
  isCorrect: boolean;
  timeSpent: number; // 毫秒
  answeredAt: string;
}

export interface QuizResult {
  totalQuestions: number;
  correctCount: number;
  score: number; // 百分比
  attempts: QuizAttempt[];
  completedAt: string;
  duration: number; // 总时长（秒）
}

/**
 * 根据知识模块生成测验题目
 */
export function generateQuizQuestions(
  modules: KnowledgeModule[],
  options: { count?: number; difficulty?: QuestionDifficulty } = {},
): QuizQuestion[] {
  const { count = Math.min(modules.length, getSettings().quiz.defaultCount), difficulty = getSettings().quiz.defaultDifficulty } = options;
  const questions: QuizQuestion[] = [];
  
  // 选取模块
  const selectedModules = selectRandomModules(modules, count);
  
  selectedModules.forEach((mod, idx) => {
    const qTypes: QuestionType[] = ['single', 'multiple', 'truefalse'];
    const qType = qTypes[idx % 3];
    
    const question = createQuestion(mod, qType, difficulty);
    questions.push(question);
  });
  
  return questions;
}

/**
 * 检查答案是否正确
 */
export function checkAnswer(
  question: QuizQuestion,
  selectedAnswers: number[],
): { isCorrect: boolean; explanation: string } {
  const correctSet = new Set(question.correctAnswers);
  const selectedSet = new Set(selectedAnswers);
  
  // 完全匹配才算正确
  const isCorrect = 
    correctSet.size === selectedSet.size &&
    [...correctSet].every(a => selectedSet.has(a));
  
  return {
    isCorrect,
    explanation: isCorrect 
      ? question.explanation 
      : `${question.explanation}\n\n正确答案：${getAnswerLabels(question, correctSet)}`,
  };
}

/**
 * 计算测验结果
 */
export function calculateQuizResult(
  questions: QuizQuestion[],
  attempts: QuizAttempt[],
): QuizResult {
  const totalQuestions = questions.length;
  const correctCount = attempts.filter(a => a.isCorrect).length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const completedAt = new Date().toISOString();
  
  // 计算总时长
  const duration = attempts.reduce((sum, a) => sum + a.timeSpent, 0) / 1000;
  
  return {
    totalQuestions,
    correctCount,
    score,
    attempts,
    completedAt,
    duration,
  };
}

/**
 * 导出测验结果为 JSON
 */
export function exportQuizResult(result: QuizResult, title: string = '测验结果'): object {
  return {
    title,
    exportedAt: new Date().toISOString(),
    score: result.score,
    totalQuestions: result.totalQuestions,
    correctCount: result.correctCount,
    duration: Math.round(result.duration),
    attempts: result.attempts.map(a => ({
      questionId: a.questionId,
      selectedAnswers: a.selectedAnswers,
      isCorrect: a.isCorrect,
      timeSpent: Math.round(a.timeSpent / 1000),
      answeredAt: a.answeredAt,
    })),
  };
}

// ===================== 辅助函数 =====================

function selectRandomModules(modules: KnowledgeModule[], count: number): KnowledgeModule[] {
  const shuffled = [...modules].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function createQuestion(
  mod: KnowledgeModule,
  type: QuestionType,
  difficulty: QuestionDifficulty,
): QuizQuestion {
  const id = `q-${mod.id}-${type}`;
  
  switch (type) {
    case 'single':
      return createSingleChoice(mod, difficulty);
    case 'multiple':
      return createMultipleChoice(mod, difficulty);
    case 'truefalse':
      return createTrueFalse(mod, difficulty);
  }
}

function createSingleChoice(mod: KnowledgeModule, difficulty: QuestionDifficulty): QuizQuestion {
  const options = generateOptions(mod, 4);
  const correctIndex = Math.floor(Math.random() * 4);
  
  return {
    id: `q-${mod.id}-single`,
    type: 'single',
    difficulty,
    question: `关于"${mod.title}"，下列说法正确的是？`,
    options,
    correctAnswers: [correctIndex],
    explanation: getExplanation(mod, options[correctIndex]),
    moduleId: mod.id,
  };
}

function createMultipleChoice(mod: KnowledgeModule, difficulty: QuestionDifficulty): QuizQuestion {
  const bulletCount = mod.bullets?.length || 2;
  const correctCount = Math.min(2, Math.max(2, bulletCount));
  const optionCount = Math.max(bulletCount + 2, correctCount + 1);
  const options = generateOptions(mod, optionCount);
  // 用 Set 确保不重复，最多取 correctCount 个
  const correctIndices: number[] = [];
  const used = new Set<number>();
  while (correctIndices.length < correctCount && correctIndices.length < options.length) {
    const r = Math.floor(Math.random() * options.length);
    if (!used.has(r)) {
      used.add(r);
      correctIndices.push(r);
    }
  }
  
  return {
    id: `q-${mod.id}-multiple`,
    type: 'multiple',
    difficulty,
    question: `关于"${mod.title}"，以下哪些说法是正确的？（多选）`,
    options,
    correctAnswers: correctIndices,
    explanation: getExplanation(mod, options.join('；')),
    moduleId: mod.id,
  };
}

function createTrueFalse(mod: KnowledgeModule, difficulty: QuestionDifficulty): QuizQuestion {
  const isTrue = Math.random() > 0.5;
  
  return {
    id: `q-${mod.id}-truefalse`,
    type: 'truefalse',
    difficulty,
    question: isTrue 
      ? `"${mod.title}：${mod.body.slice(0, 50)}${mod.body.length > 50 ? '...' : ''}"`
      : `"${mod.title}：${mod.body.slice(0, 30)}完全不重要"`,
    options: ['正确', '错误'],
    correctAnswers: isTrue ? [0] : [1],
    explanation: isTrue 
      ? `这是关于 ${mod.title} 的正确描述`
      : `这个描述与 ${mod.title} 的实际情况不符`,
    moduleId: mod.id,
  };
}

function generateOptions(mod: KnowledgeModule, count: number): string[] {
  const options: string[] = [];
  
  // 生成干扰项
  for (let i = 0; i < count - 1; i++) {
    options.push(`选项 ${String.fromCharCode(65 + i)}：这是关于 ${mod.title} 的干扰项描述`);
  }
  
  // 正确答案基于模块内容
  const correctAnswer = mod.bullets?.[0] || mod.body.slice(0, 50);
  options.push(correctAnswer);
  
  return options.sort(() => Math.random() - 0.5);
}

function getExplanation(mod: KnowledgeModule, answer: string): string {
  return `【${mod.title}】${mod.body}\n\n${answer}是正确答案的关键点。`;
}

function getAnswerLabels(question: QuizQuestion, correctSet: Set<number>): string {
  return [...correctSet].map(i => String.fromCharCode(65 + i)).join('、');
}
