import type { CardProject, CardData } from '../types';

/**
 * 项目保存/加载服务
 *
 * 管理信息图卡片项目的持久化：
 * - localStorage 自动保存/加载
 * - JSON 导入/导出
 * - 文件下载
 * - 项目创建
 */
const STORAGE_KEY = 'ai-infographic-project';

export class ProjectService {
  /**
   * 保存项目到 localStorage
   */
  static save(project: CardProject): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      console.error('项目保存失败:', e);
      throw new Error('项目保存失败，可能是 localStorage 空间不足');
    }
  }

  /**
   * 从 localStorage 加载项目
   */
  static load(): CardProject | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data) as CardProject;
    } catch (e) {
      console.error('项目加载失败:', e);
      return null;
    }
  }

  /**
   * 导出项目为 JSON 字符串
   */
  static exportJSON(project: CardProject): string {
    return JSON.stringify(project, null, 2);
  }

  /**
   * 从 JSON 字符串导入项目
   */
  static importJSON(json: string): CardProject {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      throw new Error('JSON 格式错误，无法解析');
    }

    // 基本字段校验
    const obj = parsed as Record<string, unknown>;
    if (!obj.topic || typeof obj.topic !== 'string') {
      throw new Error('无效的项目数据：缺少 topic 字段');
    }
    if (!obj.templateId || typeof obj.templateId !== 'string') {
      throw new Error('无效的项目数据：缺少 templateId 字段');
    }
    if (!Array.isArray(obj.cards)) {
      throw new Error('无效的项目数据：cards 必须为数组');
    }

    return parsed as CardProject;
  }

  /**
   * 触发 JSON 文件下载
   */
  static downloadJSON(project: CardProject): void {
    const json = this.exportJSON(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const safeName = (project.name || project.topic || 'project')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim();
    link.download = `${safeName}.json`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  }

  /**
   * 创建新项目
   */
  static createProject(
    topic: string,
    templateId: string,
    stylePresetId: string,
    cards: CardData[]
  ): CardProject {
    const now = new Date().toISOString();
    return {
      name: `${topic} - ${new Date().toLocaleDateString('zh-CN')}`,
      topic,
      templateId,
      stylePresetId,
      cards,
      createdAt: now,
      updatedAt: now,
    };
  }
}
