/**
 * cardImageStore.ts — 图文卡原图的本地持久层（IndexedDB）
 *
 * 生成的图文卡是 data URL（单张 1-2MB），localStorage 装不下，走 IndexedDB。
 * 入库时同步生成一份降采样 JPEG 缩略图，复习卡答案面用缩略图、点击回看原图。
 * key 约定：与闪卡 id 一致（`card-${生成批次}-${moduleId}`），天然对齐。
 */

export interface CardMedia {
  full: string;
  thumb: string;
  updatedAt: string;
}

const DB_NAME = 'kb-card-images';
const DB_VERSION = 1;
const STORE = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
  });
  return dbPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

/** 降采样生成缩略图（最长边 ~560px，JPEG q0.82）；失败则回退为原图 */
async function makeThumb(dataUrl: string, maxSide = 560): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || maxSide) * scale));
    const h = Math.max(1, Math.round((img.height || maxSide) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return dataUrl;
  }
}

/** 保存图文卡原图（自动生成缩略图），失败静默不阻塞生成流程 */
export async function saveCardImage(cardId: string, fullUrl: string): Promise<void> {
  const db = await openDB();
  const thumb = await makeThumb(fullUrl);
  const rec: CardMedia & { id: string } = { id: cardId, full: fullUrl, thumb, updatedAt: new Date().toISOString() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('写入失败'));
  });
}

/** 读取某张卡的图（含缩略图）；不存在或环境不支持时返回 null */
export async function loadCardMedia(cardId: string): Promise<CardMedia | null> {
  try {
    const db = await openDB();
    return await new Promise<CardMedia | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(cardId);
      req.onsuccess = () => {
        const rec = req.result as (CardMedia & { id: string }) | undefined;
        resolve(rec ? { full: rec.full, thumb: rec.thumb, updatedAt: rec.updatedAt } : null);
      };
      req.onerror = () => reject(req.error ?? new Error('读取失败'));
    });
  } catch {
    return null;
  }
}

/** 删除某张卡的图 */
export async function deleteCardImage(cardId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(cardId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('删除失败'));
    });
  } catch {
    /* 忽略 */
  }
}
