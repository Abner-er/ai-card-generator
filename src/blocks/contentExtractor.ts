/**
 * contentExtractor.ts — 多格式内容提取器
 *
 * 支持从 PDF、Markdown、网页文本中提取结构化知识内容。
 * 失败一律显式抛错，绝不静默返回假内容（历史上 smartExtract 的
 * 「LLM 失败降级启发式」链路从未被调用且会掩盖故障，已删除）。
 */
import { getSettings, getMode } from './settings';
import { isBrowserLike } from './gateway';
import { trimTitle, countChars } from './textUtil';

export interface ExtractResult {
  title: string;
  content: string;
  sourceType: 'pdf' | 'markdown' | 'text' | 'url';
  wordCount: number;
}

export interface ExtractOptions {
  mock?: boolean;
}

// PDF 解析（浏览器端使用 pdfjs-dist 的替代方案：纯文本提取）
export async function extractFromPDF(file: File): Promise<ExtractResult> {
  // 注意：生产环境需要引入 pdfjs-dist
  // 这里提供纯文本提取的 mock 实现
  const text = await readFileAsText(file);
  return parseMarkdownContent(text, file.name);
}

// Markdown 解析
export async function extractFromMarkdown(text: string, filename?: string): Promise<ExtractResult> {
  return parseMarkdownContent(text, filename);
}

// 网页文本提取（经由 dev server 的 /api/extract-url 代理抓取正文）
export async function extractFromURL(url: string, options?: ExtractOptions): Promise<ExtractResult> {
  if (options?.mock || getSettings().mock) {
    return {
      title: '示例网页内容',
      content: '这是一个从网页提取的示例内容，包含多个章节和知识点，用于演示流程。',
      sourceType: 'url',
      wordCount: 33,
    };
  }

  // /api/extract-url 是 dev server 的服务端抓取代理（绕开浏览器 CORS）。
  // 静态部署（GitHub Pages 等 local 模式）没有这个端点，请求会 404 且报错
  // 语义不明——显式拦截，引导用户改用「粘贴内容」入口。
  // 与 gateway 同口径：仅浏览器生效，node/测试环境透传给 stub fetch。
  if (isBrowserLike() && getMode() !== 'server') {
    throw new Error('当前为静态部署模式，网页链接抓取不可用（需服务端代理绕 CORS）。请打开链接复制正文后使用「粘贴内容」。');
  }

  const resp = await fetch('/api/extract-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error((data as { error?: string } | null)?.error || `网页抓取失败（HTTP ${resp.status}）`);
  }
  const raw = String((data as { content?: string } | null)?.content || '');
  // 只做空行折叠，不按 markdown 规则删行（正文里以 - / # 开头的行也是内容）
  const text = raw
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
  if (!text) throw new Error('未能提取到正文');

  const title = String((data as { title?: string } | null)?.title || '').trim() || detectTitle(text);
  return {
    title,
    content: text,
    sourceType: 'url',
    wordCount: countChars(text),
  };
}

// 纯文本提取
export async function extractFromText(text: string, filename?: string): Promise<ExtractResult> {
  return parseMarkdownContent(text, filename);
}

// Markdown/文本解析器
function parseMarkdownContent(text: string, source?: string): ExtractResult {
  // 去除 markdown 格式，保留纯文本结构
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/`([^`]+)`/g, '$1') // 行内代码
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[图片]') // 图片
    .replace(/^#{1,6}\s*.+$/gm, '') // 标题
    .replace(/^[*-]\s+.+$/gm, '') // 列表
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 粗体
    .replace(/\*([^*]+)\*/g, '$1') // 斜体
    .replace(/\n{3,}/g, '\n\n') // 多余空行
    .trim();

  const title = detectTitle(text) || source || '提取内容';
  const wordCount = countChars(cleanText);

  return {
    title,
    content: cleanText,
    sourceType: detectSourceType(text),
    wordCount,
  };
}

// 检测标题
function detectTitle(text: string): string {
  // 优先取第一个一级标题
  const h1Match = text.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  
  // 其次取第一个二级标题
  const h2Match = text.match(/^##\s+(.+)$/m);
  if (h2Match) return h2Match[1].trim();
  
  // 最后取第一行非空文本（智能截断，不腰斩英文单词）
  const firstLine = text.split('\n').find(line => line.trim().length > 0);
  if (firstLine && firstLine.length > 5) {
    return trimTitle(firstLine, '内容', 30);
  }
  
  return '内容';
}

// 检测来源类型
function detectSourceType(text: string): 'pdf' | 'markdown' | 'text' | 'url' {
  // 简单启发式检测
  if (text.includes('# ') || text.includes('## ') || text.includes('- ')) {
    return 'markdown';
  }
  // 假设纯文本
  return 'text';
}

// 读取文件为文本
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// 注：原 smartExtract（LLM 智能提取 + 失败降级启发式）为全项目零调用的死代码，
// 且降级路径含 CJK 字数失真、静默吞错两类历史缺陷，已整体删除。
