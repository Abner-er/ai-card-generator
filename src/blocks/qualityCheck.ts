/**
 * blocks/qualityCheck.ts — 内容质量规则快检
 *
 * 纯规则、零 LLM 调用、前端即时运行。
 * 检查四个维度：完整性、逻辑一致性、数字合理性、风险分级。
 *
 * 设计原则：
 *  - 宁可漏报，不要误报（避免用户对"质检"失去信任）
 *  - 每条问题都带具体位置和修改建议
 *  - 评分制：0-100，按问题严重程度扣分
 */
import type { DecomposeResult, DecomposedModule } from './types';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface QualityIssue {
  /** 问题唯一编码，用于前端去重/统计 */
  code: string;
  /** 严重程度：error=必须改 / warning=建议改 / info=提示 */
  severity: IssueSeverity;
  /** 问题描述 */
  message: string;
  /** 修改建议（怎么改） */
  suggestion?: string;
  /** 关联的模块 ID（如果是模块级问题） */
  moduleId?: string;
  /** 关联的字段（title / body / bullets.0 等） */
  field?: string;
}

export interface QualityReport {
  /** 综合得分 0-100 */
  score: number;
  /** 各维度得分 */
  dimensions: {
    completeness: number;  // 完整性
    consistency: number;   // 逻辑一致性
    numerics: number;      // 数字合理性
    riskLevel: number;     // 风险分级（分数越高风险越低）
  };
  /** 问题列表，按严重程度排序（error 在前） */
  issues: QualityIssue[];
  /** 风险等级标签 */
  riskLabel: '低风险' | '中风险' | '高风险';
}

// ===== 风险领域关键词 =====
// 强词按领域分组。孤立的单次提及多是修辞/巧合（科技文里"这笔升级投资值不值"），
// 只有同一领域命中 2 个以上不同强词、或强词出现在标题层面（内容以此为主题），
// 才判定为真正的高风险领域内容，避免科技/生活文章被误报成"医疗、金融"。
const HIGH_RISK_DOMAINS: Array<{ name: string; words: string[] }> = [
  {
    name: '医学/健康',
    words: [
      '疾病', '治疗', '用药', '药方', '中医', '西医', '手术',
      '癌症', '肿瘤', '糖尿病', '高血压', '心脏病', '抑郁',
      '养生', '保健', '食疗', '偏方', '功效', '主治',
    ],
  },
  {
    name: '法律',
    words: ['法规', '诉讼', '违法', '犯罪', '判刑', '律师'],
  },
  {
    name: '金融/投资',
    words: [
      '股票', '基金', '投资', '理财', '证券', '期货', '外汇', '加密货币',
      '比特币', '回报率', '保本', '稳赚',
    ],
  },
];

// 弱词：宽泛领域词。技术内容里常作为"识别/处理对象"出现（如"金融票据识别"），
// 命中时若同模块处于技术处理语境则不算风险内容，否则降级为中风险提示。
const HIGH_RISK_WEAK = [
  '医学', '医疗', '诊断', '症状',
  '法律', '条例', '宪法', '刑法', '民法', '合同', '知识产权', '专利', '商标',
  '金融',
];

// 技术处理语境：与弱词同模块出现时，判定为"识别/处理某领域对象"的技术内容
const TECH_PROCESS_WORDS = [
  '识别', '检测', '图像', '算法', '模型', '训练', '数据', '票据', '单据',
  '证件', '证书', '文书', '光学', '字符', 'OCR', '分类', '分割', '特征',
  '提取', '深度学习', '神经网络', '计算机视觉', '扫描', '解析', '录入', '归档',
  '网络', '信息', '系统', '加密', '服务器', '软件', '程序', '代码',
];

const MEDIUM_RISK_KEYWORDS = [
  '儿童', '婴幼儿', '孕妇', '安全', '食用', '饮食', '营养', '减肥',
  '考试', '升学', '就业', '职场',
];

// ===== 无效感性词（内容层面的空洞修饰，不是风格层面的） =====
const VAGUE_ADJECTIVES = [
  '非常', '十分', '极其', '超级', '无比', '相当', '特别', '格外',
  '很多', '许多', '大量', '众多', '不少', '一些', '若干', '各种',
  '很好', '很棒', '优秀', '出色', '卓越', '顶级', '极致', '完美',
  '重要', '关键', '核心', '主要', '基本', '根本', '重要的',
];

