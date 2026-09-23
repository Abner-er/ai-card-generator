/**
 * CardGallery.tsx — 路 B 图文卡画廊
 *
 * 每个知识模块用 ImageProvider 直接生成「标题 + 正文 + 要点 + 配图」烤进同一张图的完整卡。
 * 支持：单张生成 / 重生成、批量生成（锚点链：cover 先出、其余传 refImage 保系列一致）、
 * 打包 zip 下载、Mock/真实切换。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KnowledgeModule, ModuleStyle } from './blocks/types';
import { buildImagePrompt } from './blocks/styleEngine';
import { getImageProvider, type ImageProvider } from './blocks/imageProvider';
import { saveCardImage, loadCardMedia } from './blocks/cardImageStore';
import JSZip from 'jszip';

type CardStatus = 'pending' | 'generating' | 'done' | 'error';

interface CardState {
  url?: string;
  status: CardStatus;
  error?: string;
}

export default function CardGallery({
  modules,
  style,
  seriesTitle,
  useMock,
  cardKeyPrefix,
  onToast,
  onImageGenerated,
}: {
  modules: KnowledgeModule[];
  style: ModuleStyle;
  seriesTitle: string;
  useMock: boolean;
  /** 图文卡存储键前缀（`card-${生成批次}-`），与闪卡 id 天然对齐 */
  cardKeyPrefix: string;
  onToast?: (m: string) => void;
  /** 图文卡落库成功的回调（cardId = `${cardKeyPrefix}${moduleId}`），供上层给闪卡打 hasImage 标记 */
  onImageGenerated?: (cardId: string) => void;
}) {
  const provider: ImageProvider = useMemo(() => getImageProvider(useMock), [useMock]);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [genAllBusy, setGenAllBusy] = useState(false);
  // 回调用 ref 持有，避免父组件内联函数导致 hydration effect 反复触发
  const onImageGeneratedRef = useRef(onImageGenerated);
  useEffect(() => {
    onImageGeneratedRef.current = onImageGenerated;
  }, [onImageGenerated]);

  // hydration：挂载时把 IndexedDB 里已生成的图回填（切步骤/刷新后图不再丢失）
  // key 里带上批次前缀：重新生成新系列后即使模块 id 相同也会重新回填，不残留上一系列的图
  const idsKey = useMemo(() => `${cardKeyPrefix}|${modules.map((m) => m.id).join('|')}`, [cardKeyPrefix, modules]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const m of modules) {
        try {
          const media = await loadCardMedia(`${cardKeyPrefix}${m.id}`);
          if (cancelled || !media) continue;
          setCards((p) =>
            p[m.id]?.url ? p : { ...p, [m.id]: { url: media.full, status: 'done' } },
          );
          onImageGeneratedRef.current?.(`${cardKeyPrefix}${m.id}`);
        } catch {
          /* IDB 不可用时静默跳过 */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  /** 生成单张；返回 data URL 供锚点链使用 */
  const genOne = useCallback(
    async (m: KnowledgeModule, anchorUrl?: string): Promise<string | undefined> => {
      const prompt = buildImagePrompt(m, style);
      setCards((p) => ({ ...p, [m.id]: { status: 'generating', error: undefined } }));
      try {
        const url = await provider.generate(prompt, {
          ratio: m.ratio,
          refImage: anchorUrl,
          mockText: { title: m.title, body: m.body, bullets: m.bullets },
        });
        setCards((p) => ({ ...p, [m.id]: { url, status: 'done' } }));
        // 落库 + 通知上层给对应闪卡打「有图」标记；失败不影响本次生成结果
        saveCardImage(`${cardKeyPrefix}${m.id}`, url)
          .then(() => onImageGeneratedRef.current?.(`${cardKeyPrefix}${m.id}`))
          .catch(() => {});
        return url;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setCards((p) => ({ ...p, [m.id]: { status: 'error', error: msg } }));
        onToast?.(`「${m.title}」失败：${msg}`);
        return undefined;
      }
    },
    [provider, style, onToast, cardKeyPrefix],
  );

  /** 批量生成：cover 先出图作为锚点，其余带锚点保证系列一致 */
  const genAll = useCallback(async () => {
    setGenAllBusy(true);
    try {
      const cover = modules.find((m) => m.type === 'cover') ?? modules[0];
      let anchor: string | undefined;
      if (cover) anchor = await genOne(cover);
      const rest = modules.filter((m) => m !== cover);
      let i = 0;
      const worker = async () => {
        while (i < rest.length) {
          const m = rest[i++];
          await genOne(m, anchor);
        }
      };
      const n = Math.max(1, Math.min(3, rest.length || 1)); // DashScope RPM 较低，并发 3
      await Promise.all(Array.from({ length: n }, () => worker()));
      onToast?.('全部图文卡已生成');
    } finally {
      setGenAllBusy(false);
    }
  }, [modules, genOne, onToast]);

  const downloadOne = useCallback(
    (m: KnowledgeModule) => {
      const c = cards[m.id];
      if (!c?.url) return;
      const a = document.createElement('a');
      a.href = c.url;
      a.download = `${m.id}-${m.title}.png`;
      a.click();
    },
    [cards],
  );

  const downloadZip = useCallback(async () => {
    const zip = new JSZip();
    let n = 0;
    for (const m of modules) {
      const c = cards[m.id];
      if (c?.status === 'done' && c.url) {
        const base64 = c.url.split(',')[1];
        if (base64) {
          zip.file(`${m.id}-${m.title}.png`, base64, { base64: true });
          n++;
        }
      }
    }
    if (!n) {
      onToast?.('还没有生成的卡片');
      return;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seriesTitle || 'cards'}-qwen.zip`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.(`已打包 ${n} 张卡片`);
  }, [modules, cards, seriesTitle, onToast]);

  const doneCount = Object.values(cards).filter((c) => c.status === 'done').length;

  // 重生成时复用封面（或首张）图作为锚点，保持系列一致
  const cover = modules.find((m) => m.type === 'cover') ?? modules[0];
  const coverUrl = cover ? cards[cover.id]?.url : undefined;

  return (
    <div style={G.wrap}>
      <div style={G.header}>
        <div>
          <b style={G.hTitle}>🎨 图文卡（AI 直接生图）</b>
          <span style={G.muted}>
            {' '}
            {provider.label} · 已生成 {doneCount}/{modules.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...G.primary, ...(genAllBusy ? G.disabled : {}) }} disabled={genAllBusy} onClick={genAll}>
            {genAllBusy ? '生成中…' : '生成全部'}
          </button>
          <button style={G.ghost} onClick={downloadZip} disabled={doneCount === 0}>
            下载 ZIP
          </button>
        </div>
      </div>

      <div style={G.grid}>
        {modules.map((m) => {
          const c = cards[m.id];
          const prompt = buildImagePrompt(m, style);
          return (
            <div key={m.id} style={G.card}>
              <div style={G.cardImgBox}>
                {c?.status === 'done' && c.url ? (
                  <img src={c.url} alt={m.title} style={G.img} />
                ) : c?.status === 'generating' ? (
                  <div style={G.skeleton}>生图中…</div>
                ) : c?.status === 'error' ? (
                  <div style={G.errBox}>
                    <div style={G.errMsg}>{c.error}</div>
                  </div>
                ) : (
                  <div style={G.skeleton}>待生成</div>
                )}
                <span style={G.typeBadge}>{m.type}</span>
              </div>
              <div style={G.cardBody}>
                <div style={G.cardTitle}>
                  {m.icon ? m.icon + ' ' : ''}
                  {m.title}
                </div>
                <div style={G.cardRatio}>比例 {m.ratio}</div>
                <details style={G.details}>
                  <summary style={G.summary}>提示词</summary>
                  <pre style={G.prompt}>{prompt}</pre>
                </details>
                <div style={G.cardActions}>
                  <button
                    style={{ ...G.mini, ...(c?.status === 'generating' ? G.disabled : {}) }}
                    disabled={c?.status === 'generating'}
                    onClick={() => genOne(m, coverUrl)}
                  >
                    {c?.status === 'done' ? '重生成' : '生成'}
                  </button>
                  <button style={{ ...G.mini, ...G.miniGhost }} disabled={c?.status !== 'done'} onClick={() => downloadOne(m)}>
                    下载
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const G: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 20, background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,.06)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  hTitle: { fontSize: 16 },
  muted: { color: '#999', fontSize: 13 },
  primary: { background: '#2b2b2b', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  ghost: { background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: '10px 16px', fontSize: 14, cursor: 'pointer' },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  card: { border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', background: '#fafafa', display: 'flex', flexDirection: 'column' },
  cardImgBox: { position: 'relative', background: '#eee', aspectRatio: '3 / 4' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  skeleton: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14, background: 'repeating-linear-gradient(45deg,#f3f3f3,#f3f3f3 12px,#ededed 12px,#ededed 24px)' },
  errBox: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 },
  errMsg: { color: '#c0392b', fontSize: 12, lineHeight: 1.5, textAlign: 'center' },
  typeBadge: { position: 'absolute', left: 8, top: 8, background: 'rgba(43,43,43,.8)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 6 },
  cardBody: { padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#222' },
  cardRatio: { fontSize: 11, color: '#999' },
  details: { marginTop: 2 },
  summary: { fontSize: 12, color: '#2563eb', cursor: 'pointer' },
  prompt: { margin: '6px 0 0', fontSize: 11.5, lineHeight: 1.6, color: '#444', background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 8, maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: '"SF Mono","Consolas",monospace' },
  cardActions: { display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 },
  mini: { flex: 1, background: '#2b2b2b', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 13, cursor: 'pointer' },
  miniGhost: { background: '#fff', border: '1px solid #ddd', color: '#333' },
};
