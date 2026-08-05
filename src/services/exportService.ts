import { toPng, toJpeg } from 'html-to-image';
import JSZip from 'jszip';

/**
 * 单张卡片的导出参数
 */
export interface ExportCardParams {
  element: HTMLElement;
  filename: string;
  width?: number;
  height?: number;
  pixelRatio?: number;
  backgroundColor?: string;
}

/**
 * 图片导出工具
 * 支持单张导出、批量下载、ZIP打包下载
 */
export class ExportService {
  /**
   * 等待元素内所有图片加载完成
   */
  private static async preloadImages(element: HTMLElement): Promise<void> {
    const imgs = element.querySelectorAll('img');
    const promises = Array.from(imgs).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // 即使加载失败也继续
        // 5 秒超时保护
        setTimeout(() => resolve(), 5000);
      });
    });
    await Promise.all(promises);
  }

  /**
   * 导出为PNG
   */
  static async exportAsPng(
    element: HTMLElement,
    options?: {
      width?: number;
      height?: number;
      pixelRatio?: number;
      backgroundColor?: string;
    }
  ): Promise<string> {
    // 先等待所有图片加载完成
    await this.preloadImages(element);

    const dataUrl = await toPng(element, {
      width: options?.width,
      height: options?.height,
      pixelRatio: options?.pixelRatio || 2,
      backgroundColor: options?.backgroundColor,
      cacheBust: true,
      skipFonts: true,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
    });
    return dataUrl;
  }

  /**
   * 导出为JPEG
   */
  static async exportAsJpeg(
    element: HTMLElement,
    options?: {
      width?: number;
      height?: number;
      pixelRatio?: number;
      backgroundColor?: string;
      quality?: number;
    }
  ): Promise<string> {
    const dataUrl = await toJpeg(element, {
      width: options?.width,
      height: options?.height,
      pixelRatio: options?.pixelRatio || 2,
      backgroundColor: options?.backgroundColor || '#ffffff',
      quality: options?.quality || 0.92,
      cacheBust: true,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
    });
    return dataUrl;
  }

  /**
   * 下载图片
   */
  static download(dataUrl: string, filename: string) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  // ============================================================
  // 批量导出
  // ============================================================

  /**
   * 批量导出多张卡片为PNG并逐个下载
   * 注意：浏览器可能会拦截多个连续下载，建议优先使用 exportAsZip
   *
   * @param cards  要导出的卡片参数列表
   * @param onProgress  进度回调 (当前序号, 总数, 消息)
   */
  static async exportBatch(
    cards: ExportCardParams[],
    onProgress?: (current: number, total: number, msg: string) => void,
  ): Promise<void> {
    const total = cards.length;
    for (let i = 0; i < total; i++) {
      const card = cards[i];
      onProgress?.(i, total, `正在导出第 ${i + 1}/${total} 张...`);
      const dataUrl = await this.exportAsPng(card.element, {
        width: card.width,
        height: card.height,
        pixelRatio: card.pixelRatio || 2,
        backgroundColor: card.backgroundColor,
      });
      this.download(dataUrl, card.filename);
      // 间隔200ms避免浏览器拦截
      await this.delay(200);
    }
    onProgress?.(total, total, `全部 ${total} 张已导出`);
  }

  /**
   * 批量导出多张卡片并打包为ZIP下载
   *
   * @param cards  要导出的卡片参数列表
   * @param zipFilename  ZIP文件名（不含扩展名）
   * @param onProgress  进度回调 (当前序号, 总数, 消息)
   */
  static async exportAsZip(
    cards: ExportCardParams[],
    zipFilename: string,
    onProgress?: (current: number, total: number, msg: string) => void,
  ): Promise<void> {
    const zip = new JSZip();
    const folder = zip.folder(zipFilename) || zip;
    const total = cards.length;

    for (let i = 0; i < total; i++) {
      const card = cards[i];
      onProgress?.(i, total, `正在生成第 ${i + 1}/${total} 张...`);
      const dataUrl = await this.exportAsPng(card.element, {
        width: card.width,
        height: card.height,
        pixelRatio: card.pixelRatio || 2,
        backgroundColor: card.backgroundColor,
      });
      // 将 data URL 转为二进制存入ZIP
      const base64 = this.dataUrlToBase64(dataUrl);
      folder.file(card.filename, base64, { base64: true });
    }

    onProgress?.(total, total, '正在打包ZIP...');
    const zipBlob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    );

    const zipUrl = URL.createObjectURL(zipBlob);
    this.downloadBlob(zipUrl, `${zipFilename}.zip`);
    // 延迟释放
    setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);

    onProgress?.(total, total, `ZIP打包完成，共 ${total} 张`);
  }

  /**
   * data URL → 纯 base64 字符串
   */
  private static dataUrlToBase64(dataUrl: string): string {
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
  }

  /**
   * 下载 Blob URL
   */
  private static downloadBlob(url: string, filename: string) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
