/**
 * StudyView.tsx — 间隔重复学习视图组件
 *
 * 展示当前需要复习的卡片，支持 SM-2 算法评分
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import type { SM2Card } from './blocks/spacedRepetition';
import { reviewCard, getDueCards, getStats } from './blocks/spacedRepetition';
import { loadCardMedia, type CardMedia } from './blocks/cardImageStore';

interface StudyViewProps {
  cards: SM2Card[];
  onCardsChange: (cards: SM2Card[]) => void;
  onBack: () => void;
  /** 只复习该系列来源的卡片（组内复习入口传入；不传 = 全局到期队列） */
  filterSource?: string;
}

export default function StudyView({ cards, onCardsChange, onBack, filterSource }: StudyViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const reviewedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const dueCardsRef = useRef<SM2Card[]>([]);
  // ESC 退出复习用：onBack 每次渲染都是新闭包，走 ref 同步以免进键盘 effect 依赖引发重绑抖动
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  // 获取待复习卡片：先按来源过滤，再取到期队列（逾期最久优先）
  const scopedCards = useMemo(
    () => (filterSource ? cards.filter(c => c.source === filterSource) : cards),
    [cards, filterSource],
  );
  const dueCards = useMemo(() => getDueCards(scopedCards), [scopedCards]);
  const stats = useMemo(() => getStats(scopedCards), [scopedCards]);

  // 同步 ref
  useEffect(() => {
    reviewedRef.current = reviewed;
  }, [reviewed]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    dueCardsRef.current = dueCards;
  }, [dueCards]);

  // 当前卡片
  const currentCard = dueCards[currentIndex];

  // 图卡联动：当前卡有配图时异步取缩略图/原图（放答案面，避免剧透）
  const [media, setMedia] = useState<CardMedia | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const lightboxRef = useRef(false);
  useEffect(() => {
    lightboxRef.current = lightbox;
  }, [lightbox]);
  useEffect(() => {
    let cancelled = false;
    setMedia(null);
    setLightbox(false);
    if (currentCard?.hasImage) {
      loadCardMedia(currentCard.id).then((m) => {
        if (!cancelled) setMedia(m);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [currentCard?.id, currentCard?.hasImage]);

  // 处理评分
  const handleRating = (rating: 0 | 1 | 2 | 3) => {
    if (!currentCard) return;

    const result = reviewCard(currentCard, rating);
    const updatedCards = cards.map(c => c.id === result.card.id ? result.card : c);
    onCardsChange(updatedCards);
    setReviewed(true);

    // 延迟后进入下一张
    setTimeout(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        const total = dueCardsRef.current.length;
        if (next >= total) {
          setTimeout(onBack, 500);
          return prev;
        }
        return next;
      });
      setShowAnswer(false);
      setReviewed(false);
    }, 600);
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 图片放大层打开时只响应 ESC
      if (lightboxRef.current) {
        if (e.key === 'Escape') setLightbox(false);
        return;
      }
      // ESC = 退出复习（与顶栏"← 返回"按钮同义；评分即时落库，中途退出不丢进度）
      if (e.key === 'Escape') {
        onBackRef.current();
        return;
      }
      if (!currentCard || reviewedRef.current) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setShowAnswer(prev => !prev);
      } else if (e.key === '1') handleRating(0);
      else if (e.key === '2') handleRating(1);
      else if (e.key === '3') handleRating(2);
      else if (e.key === '4') handleRating(3);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, handleRating]);

  if (!currentCard) {
    const nextDue = scopedCards
      .map(c => new Date(c.nextReview).getTime())
      .filter(t => t > Date.now())
      .sort((a, b) => a - b)[0];
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>{scopedCards.length === 0 ? '🗂' : '✓'}</div>
        <h2 style={styles.emptyTitle}>
          {scopedCards.length === 0
            ? (filterSource ? '这一组还没有闪卡' : '还没有闪卡')
            : '本组卡片今日已复习完成！'}
        </h2>
        <p style={styles.emptyDesc}>
          {scopedCards.length === 0
            ? '先生成一个知识系列，系统会自动把知识点转成闪卡。'
            : nextDue
              ? `下次复习：${new Date(nextDue).toLocaleDateString()}。到时间隔重复算法会把卡片推回队列。`
              : '今天的学习任务已完成，明天再继续吧。'}
        </p>
        <button style={styles.backBtn} onClick={onBack}>返回</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 顶部统计栏 */}
      <div style={styles.statsBar}>
        <span style={styles.statsText}>
          {filterSource ? `只复习「${filterSource}」 · ` : ''}待复习 <b>{stats.due}</b> · 学习中 <b>{stats.learning}</b> · 已掌握 <b>{stats.mastered}</b>
        </span>
        <div style={styles.statsRight}>
          <span style={styles.progress}>
            {currentIndex + 1} / {dueCards.length}
          </span>
          {/* 历史 bug：复习进行中页面无任何退出入口，用户只能刷完全部卡或手动刷新 */}
          <button style={styles.exitBtn} onClick={onBack} title="退出复习（复习进度已实时保存，ESC 同）">← 返回</button>
        </div>
      </div>

      {/* 进度条 */}
      <div style={styles.progressBar}>
        <div 
          style={{
            ...styles.progressFill,
            width: `${((currentIndex + 1) / dueCards.length) * 100}%`,
          }} 
        />
      </div>

      {/* 卡片区域：正/背面内容淡入切换（不做 3D 翻转，避免文字镜像） */}
      <div style={styles.cardWrapper}>
        <div style={styles.card} onClick={() => setShowAnswer(p => !p)}>
          {showAnswer ? (
            <div key="answer" className="fade-in" style={styles.cardAnswer}>
              {currentCard.source && <div style={styles.cardSource}>来自「{currentCard.source}」</div>}
              <div style={styles.answerLabel}>答案</div>
              <div style={styles.answerText}>{currentCard.answer}</div>
              {currentCard.hasImage && (
                media ? (
                  <div
                    style={styles.thumbBox}
                    onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
                    title="点击回看图文卡原图"
                  >
                    <img src={media.thumb} alt={currentCard.question} style={styles.thumbImg} />
                    <div style={styles.thumbHint}>🔍 点击回看图文卡原图</div>
                  </div>
                ) : (
                  <div style={styles.thumbLoading}>图文卡加载中…</div>
                )
              )}
            </div>
          ) : (
            <div key="question" className="fade-in" style={styles.cardFace}>
              {currentCard.source && <div style={styles.cardSource}>来自「{currentCard.source}」</div>}
              <div style={styles.cardQuestion}>
                {currentCard.question}
              </div>
              {currentCard.hasImage && <div style={styles.imgBadge}>🖼 本卡配有图文卡</div>}
              <div style={styles.cardHint}>点击或按空格键查看</div>
            </div>
          )}
        </div>
      </div>

      {/* 图卡联动：全屏回看原图 */}
      {lightbox && media && (
        <div
          style={styles.lightbox}
          onClick={() => setLightbox(false)}
          title="点击任意处或按 ESC 关闭"
        >
          <img src={media.full} alt={currentCard.question} style={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          <div style={styles.lightboxBar} onClick={(e) => e.stopPropagation()}>
            <span style={styles.lightboxTitle}>{currentCard.question}</span>
            <a
              href={media.full}
              download={`${currentCard.id}.png`}
              style={styles.lightboxDl}
            >
              下载原图
            </a>
            <button style={styles.lightboxClose} onClick={() => setLightbox(false)}>关闭 ✕</button>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {showAnswer && !reviewed && (
        <div style={styles.ratingGroup}>
          <RatingButton 
            rating={0} 
            label="再次" 
            sublabel="1天后" 
            color="var(--error)"
            onClick={() => handleRating(0)}
          />
          <RatingButton 
            rating={1} 
            label="困难" 
            sublabel="6天后" 
            color="var(--warning)"
            onClick={() => handleRating(1)}
          />
          <RatingButton 
            rating={2} 
            label="正常" 
            sublabel="12天后" 
            color="var(--accent)"
            onClick={() => handleRating(2)}
          />
          <RatingButton 
            rating={3} 
            label="简单" 
            sublabel="20天后" 
            color="var(--success)"
            onClick={() => handleRating(3)}
          />
        </div>
      )}

      {!showAnswer && (
        <button 
          style={styles.showAnswerBtn}
          onClick={() => setShowAnswer(true)}
        >
          显示答案 <span style={styles.keyHint}>（空格）</span>
        </button>
      )}

      {/* 快捷键提示 */}
      <div style={styles.shortcuts}>
        <kbd>空格</kbd> 显示/隐藏答案
        <span style={{ margin: '0 8px', opacity: 0.5 }}>·</span>
        <kbd>1-4</kbd> 评分
      </div>
    </div>
  );
}

function RatingButton({ 
  rating, 
  label, 
  sublabel, 
  color,
  onClick 
}: { 
  rating: 0 | 1 | 2 | 3; 
  label: string; 
  sublabel: string; 
  color: string;
  onClick: () => void;
}) {
  return (
    <button style={{ ...styles.ratingBtn, borderColor: color }} onClick={onClick}>
      <div style={{ ...styles.ratingKey, background: color }}>{rating + 1}</div>
      <div style={styles.ratingLabel}>{label}</div>
      <div style={{ ...styles.ratingSublabel, color }}>{sublabel}</div>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600,
    margin: '0 auto',
    padding: '24px 20px',
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: '12px 16px',
    background: 'var(--surface)',
    borderRadius: 12,
    border: '1px solid var(--border)',
  },
  statsText: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  progress: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent)',
  },
  statsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  exitBtn: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-mute)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    cursor: 'pointer',
  },
  progressBar: {
    height: 4,
    background: 'var(--border)',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent-gradient)',
    borderRadius: 2,
    transition: 'width .3s ease',
  },
  cardWrapper: {
    marginBottom: 24,
    minHeight: 280,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 40,
    minHeight: 200,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-md)',
  },
  cardSource: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    borderRadius: 999,
    padding: '3px 10px',
    marginBottom: 14,
  },
  cardFace: {
    width: '100%',
  },
  cardQuestion: {
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--text-bright)',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  cardHint: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  cardAnswer: {
    width: '100%',
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  answerText: {
    fontSize: 16,
    color: 'var(--text)',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
  },
  imgBadge: {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
    borderRadius: 999,
    padding: '4px 12px',
    marginBottom: 14,
  },
  thumbBox: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    cursor: 'zoom-in',
  },
  thumbImg: {
    maxWidth: '100%',
    maxHeight: 260,
    borderRadius: 12,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-md)',
    display: 'block',
  },
  thumbHint: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  thumbLoading: {
    marginTop: 20,
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  lightbox: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,.82)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    cursor: 'zoom-out',
  },
  lightboxImg: {
    maxWidth: '92vw',
    maxHeight: '78vh',
    objectFit: 'contain',
    borderRadius: 14,
    boxShadow: '0 12px 48px rgba(0,0,0,.5)',
    cursor: 'default',
  },
  lightboxBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'default',
  },
  lightboxTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    maxWidth: '50vw',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lightboxDl: {
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: 'rgba(255,255,255,.14)',
    border: '1px solid rgba(255,255,255,.3)',
    borderRadius: 8,
    padding: '6px 14px',
    textDecoration: 'none',
  },
  lightboxClose: {
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: 'rgba(255,255,255,.14)',
    border: '1px solid rgba(255,255,255,.3)',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
  },
  ratingGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 16,
  },
  ratingBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '16px 12px',
    background: 'var(--surface)',
    border: '2px solid',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  ratingKey: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-bright)',
  },
  ratingSublabel: {
    fontSize: 11,
    fontWeight: 500,
  },
  showAnswerBtn: {
    width: '100%',
    padding: '16px 24px',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--accent-text)',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
    marginBottom: 16,
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
  emptyTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-bright)',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 24,
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
  keyHint: {
    fontSize: 12,
    opacity: 0.8,
  },
};
