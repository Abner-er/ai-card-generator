import { toPng, toJpeg } from 'html-to-image';

/**
 * 图片导出工具
 */
export class ExportService {
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
    const dataUrl = await toPng(element, {
      width: options?.width,
      height: options?.height,
      pixelRatio: options?.pixelRatio || 2,
      backgroundColor: options?.backgroundColor,
      cacheBust: true,
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
}
