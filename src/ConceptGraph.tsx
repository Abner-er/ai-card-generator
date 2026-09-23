/**
 * ConceptGraph.tsx — 概念关系图谱可视化组件
 *
 * 基于知识模块的关联关系，使用力导向图展示概念网络
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { KnowledgeModule } from './blocks/types';

interface ConceptNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  linkedCount: number;
}

interface ConceptLink {
  source: string;
  target: string;
  strength: number;
}

interface ConceptGraphProps {
  modules: KnowledgeModule[];
  onSelectModule?: (module: KnowledgeModule) => void;
  selectedModuleId?: string;
}

// 模块类型颜色映射
const TYPE_COLORS: Record<string, string> = {
  core: '#6366f1',      // 靛蓝
  summary: '#38bdf8',   // 天蓝
  detail: '#f59e0b',    // 琥珀
  example: '#10b981',   // 翠绿
  contrast: '#ef4444',  // 红色
  tip: '#8b5cf6',       // 紫色
  default: '#64748b',   // 石板灰
};

export default function ConceptGraph({ modules, onSelectModule, selectedModuleId }: ConceptGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  
  const [nodes, setNodes] = useState<ConceptNode[]>([]);
  const [links, setLinks] = useState<ConceptLink[]>([]);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 初始化图谱
  useEffect(() => {
    if (modules.length === 0) return;

    const { width, height } = containerRef.current?.getBoundingClientRect() || { width: 600, height: 400 };
    setDimensions({ width, height });

    // 创建节点
    const newNodes: ConceptNode[] = modules.map((mod, i) => ({
      id: mod.id,
      label: mod.title.slice(0, 12), // allow-truncation: 图节点标签视觉宽度限制
      type: mod.type,
      x: width / 2 + (Math.random() - 0.5) * width * 0.6,
      y: height / 2 + (Math.random() - 0.5) * height * 0.6,
      vx: 0,
      vy: 0,
      radius: Math.max(20, Math.min(40, 20 + (mod.bullets?.length || 0) * 3)),
      color: TYPE_COLORS[mod.type] || TYPE_COLORS.default,
      linkedCount: 0,
    }));

    // 计算关联（基于模块类型相似度和内容重叠）
    const newLinks: ConceptLink[] = [];
    for (let i = 0; i < newNodes.length; i++) {
      for (let j = i + 1; j < newNodes.length; j++) {
        const strength = calculateLinkStrength(modules[i], modules[j]);
        if (strength > 0.5) {
          newLinks.push({
            source: newNodes[i].id,
            target: newNodes[j].id,
            strength,
          });
          newNodes[i].linkedCount++;
          newNodes[j].linkedCount++;
        }
      }
    }

    setNodes(newNodes);
    setLinks(newLinks);
  }, [modules]);

  // 力导向模拟
  useEffect(() => {
    if (nodes.length === 0) return;

    const simulate = () => {
      setNodes(prevNodes => {
        const nextNodes = prevNodes.map(n => ({ ...n }));
        
        // 斥力（节点间相互排斥）
        for (let i = 0; i < nextNodes.length; i++) {
          for (let j = i + 1; j < nextNodes.length; j++) {
            const dx = nextNodes[j].x - nextNodes[i].x;
            const dy = nextNodes[j].y - nextNodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 500 / (dist * dist);
            
            nextNodes[i].vx -= (dx / dist) * force;
            nextNodes[i].vy -= (dy / dist) * force;
            nextNodes[j].vx += (dx / dist) * force;
            nextNodes[j].vy += (dy / dist) * force;
          }
        }

        // 引力（连线节点相互吸引）
        links.forEach(link => {
          const source = nextNodes.find(n => n.id === link.source);
          const target = nextNodes.find(n => n.id === link.target);
          if (!source || !target) return;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 100) * 0.01 * link.strength;

          source.vx += (dx / dist) * force;
          source.vy += (dy / dist) * force;
          target.vx -= (dx / dist) * force;
          target.vy -= (dy / dist) * force;
        });

        // 中心引力（防止节点飞出画布）
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        nextNodes.forEach(node => {
          node.vx += (centerX - node.x) * 0.001;
          node.vy += (centerY - node.y) * 0.001;
        });

        // 更新位置
        return nextNodes.map(node => ({
          ...node,
          x: Math.max(node.radius, Math.min(dimensions.width - node.radius, node.x + node.vx * 0.5)),
          y: Math.max(node.radius, Math.min(dimensions.height - node.radius, node.y + node.vy * 0.5)),
          vx: node.vx * 0.9, // 阻尼
          vy: node.vy * 0.9,
        }));
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes.length, links, dimensions]);

  // 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // 清空画布
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // 绘制连线
    links.forEach(link => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (!source || !target) return;

      const isHighlighted = hoveredNode === link.source || hoveredNode === link.target;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = isHighlighted 
        ? `rgba(99, 102, 241, ${link.strength})`
        : 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();
    });

    // 绘制节点
    nodes.forEach(node => {
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedModuleId === node.id;
      const radius = isHovered ? node.radius * 1.2 : node.radius;

      // 节点阴影
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.fill();
      }

      // 节点主体
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered || isSelected ? node.color : `${node.color}cc`;
      ctx.fill();

      // 边框
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // 标签
      ctx.fillStyle = '#fff';
      ctx.font = `${isHovered ? 'bold ' : ''}11px "DM Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    });
  }, [nodes, links, hoveredNode, selectedModuleId, dimensions]);

  // 鼠标交互
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: string | null = null;
    nodes.forEach(node => {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < node.radius * node.radius) {
        found = node.id;
      }
    });

    setHoveredNode(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  }, [nodes]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredNode || !onSelectModule) return;
    
    const module = modules.find(m => m.id === hoveredNode);
    if (module) {
      onSelectModule(module);
    }
  }, [hoveredNode, onSelectModule, modules]);

  if (modules.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>🔗</div>
        <p>暂无模块数据</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
      <div style={styles.legend}>
        <div style={styles.legendTitle}>模块类型</div>
        {Object.entries(TYPE_COLORS).slice(0, 6).map(([type, color]) => (
          <div key={type} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: color }} />
            <span style={styles.legendLabel}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculateLinkStrength(a: KnowledgeModule, b: KnowledgeModule): number {
  // 基于类型相同度
  let strength = a.type === b.type ? 0.5 : 0;
  
  // 基于标题关键词重叠
  const wordsA = new Set(a.title.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.title.toLowerCase().split(/\s+/));
  let overlap = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
  strength += overlap * 0.2;
  
  return Math.min(1, strength);
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: 400,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  legend: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: '12px 16px',
    background: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(8px)',
    borderRadius: 12,
    border: '1px solid var(--border)',
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 8,
    letterSpacing: '0.05em',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  legendLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    textTransform: 'capitalize',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
};
