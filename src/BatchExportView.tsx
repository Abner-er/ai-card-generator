/**
 * BatchExportView.tsx — 批量导出视图组件
 *
 * 支持批量导出整套提示词卡片为不同格式
 */
import { useState } from 'react';
import type { CardPage } from './blocks/types';
import type { ModuleStyle } from './blocks/types';
import { downloadFile } from './blocks/exportUtils';

interface BatchExportViewProps {
  pages: CardPage[];
  prompts: string[];
  style: ModuleStyle;
  seriesTitle: string;
  onBack: () => void;
  onToast: (msg: string) => void;
}

export default function BatchExportView({
  pages,
  prompts,
  style,
  seriesTitle,
  onBack,
  onToast,
}: BatchExportViewProps) {
  const [format, setFormat] = useState<'txt' | 'md' | 'json' | 'csv'>('txt');

  const handleExport = () => {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'txt':
        content = generateTxtExport();
        filename = `${seriesTitle || 'prompts'}-pages.txt`;
        mimeType = 'text/plain;charset=utf-8';
        break;
      case 'md':
        content = generateMdExport();
        filename = `${seriesTitle || 'prompts'}-pages.md`;
        mimeType = 'text/markdown;charset=utf-8';
        break;
      case 'json':
        content = generateJsonExport();
        filename = `${seriesTitle || 'prompts'}-pages.json`;
        mimeType = 'application/json;charset=utf-8';
        break;
      case 'csv':
        content = generateCsvExport();
        filename = `${seriesTitle || 'prompts'}-pages.csv`;
        mimeType = 'text/csv;charset=utf-8';
        break;
      default:
        return;
    }

    downloadFile(content, filename, mimeType);
    onToast(`已导出 ${format.toUpperCase()} 格式（${pages.length} 页）`);
  };

  function generateTxtExport(): string {
    return pages.map((pg, i) => {
      const title = pg.title || `第 ${i + 1} 页`;
      const prompt = prompts[i] || '';
      return `#${String(i + 1).padStart(2, '0')} ${title}\n\n${prompt}\n${'—'.repeat(50)}`;
    }).join('\n\n');
  }

  function generateMdExport(): string {
    const lines = [
      `# ${seriesTitle || '知识卡片系列'}`,
      '',
      `**风格**: ${style.artStyle || '默认风格'}`,
      `**配色**: ${style.palette || '默认'}`,
      `**页数**: ${pages.length}`,
      `**生成时间**: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '---',
      '',
    ];

    pages.forEach((pg, i) => {
      lines.push(`## 第 ${i + 1} 页: ${pg.title || '未命名'}`);
      lines.push('');
      lines.push('### 提示词');
      lines.push('');
      lines.push('```text');
      lines.push(prompts[i] || '');
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  function generateJsonExport(): string {
    const data = {
      title: seriesTitle,
      style: style.artStyle,
      palette: style.palette,
      mood: style.mood,
      generatedAt: new Date().toISOString(),
      pageCount: pages.length,
      pages: pages.map((pg, i) => ({
        index: i + 1,
        title: pg.title,
        ratio: pg.ratio,
        visualHint: pg.visualHint,
        prompt: prompts[i],
      })),
    };
    return JSON.stringify(data, null, 2);
  }

  function generateCsvExport(): string {
    const BOM = '\uFEFF';
    const header = '页码,标题,宽高比,视觉提示,提示词';
    const rows = pages.map((pg, i) => [
      i + 1,
      `"${(pg.title || '').replace(/"/g, '""')}"`,
      pg.ratio || '',
      `"${(pg.visualHint || '').replace(/"/g, '""')}"`,
      `"${(prompts[i] || '').replace(/"/g, '""')}"`,
    ].join(','));
    
    return BOM + [header, ...rows].join('\n');
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← 返回</button>
        <h2 style={styles.title}>批量导出</h2>
      </div>

      <div style={styles.optionsCard}>
        <h3 style={styles.optionTitle}>导出选项</h3>
        
        {/* 格式选择 */}
        <div style={styles.field}>
          <label style={styles.label}>导出格式</label>
          <div style={styles.formatGroup}>
            <FormatButton 
              active={format === 'txt'} 
              onClick={() => setFormat('txt')}
              label="TXT"
              desc="纯文本"
            />
            <FormatButton 
              active={format === 'md'} 
              onClick={() => setFormat('md')}
              label="MD"
              desc="Markdown"
            />
            <FormatButton 
              active={format === 'json'} 
              onClick={() => setFormat('json')}
              label="JSON"
              desc="结构化数据"
            />
            <FormatButton 
              active={format === 'csv'} 
              onClick={() => setFormat('csv')}
              label="CSV"
              desc="Excel 表格"
            />
          </div>
        </div>

        {/* 导出按钮 */}
        <button style={styles.exportBtn} onClick={handleExport}>
          导出 {format.toUpperCase()} 文件
          <span style={styles.exportCount}>（{pages.length} 页）</span>
        </button>

        {/* 预览 */}
        <div style={styles.preview}>
          <div style={styles.previewTitle}>预览（前 200 字符）</div>
          <pre style={styles.previewContent}>
            {format === 'txt' && generateTxtExport().slice(0, 200) + '...'}
            {format === 'md' && generateMdExport().slice(0, 200) + '...'}
            {format === 'json' && generateJsonExport().slice(0, 200) + '...'}
            {format === 'csv' && generateCsvExport().slice(0, 200) + '...'}
          </pre>
        </div>
      </div>

      {/* 格式说明 */}
      <div style={styles.infoCard}>
        <h4 style={styles.infoTitle}>格式说明</h4>
        <ul style={styles.infoList}>
          <li><b>TXT</b> — 最简单格式，适合复制粘贴到笔记软件</li>
          <li><b>MD</b> — Markdown 格式，适合版本控制和文档管理</li>
          <li><b>JSON</b> — 结构化数据，适合程序处理和数据迁移</li>
          <li><b>CSV</b> — Excel 兼容，适合数据分析和社会科学可视化</li>
        </ul>
      </div>
    </div>
  );
}

function FormatButton({ 
  active, 
  onClick, 
  label, 
  desc 
}: { 
  active: boolean; 
  onClick: () => void; 
  label: string; 
  desc: string;
}) {
  return (
    <button 
      style={{ ...styles.formatBtn, ...(active ? styles.formatBtnActive : {}) }}
      onClick={onClick}
    >
      <span style={styles.formatLabel}>{label}</span>
      <span style={styles.formatDesc}>{desc}</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '24px 20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all .2s',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-bright)',
    margin: 0,
  },
  optionsCard: {
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    boxShadow: 'var(--shadow-md)',
    marginBottom: 20,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  formatGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  },
  formatBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '14px 12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  formatBtnActive: {
    background: 'var(--accent-gradient)',
    borderColor: 'transparent',
    boxShadow: 'var(--shadow-glow)',
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-bright)',
  },
  formatDesc: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  exportBtn: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'transform .15s',
  },
  exportCount: {
    fontSize: 13,
    opacity: 0.9,
    fontWeight: 400,
  },
  preview: {
    marginTop: 24,
    padding: 16,
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 8,
    letterSpacing: '0.05em',
  },
  previewContent: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'monospace',
  },
  infoCard: {
    background: 'var(--surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow-sm)',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-bright)',
    margin: '0 0 12px 0',
  },
  infoList: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
  },
};