// ===== 流程类主题的关键步骤检查（简单版：检测是否有步骤缺失的模式） =====
// 只做最有把握的：如果主题含"制作/流程/步骤"且模块里 step 类型少于 2 个，告警
const PROCESS_KEYWORDS = ['制作', '流程', '步骤', '怎么做', '方法', '工序', '工艺', '教程'];

// ===== 数字异常检测的启发式规则 =====
// 检测"明显不合理的数字"，但要非常保守，只报把握大的
function checkNumerics(text: string): string[] {
  const issues: string[] = [];
  // 匹配中文/阿拉伯数字 + 单位的组合
  const patterns = [
    // 时间类：XX小时/分钟/秒/天
    { regex: /(\d+(?:\.\d+)?)\s*(小时|个小时|h|小时以上)/g, unit: '小时', max: 1000, min: 0 },
    { regex: /(\d+(?:\.\d+)?)\s*(分钟|分|min)/g, unit: '分钟', max: 1440, min: 0 },
    { regex: /(\d+(?:\.\d+)?)\s*(天|日|天以上)/g, unit: '天', max: 365, min: 0 },
    { regex: /(\d+(?:\.\d+)?)\s*(年|年以上|多年)/g, unit: '年', max: 10000, min: 0 },
    // 温度
    { regex: /(\d+(?:\.\d+)?)\s*(℃|°C|度|摄氏度)/g, unit: '温度℃', max: 500, min: -100 },
    // 百分比
    { regex: /(\d+(?:\.\d+)?)\s*(%|百分之|％)/g, unit: '百分比', max: 100, min: 0 },
  ];

  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.regex.exec(text)) !== null) {
      const num = parseFloat(m[1]);
      if (num > p.max || num < p.min) {
        issues.push(`数字异常：${m[0]}（${p.unit}范围通常在 ${p.min}~${p.max} 之间）`);
      }
    }
  }
  return issues;
}

