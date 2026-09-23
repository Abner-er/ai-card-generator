/**
 * StepErrorBoundary.tsx — 步骤内容错误边界
 *
 * 背景（历史 bug）：生成提示词进入 prompts 步骤后，子视图一旦渲染抛错，
 * React 18 在无边界时会卸载整棵组件树——所有按钮瞬间全部失效，
 * 用户唯一的出路是手动刷新页面（刷新会丢失刚粘贴的输入）。
 *
 * 边界行为：
 *  - 崩溃时不再白屏/死页，显示错误卡片 + 「重新渲染」「返回输入页」两个出口
 *  - stepKey 变化（顶栏导航仍能切步骤）时自动清除错误态，恢复正常渲染
 */
import { Component } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 当前步骤标识：变化时自动重置错误态 */
  stepKey: string;
  /** 逃生出口：回到输入页 */
  onEscape: () => void;
}

interface State {
  error: Error | null;
}

const S: Record<string, CSSProperties> = {
  box: {
    padding: '28px 24px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-md)',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-bright)',
    margin: '0 0 10px',
  },
  msg: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--text-mute)',
    margin: '0 0 18px',
    wordBreak: 'break-all',
  },
  btns: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  btn: {
    padding: '9px 18px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: '9px 18px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default class StepErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // 保留控制台堆栈，便于排查具体渲染抛错点
    console.error('[StepErrorBoundary] 步骤内容渲染失败：', error);
  }

  componentDidUpdate(prev: Props) {
    if (prev.stepKey !== this.props.stepKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={S.box} className="fade-in">
        <h2 style={S.title}>⚠️ 当前页面渲染出错</h2>
        <p style={S.msg}>
          错误信息：{this.state.error.message || '未知错误'}
          <br />
          你可以尝试重新渲染本页；若反复出错，请返回输入页重新开始（已生成的闪卡保存在本地，不会丢失）。
        </p>
        <div style={S.btns}>
          <button style={S.btn} onClick={() => this.setState({ error: null })}>
            重新渲染
          </button>
          <button style={S.btnPrimary} onClick={this.props.onEscape}>
            ← 返回输入页
          </button>
        </div>
      </div>
    );
  }
}
