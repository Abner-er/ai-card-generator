/**
 * QuizView.tsx — 题库测验视图组件
 *
 * 支持单选题、多选题、判断题三种题型
 */
import { useState, useEffect } from 'react';
import type { QuizQuestion, QuizAttempt, QuizResult } from './blocks/quizSystem';
import { generateQuizQuestions, checkAnswer, calculateQuizResult, exportQuizResult } from './blocks/quizSystem';
import type { KnowledgeModule } from './blocks/types';

interface QuizViewProps {
  modules: KnowledgeModule[];
  onBack: () => void;
  onToast: (msg: string) => void;
}

export default function QuizView({ modules, onBack, onToast }: QuizViewProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [startTime] = useState(Date.now());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // 初始化题目
  const initQuiz = () => {
    const qs = generateQuizQuestions(modules, { count: Math.min(modules.length, 10) });
    setQuestions(qs);
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setAttempts([]);
    setResult(null);
    setShowExplanation(false);
  };

  // 加载初始题目
  useEffect(() => {
    if (modules.length > 0 && questions.length === 0) {
      initQuiz();
    }
  }, [modules]); // eslint-disable-line react-hooks/exhaustive-deps

  // 当前题目
  const currentQuestion = questions[currentIndex];

  // 处理选项点击
  const handleOptionClick = (optionIndex: number) => {
    if (showExplanation) return;

    if (currentQuestion.type === 'single' || currentQuestion.type === 'truefalse') {
      setSelectedAnswers([optionIndex]);
    } else {
      // 多选：切换选中状态
      setSelectedAnswers(prev => 
        prev.includes(optionIndex)
          ? prev.filter(i => i !== optionIndex)
          : [...prev, optionIndex]
      );
    }
  };

  // 提交答案
  const handleSubmit = () => {
    if (!currentQuestion || selectedAnswers.length === 0) return;

    const { isCorrect, explanation } = checkAnswer(currentQuestion, selectedAnswers);
    const timeSpent = Date.now() - startTime - attempts.reduce((sum, a) => sum + a.timeSpent, 0);

    const attempt: QuizAttempt = {
      questionId: currentQuestion.id,
      selectedAnswers,
      isCorrect,
      timeSpent,
      answeredAt: new Date().toISOString(),
    };

    setAttempts(prev => [...prev, attempt]);
    setShowExplanation(true);
  };

  // 下一题
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswers([]);
      setShowExplanation(false);
    } else {
      // 完成测验：attempts 里已经有最后一题的记录（handleSubmit 时已添加）
      const quizResult = calculateQuizResult(questions, attempts);
      setResult(quizResult);
    }
  };

  // 导出结果
  const handleExport = () => {
    const content = JSON.stringify(exportQuizResult(result!, '知识测验'), null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-result.json';
    a.click();
    URL.revokeObjectURL(url);
    onToast('已导出测验结果');
  };

  if (result) {
    return (
      <QuizResultView 
        result={result} 
        onRetry={initQuiz}
        onBack={onBack}
        onExport={handleExport}
      />
    );
  }

  if (!currentQuestion) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📝</div>
        <h2>暂无题目</h2>
        <p>当前没有可生成的题目，请先输入知识内容</p>
        <button style={styles.backBtn} onClick={onBack}>返回</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 顶部进度 */}
      <div style={styles.progressHeader}>
        <span style={styles.progressText}>
          第 {currentIndex + 1} 题 / 共 {questions.length} 题
        </span>
        <div style={styles.progressBar}>
          <div 
            style={{ 
              ...styles.progressFill, 
              width: `${((currentIndex + 1) / questions.length) * 100}%` 
            }} 
          />
        </div>
      </div>

      {/* 题目卡片 */}
      <div style={styles.questionCard}>
        {/* 题型标签 */}
        <div style={styles.questionMeta}>
          <span style={typeBadgeStyle(currentQuestion.type)}>
            {typeLabel(currentQuestion.type)}
          </span>
          <span style={difficultyBadgeStyle(currentQuestion.difficulty)}>
            {currentQuestion.difficulty}
          </span>
        </div>

        {/* 题目内容 */}
        <h3 style={styles.questionTitle}>{currentQuestion.question}</h3>

        {/* 选项列表 */}
        <div style={styles.optionsList}>
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedAnswers.includes(idx);
            const isCorrect = currentQuestion.correctAnswers.includes(idx);
            const showResult = showExplanation;
            
            let optionStyle = styles.option;
            if (showResult) {
              if (isCorrect) optionStyle = styles.optionCorrect;
              else if (isSelected && !isCorrect) optionStyle = styles.optionWrong;
            } else if (isSelected) {
              optionStyle = styles.optionSelected;
            }

            return (
              <button
                key={idx}
                style={optionStyle}
                onClick={() => handleOptionClick(idx)}
                disabled={showExplanation}
              >
                <span style={styles.optionLetter}>{String.fromCharCode(65 + idx)}</span>
                <span style={styles.optionText}>{option}</span>
                {showResult && isCorrect && <span style={styles.optionCheck}>✓</span>}
                {showResult && isSelected && !isCorrect && <span style={styles.optionX}>✗</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 解析面板 */}
      {showExplanation && (
        <div style={styles.explanationCard}>
          <div style={styles.explanationHeader}>
            <span style={styles.explanationIcon}>💡</span>
            <span style={styles.explanationTitle}>解析</span>
          </div>
          <p style={styles.explanationText}>{currentQuestion.explanation}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={styles.actions}>
        {!showExplanation ? (
          <button 
            style={{ 
              ...styles.submitBtn, 
              ...(selectedAnswers.length === 0 ? styles.disabledBtn : {}) 
            }}
            onClick={handleSubmit}
            disabled={selectedAnswers.length === 0}
          >
            提交答案
          </button>
        ) : (
          <button style={styles.nextBtn} onClick={handleNext}>
            {currentIndex < questions.length - 1 ? '下一题 →' : '查看结果'}
          </button>
        )}
      </div>

      {/* 快捷键提示 */}
      <div style={styles.shortcuts}>
        <kbd>1-4</kbd> 选择选项
        <span style={{ margin: '0 8px', opacity: 0.5 }}>·</span>
        <kbd>Enter</kbd> 提交/下一题
      </div>
    </div>
  );
}

function QuizResultView({ 
  result, 
  onRetry, 
  onBack, 
  onExport 
}: { 
  result: QuizResult; 
  onRetry: () => void; 
  onBack: () => void;
  onExport: () => void;
}) {
  const scoreColor = result.score >= 80 ? 'var(--success)' 
    : result.score >= 60 ? 'var(--warning)' 
    : 'var(--error)';

  return (
    <div style={styles.container}>
      <div style={styles.resultCard}>
        <div style={styles.scoreCircle}>
          <span style={{ ...styles.scoreNumber, color: scoreColor }}>{result.score}</span>
          <span style={styles.scoreSuffix}>分</span>
        </div>
        
        <h2 style={styles.resultTitle}>
          {result.score >= 80 ? '太棒了！' : result.score >= 60 ? '不错哦~' : '继续加油！'}
        </h2>
        
        <div style={styles.resultStats}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{result.correctCount}</span>
            <span style={styles.statLabel}>正确</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span style={styles.statValue}>{result.totalQuestions - result.correctCount}</span>
            <span style={styles.statLabel}>错误</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span style={styles.statValue}>{Math.round(result.duration)}</span>
            <span style={styles.statLabel}>秒</span>
          </div>
        </div>

        <div style={styles.resultActions}>
          <button style={styles.retryBtn} onClick={onRetry}>再测一次</button>
          <button style={styles.exportBtn} onClick={onExport}>导出结果</button>
          <button style={styles.backBtn} onClick={onBack}>返回首页</button>
        </div>
      </div>
    </div>
  );
}

function typeBadgeStyle(type: string): React.CSSProperties {
  const styles: Record<string, React.CSSProperties> = {
    single: { background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)' },
    multiple: { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' },
    truefalse: { background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' },
  };
  return styles[type] || styles.single;
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    truefalse: '判断题',
  };
  return labels[type] || type;
}

function difficultyBadgeStyle(difficulty: string): React.CSSProperties {
  return {
    fontSize: 11,
    color: 'var(--text-muted)',
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--surface-2)',
  };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600,
    margin: '0 auto',
    padding: '24px 20px',
  },
  progressHeader: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    background: 'var(--border)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent-gradient)',
    borderRadius: 2,
    transition: 'width .3s ease',
  },
  questionCard: {
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 28,
    boxShadow: 'var(--shadow-md)',
    marginBottom: 20,
  },
  questionMeta: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
  },
  difficultyBadge: {
    fontSize: 11,
    color: 'var(--text-muted)',
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--surface-2)',
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-bright)',
    lineHeight: 1.5,
    margin: '0 0 24px 0',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'var(--surface-2)',
    border: '2px solid var(--border)',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all .2s',
    textAlign: 'left',
  },
  optionSelected: {
    background: 'rgba(var(--accent-rgb), 0.1)',
    borderColor: 'var(--accent)',
  },
  optionCorrect: {
    background: 'rgba(var(--success-rgb), 0.1)',
    borderColor: 'var(--success)',
  },
  optionWrong: {
    background: 'rgba(var(--error-rgb), 0.1)',
    borderColor: 'var(--error)',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: 'var(--text)',
    lineHeight: 1.5,
  },
  optionCheck: {
    fontSize: 16,
    color: 'var(--success)',
  },
  optionX: {
    fontSize: 16,
    color: 'var(--error)',
  },
  explanationCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  explanationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  explanationIcon: {
    fontSize: 18,
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent)',
  },
  explanationText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    margin: 0,
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  submitBtn: {
    flex: 1,
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  nextBtn: {
    flex: 1,
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
  },
  shortcuts: {
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  backBtn: {
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
  },
  resultCard: {
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 40,
    textAlign: 'center',
    boxShadow: 'var(--shadow-lg)',
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: 'var(--accent-gradient)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    boxShadow: 'var(--shadow-glow)',
  },
  scoreNumber: {
    fontSize: 42,
    fontWeight: 700,
    lineHeight: 1,
  },
  scoreSuffix: {
    fontSize: 16,
    opacity: 0.9,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-bright)',
    marginBottom: 24,
  },
  resultStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
    padding: '16px 0',
    background: 'var(--surface-2)',
    borderRadius: 12,
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-bright)',
  },
  statLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  statDivider: {
    width: 1,
    background: 'var(--border)',
  },
  resultActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  retryBtn: {
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
  },
  exportBtn: {
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
  },
};