// ===== 主函数 =====
export function checkQuality(result: DecomposeResult): QualityReport {
  const issues: QualityIssue[] = [];
  const { modules, pages } = result;
  const allText = modules.map((m) => m.title + m.body + (m.bullets?.join('') || '')).join('');

  // ---------- 1. 完整性检查 ----------
  let completenessScore = 100;

  // 1.1 模块数量太少
  if (modules.length < 3) {
    issues.push({
      code: 'COMP-001',
      severity: 'warning',
      message: `模块数量偏少（${modules.length} 个），内容可能不够全面`,
      suggestion: '建议增加模块数量到 5 个以上，覆盖定义、原理、步骤、数据等多个角度',
    });
    completenessScore -= 15;
  } else if (modules.length < 5) {
    issues.push({
      code: 'COMP-002',
      severity: 'info',
      message: `模块数量较少（${modules.length} 个），建议补充更多知识点`,
      suggestion: '可以增加数据、对比、贴士等类型的模块丰富内容',
    });
    completenessScore -= 5;
  }

  // 1.2 缺封面模块
  if (!modules.some((m) => m.type === 'cover')) {
    issues.push({
      code: 'COMP-003',
      severity: 'warning',
      message: '缺少封面模块（type=cover）',
      suggestion: '第一个模块应为封面，包含系列大标题和核心介绍',
    });
    completenessScore -= 10;
  }

  // 1.3 流程类主题 step 模块太少
  const hasProcessTheme = PROCESS_KEYWORDS.some((kw) => allText.includes(kw));
  const stepCount = modules.filter((m) => m.type === 'step').length;
  if (hasProcessTheme && stepCount < 2) {
    issues.push({
      code: 'COMP-004',
      severity: 'warning',
      message: `主题是流程类，但步骤模块只有 ${stepCount} 个`,
      suggestion: '流程类主题建议拆出 3 个以上 step 类型模块，详细说明每一步',
    });
    completenessScore -= 15;
  }

  // 1.4 模块正文/要点太空
  let emptyModules = 0;
  modules.forEach((m) => {
    if (!m.body || m.body.length < 5) {
      emptyModules++;
      issues.push({
        code: 'COMP-005',
        severity: 'info',
        message: `模块「${m.title}」正文过短（${m.body?.length || 0} 字）`,
        suggestion: '正文至少写一句完整的说明，让读者快速理解核心内容',
        moduleId: m.id,
        field: 'body',
      });
    }
  });
  if (emptyModules > 0) completenessScore -= Math.min(emptyModules * 3, 15);

  // 1.5 visualHint 缺失
  let missingVisualHint = 0;
  modules.forEach((m) => {
    if (!m.visualHint || m.visualHint.length < 3) {
      missingVisualHint++;
    }
  });
  if (missingVisualHint > 0) {
    issues.push({
      code: 'COMP-006',
      severity: 'info',
      message: `${missingVisualHint} 个模块缺少配图说明（visualHint）`,
      suggestion: '每个模块都应有具体的配图主体描述，AI 生成的图才会精准',
    });
    completenessScore -= Math.min(missingVisualHint * 2, 10);
  }

  // ---------- 2. 逻辑一致性检查 ----------
  let consistencyScore = 100;

  // 2.1 模块间的明显矛盾（基于关键词反义对检测）
  const contradictionPairs: [string, string][] = [
    ['卤水', '石膏'],       // 点豆腐的两种凝固剂，一般只用一种
    ['生的', '煮熟'],
    ['加热', '冷藏'],
    ['增加', '减少'],
    ['上升', '下降'],
    ['正确', '错误'],
    ['优点', '缺点'],
  ];

  const allModuleTexts = modules.map((m) => ({
    id: m.id,
    title: m.title,
    text: m.title + ' ' + m.body + ' ' + (m.bullets?.join(' ') || ''),
  }));

  for (const [a, b] of contradictionPairs) {
    const modulesWithA = allModuleTexts.filter((m) => m.text.includes(a));
    const modulesWithB = allModuleTexts.filter((m) => m.text.includes(b));
    // 只有当两个词出现在同一个模块里且没有上下文说明时，才告警
    // （跨模块出现是正常的，比如对比模块里同时说优点和缺点）
    const sameModule = modulesWithA.filter((m) => modulesWithB.some((n) => n.id === m.id));
    for (const m of sameModule) {
      // 如果模块类型是 compare / definition 类型，对比是正常的，不报
      const mod = modules.find((x) => x.id === m.id);
      if (mod?.type === 'compare') continue;
      issues.push({
        code: 'CONS-001',
        severity: 'warning',
        message: `模块「${m.title}」中同时出现「${a}」和「${b}」，需确认是否存在逻辑矛盾`,
        suggestion: '如果是对比说明请明确标注；如果是笔误请修正',
        moduleId: m.id,
      });
      consistencyScore -= 8;
    }
  }

  // 2.2 重复内容检测（模块间正文高度相似）
  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      const sim = textSimilarity(modules[i].body, modules[j].body);
      if (sim > 0.7 && modules[i].body.length > 10) {
        issues.push({
          code: 'CONS-002',
          severity: 'warning',
          message: `模块「${modules[i].title}」与「${modules[j].title}」正文高度相似（相似度约 ${Math.round(sim * 100)}%）`,
          suggestion: '内容重复会浪费版面，建议合并或区分各自的侧重点',
          moduleId: modules[i].id,
        });
        consistencyScore -= 10;
      }
    }
  }

  // 2.3 空洞修饰词检测
  let vagueCount = 0;
  modules.forEach((m) => {
    const text = m.title + m.body + (m.bullets?.join('') || '');
    for (const adj of VAGUE_ADJECTIVES) {
      if (text.includes(adj)) vagueCount++;
    }
  });
  if (vagueCount > 3) {
    issues.push({
      code: 'CONS-003',
      severity: 'info',
      message: `发现 ${vagueCount} 处空洞修饰词（如"非常""很多""重要"等）`,
      suggestion: '尽量用具体数据或事实替代感性描述，提升内容可信度',
    });
    consistencyScore -= Math.min(vagueCount * 1.5, 10);
  }

  // ---------- 3. 数字合理性检查 ----------
  let numericsScore = 100;
  let numericIssues = 0;

  modules.forEach((m) => {
    const text = m.title + ' ' + m.body + ' ' + (m.bullets?.join(' ') || '');
    const numIssues = checkNumerics(text);
    numIssues.forEach((issueMsg) => {
      numericIssues++;
      issues.push({
        code: 'NUM-001',
        severity: 'warning',
        message: `模块「${m.title}」：${issueMsg}`,
        suggestion: '请核实数字是否准确，单位是否正确',
        moduleId: m.id,
      });
    });
  });

  if (numericIssues > 0) {
    numericsScore -= Math.min(numericIssues * 15, 40);
  }

  // ---------- 4. 风险分级 ----------
  let riskScore = 100;
  let riskLabel: QualityReport['riskLabel'] = '低风险';

  // 强词判定：同领域 2+ 个不同强词，或强词出现在标题（系列名/模块名/页名）才算主题级风险；
  // 正文里单次带过（"像做手术一样拆解""这笔投资值不值"）不计，避免跨主题误报
  const titleText =
    (result.seriesTitle || '') +
    ' ' + modules.map((m) => m.title).join(' ') +
    ' ' + pages.map((pg) => pg.title || '').join(' ');
  const hitStrong: string[] = [];
  for (const domain of HIGH_RISK_DOMAINS) {
    const hits = domain.words.filter((kw) => allText.includes(kw));
    if (!hits.length) continue;
    if (hits.length >= 2 || hits.some((kw) => titleText.includes(kw))) {
      hitStrong.push(...hits);
    }
  }
  // 弱词命中时剔除处于技术处理语境的（如"金融票据识别"里的"金融"不算金融风险内容）
  const hitWeak = HIGH_RISK_WEAK.filter((kw) => allText.includes(kw) && !inTechContext(modules, kw));
  const hitMedium = MEDIUM_RISK_KEYWORDS.filter((kw) => allText.includes(kw) && !inTechContext(modules, kw));

  if (hitStrong.length > 0) {
    riskLabel = '高风险';
    riskScore = 40;
    issues.push({
      code: 'RISK-001',
      severity: 'error',
      message: `内容涉及高风险领域：${hitStrong.slice(0, 5).join('、')}`,
      suggestion: '此内容仅供科普参考，不构成专业建议。建议在显著位置添加免责声明，并请专业人士审核后再发布',
    });
  } else if (hitWeak.length > 0) {
    riskLabel = '中风险';
    riskScore = 60;
    issues.push({
      code: 'RISK-002',
      severity: 'warning',
      message: `内容涉及敏感领域：${hitWeak.slice(0, 5).join('、')}（未构成具体建议，仍建议标注"仅供参考"）`,
      suggestion: '建议添加"内容仅供参考"提示，涉及具体操作请标注注意事项',
    });
  } else if (hitMedium.length > 0) {
    riskLabel = '中风险';
    riskScore = 70;
    issues.push({
      code: 'RISK-002',
      severity: 'warning',
      message: `内容涉及中风险领域：${hitMedium.slice(0, 5).join('、')}`,
      suggestion: '建议添加"内容仅供参考"提示，涉及具体操作请标注注意事项',
    });
  }

  // ---------- 汇总 ----------
  // 按严重程度排序
  const severityOrder = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // 综合得分（各维度加权）
  const score = Math.round(
    completenessScore * 0.3 +
    consistencyScore * 0.3 +
    numericsScore * 0.2 +
    riskScore * 0.2,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    dimensions: {
      completeness: Math.max(0, Math.round(completenessScore)),
      consistency: Math.max(0, Math.round(consistencyScore)),
      numerics: Math.max(0, Math.round(numericsScore)),
      riskLevel: Math.max(0, Math.round(riskScore)),
    },
    issues,
    riskLabel,
  };
}

// ===== 工具函数 =====

/** 命中词是否处于技术处理语境：同模块同时含"识别/检测/处理"类技术词 */
function inTechContext(modules: DecomposedModule[], kw: string): boolean {
  return modules.some((m) => {
    const t = m.title + ' ' + m.body + ' ' + (m.bullets?.join(' ') || '');
    return t.includes(kw) && TECH_PROCESS_WORDS.some((w) => t.includes(w));
  });
}

// 简单文本相似度（基于字符 n-gram）
function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (longer.length < 4) return 0;

  // 用 2-gram 计算
  const gramsA = new Set<string>();
  const gramsB = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) gramsA.add(a.slice(i, i + 2));
  for (let i = 0; i < b.length - 1; i++) gramsB.add(b.slice(i, i + 2));

  let intersection = 0;
  gramsA.forEach((g) => { if (gramsB.has(g)) intersection++; });
  const union = gramsA.size + gramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
