/**
 * LearnBrowseView.tsx — 内嵌学习浏览视图（路 C）
 *
 * 把拆解好的知识模块铺成「可浏览、可编辑」的卡片网格，直接在 App 内学习，
 * 不产出下载文件。每张卡：
 *  - 画报式主视觉块（emoji icon + 类型 SVG + 系列配色，纯 JSX，不依赖生图）
 *  - 标题 + 完整正文（fullBody）+ 分层要点（fullBullets）+ 备注（notes）
 *  - 正文/要点/备注均可就地编辑
 *
 * 编辑内容通过 onContentChange 回传父组件（同一次工作流内保留；刷新后重新扩写）。
 */
import type { JSX, CSSProperties } from 'react';
import type { KnowledgeModule, ModuleStyle } from './blocks/types';

interface LearnGroup {
  title: string;
  moduleIds: string[];
}

interface LearnBrowseViewProps {
  modules: KnowledgeModule[];
  groups: LearnGroup[];
  seriesTitle: string;
  seriesStyle: ModuleStyle | null;
  learnBusy: boolean;
  onContentChange: (modules: KnowledgeModule[]) => void;
  onBack: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  cover: '封面', definition: '概念', fact: '知识', step: '步骤',
  compare: '对比', timeline: '时间线', stat: '数据', quote: '金句',
  tip: '贴士', section: '分节',
};
const TYPE_ICON: Record<string, string> = {
  cover: '📌', definition: '📖', fact: '💡', step: '🔽',
  compare: '⚖️', timeline: '⏳', stat: '📊', quote: '❝', tip: '✨', section: '⤷',
};

/** 从系列的 textTheme / palette 解析画报块配色 */
function blockColors(style: ModuleStyle | null | undefined) {
  const t = style?.textTheme;
  const hex = style?.palette?.match(/#[0-9a-fA-F]{6}/)?.[0];
  return {
    accent: t?.accent || hex || '#2f6fed',
    deco: t?.deco || '#8a9dc0',
    bg: t?.cardBg || t?.bg || '#eef2f8',
  };
}

function TypeArt({ type, accent, deco }: { type: string; accent: string; deco: string }) {
  let body: JSX.Element[] = [];
  switch (type) {
    case 'step':
      body = [
        <circle key="a" cx={30} cy={34} r={12} fill={deco} />,
        <path key="b" d="M30 34 L64 34" stroke={accent} strokeWidth={4} strokeLinecap="round" />,
        <circle key="c" cx={72} cy={34} r={12} fill={accent} />,
        <path key="d" d="M84 34 L116 34" stroke={accent} strokeWidth={4} strokeLinecap="round" />,
        <circle key="e" cx={124} cy={34} r={12} fill={deco} />,
      ];
      break;
    case 'compare':
      body = [
        <path key="a" d="M58 12 L58 58" stroke={accent} strokeWidth={3} strokeDasharray="4 4" />,
        <rect key="b" x={10} y={16} width={42} height={36} rx={6} fill={deco} />,
        <rect key="c" x={62} y={16} width={42} height={36} rx={6} fill={accent} />,
      ];
      break;
    case 'timeline':
      body = [
        <circle key="a" cx={18} cy={34} r={7} fill={accent} />,
        <path key="b" d="M22 34 L50 34" stroke={accent} strokeWidth={3} strokeLinecap="round" />,
        <circle key="c" cx={57} cy={34} r={7} fill={deco} />,
        <path key="d" d="M61 34 L89 34" stroke={accent} strokeWidth={3} strokeLinecap="round" />,
        <circle key="e" cx={96} cy={34} r={7} fill={accent} />,
        <path key="f" d="M100 34 L128 34" stroke={accent} strokeWidth={3} strokeLinecap="round" />,
      ];
      break;
    case 'stat':
      body = [16, 38, 60, 82, 104].map((x, i) => (
        <rect key={i} x={x} y={18 + ((i % 3) * 12)} width={16} height={36 - ((i % 3) * 12)} rx={3} fill={i % 2 ? accent : deco} />
      ));
      break;
    case 'quote':
      body = [
        <path key="a" d="M22 44 C10 42 8 30 8 22 C8 18 10 14 16 12 L20 18 C12 20 13 28 20 29 Z" fill={accent} />,
        <path key="b" d="M58 44 C46 42 44 30 44 22 C44 18 46 14 52 12 L56 18 C48 20 49 28 56 29 Z" fill={accent} />,
        <rect key="c" x={20} y={50} width={100} height={6} rx={3} fill={deco} />,
      ];
      break;
    case 'tip':
      body = [
        <circle key="a" cx={67} cy={34} r={24} fill={deco} />,
        <path key="b" d="M67 34 L67 48" stroke={accent} strokeWidth={4} strokeLinecap="round" />,
        <circle key="c" cx={67} cy={22} r={3} fill={accent} />,
        <rect key="d" x={12} y={58} width={110} height={6} rx={3} fill={accent} />,
      ];
      break;
    case 'definition':
      body = [
        <rect key="a" x={16} y={12} width={42} height={56} rx={4} fill={deco} />,
        <rect key="b" x={24} y={20} width={26} height={6} rx={3} fill={accent} />,
        <rect key="c" x={24} y={32} width={20} height={4} rx={2} fill={accent} />,
        <rect key="d" x={62} y={20} width={42} height={40} rx={6} fill={accent} />,
      ];
      break;
    case 'fact':
      body = [
        <ellipse key="a" cx={67} cy={34} rx={30} ry={22} fill={accent} />,
        <path key="b" d="M67 26 L67 42 M60 34 L74 34" stroke={deco} strokeWidth={5} strokeLinecap="round" />,
      ];
      break;
    case 'cover':
      body = [
        <path key="a" d="M14 14 L126 14 L126 54 L14 54 Z" fill={deco} />,
        <path key="b" d="M24 26 L116 26" stroke={accent} strokeWidth={6} strokeLinecap="round" />,
        <path key="c" d="M24 40 L82 40" stroke={accent} strokeWidth={5} strokeLinecap="round" />,
      ];
      break;
    case 'section':
      body = [
        <path key="a" d="M10 34 L54 34" stroke={accent} strokeWidth={4} strokeLinecap="round" />,
        <path key="b" d="M102 34 L134 34" stroke={accent} strokeWidth={4} strokeLinecap="round" />,
        <circle key="c" cx={72} cy={14} r={10} fill={accent} />,
      ];
      break;
    default:
      body = [
        <circle key="a" cx={67} cy={34} r={26} fill={accent} />,
        <circle key="b" cx={67} cy={34} r={14} fill={deco} />,
      ];
  }
  return <g>{body}</g>;
}

export default function LearnBrowseView({
  modules, groups, seriesTitle, seriesStyle, learnBusy, onContentChange, onBack,
}: LearnBrowseViewProps) {
  const colors = blockColors(seriesStyle);
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const updateModule = (id: string, patch: Partial<KnowledgeModule>) => {
    onContentChange(modules.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };
  const updateBullet = (id: string, index: number, value: string) => {
    const m = moduleById.get(id);
    if (!m) return;
    const bullets = [...((m.fullBullets ?? m.bullets ?? []) as string[])];
    bullets[index] = value;
    updateModule(id, { fullBullets: bullets });
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={L.header}>
        <button style={L.backBtn} onClick={onBack}>← 返回</button>
        <div style={L.titleWrap}>
          <div style={L.kicker}>学习页</div>
          <h1 style={L.title}>{seriesTitle || '知识学习'}</h1>
        </div>
        {learnBusy && <span style={L.busy}>正在扩充内容…</span>}
      </div>

      <p style={L.hint}>点卡片上的文字即可编辑 · 共 {modules.length} 个知识点</p>

      {groups.map((g) => {
        const list = g.moduleIds.map((id) => moduleById.get(id)).filter((m): m is KnowledgeModule => !!m);
        if (!list.length) return null;
        return (
          <section key={g.title} style={L.group}>
            <div style={L.groupHead}>
              <h2 style={L.groupTitle} contentEditable={false}>{g.title}</h2>
              <span style={L.groupLine} />
            </div>
            <div style={L.grid}>
              {list.map((m) => {
                const fullBody = m.fullBody || m.body;
                const bullets = (m.fullBullets && m.fullBullets.length ? m.fullBullets : (m.bullets ?? [])) as string[];
                const notes = m.notes || '';
                return (
                  <div key={m.id} style={L.card}>
                    <div style={{ ...L.art, background: colors.bg }}>
                      <svg viewBox="0 0 140 68" style={{ width: '88%', height: '82%' }}>
                        <TypeArt type={m.type} accent={colors.accent} deco={colors.deco} />
                      </svg>
                      <span style={{ ...L.icon, color: colors.accent }}>{m.icon || TYPE_ICON[m.type] || '💡'}</span>
                      <span style={{ ...L.typeTag, color: colors.accent, borderColor: colors.accent + '33' }}>
                        {TYPE_LABEL[m.type] || m.type}
                      </span>
                    </div>
                    <div style={L.body}>
                      <h3
                        style={L.cardTitle}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => updateModule(m.id, { title: e.currentTarget.innerText })}
                      >{m.title}</h3>
                      <p
                        style={L.fullBody}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => updateModule(m.id, { fullBody: e.currentTarget.innerText })}
                      >{fullBody}</p>
                      {bullets.length > 0 && (
                        <ul style={L.bullets}>
                          {bullets.map((b, i) => (
                            <li key={i}>
                              <span style={L.bulletMark}>▸</span>
                              <span
                                style={L.bulletText}
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => updateBullet(m.id, i, e.currentTarget.innerText)}
                              >{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {notes && (
                        <p
                          style={L.notes}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => updateModule(m.id, { notes: e.currentTarget.innerText })}
                        >📌 {notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const L: Record<string, CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4, flexWrap: 'wrap' },
  backBtn: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text)',
  },
  titleWrap: { flex: 1, minWidth: 180 },
  kicker: { fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 },
  title: { fontSize: 24, fontWeight: 700, margin: '2px 0 0', color: 'var(--text-bright)' },
  busy: { fontSize: 12, color: 'var(--warning)', padding: '6px 12px', background: 'rgba(255,255,255,.6)', borderRadius: 999, border: '1px solid var(--border)' },
  hint: { fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' },
  group: { marginTop: 26 },
  groupHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  groupTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-bright)' },
  groupLine: { flex: 1, height: 1, background: 'var(--border)' },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16,
  },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-sm)', cursor: 'default',
  },
  art: { position: 'relative', aspectRatio: '140/68', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  icon: { position: 'absolute', top: 10, left: 12, fontSize: 22, lineHeight: 1 },
  typeTag: {
    position: 'absolute', top: 10, right: 12, fontSize: 11, padding: '2px 8px',
    border: '1px solid', borderRadius: 999, background: 'rgba(255,255,255,.6)',
  },
  body: { padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  cardTitle: {
    fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.35, color: 'var(--text-bright)',
    outline: 'none', borderRadius: 6, padding: '1px 3px',
  },
  fullBody: {
    fontSize: 14, lineHeight: 1.65, color: 'var(--text)', margin: 0,
    outline: 'none', borderRadius: 6, padding: '1px 3px',
  },
  bullets: { listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  bulletMark: { color: 'var(--accent)', fontSize: 12, position: 'absolute', left: 0, top: 2 },
  bulletText: { outline: 'none', borderRadius: 6, paddingLeft: 16 },
  notes: {
    fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.6,
    background: 'rgba(0,0,0,.03)', borderRadius: 8, padding: '8px 10px',
    outline: 'none',
  },
};