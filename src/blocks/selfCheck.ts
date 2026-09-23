/**
 * blocks/selfCheck.ts — 跨模型质检（A 模型生成，B 模型检查）
 *
 * 让另一个 LLM 以"知识内容质检员"身份审查拆解结果，
 * 逐条检查模块内容的准确性、完整性、逻辑一致性。
 *
 * 为什么用 B 模型：同家族/同模型评审自己的输出存在自我偏好偏差
 * （self-preference bias，实测可系统性抬分），换一个不同家族的模型
 * 能显著降低偏袒。默认取 settings.text.checkModel，留空回退到生成模型。
 *
 * 注意：换模型解决的是"偏袒"，不解决"能力"——模型评审在难题上仍可能
 * 接近随机。这是"交叉质检"，不是事实核查：它能发现逻辑漏洞、遗漏、
 * 表述不清，但不能保证事实 100% 正确。真正的事实核查需要外部信息源
 * （搜索/RAG），不在此模块范围内。
 */
import type { DecomposeResult } from './types';
import { getSettings } from './settings';
import { gatewayFetch } from './gateway';
import { trimTitle } from './textUtil';

export interface SelfCheckIssue {
  /** 关联的模块 ID */
  moduleId?: string;
  /** 严重程度 */
  severity: 'error' | 'warning' | 'info';
  /** 问题类型：accuracy（准确性）/ logic（逻辑）/ completeness（完整性）/ clarity（表述） */
  type: 'accuracy' | 'logic' | 'completeness' | 'clarity';
  /** 问题描述 */
  message: string;
  /** 修改建议 */
  suggestion?: string;
}

export interface SelfCheckResult {
  /** 综合可信度评分 0-100 */
  confidenceScore: number;
  /** 逐模块的简短审查分析（质检模型先分析后结论，提升审查质量） */
  analysis?: string;
  /** 发现的问题列表 */
  issues: SelfCheckIssue[];
  /** 整体评价（一段话） */
  overallComment: string;
  /** 优化后的模块内容（可选，用户可一键采纳） */
  improvedModules?: Array<{
    id: string;
    title?: string;
    body?: string;
    bullets?: string[];
  }>;
}

export async function selfCheckContent(
  result: DecomposeResult,
  opts: { mock?: boolean } = {},
): Promise<SelfCheckResult> {
  const useMock = opts.mock ?? getSettings().mock;
  if (useMock) {
    return mockSelfCheck(result);
  }

  const system = buildSystemPrompt();
  const user = buildUserPrompt(result);

  const text = getSettings().text;
  // B 模型（质检）与 A 模型（生成）分离：留空回退到生成模型。
  // /ai-check-api 网关：配了独立端点/Key 就走独立端点（如 ModelScope 上的 Qwen），
  // 没配则回退 A 端点——与模型回退逻辑保持一致。
  const checkModel = text.checkModel.trim() || text.model;

  try {
    const resp = await gatewayFetch('/ai-check-api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: checkModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        // 质检要求可复现：温度固定走 selfCheckTemperature（默认 0）
        temperature: text.selfCheckTemperature,
        max_tokens: 8000,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`内容质检失败: ${resp.status} ${txt.slice(0, 160)}`);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseSelfCheckResult(content);
    if (parsed) return parsed;
    // 解析失败必须抛错：静默降级成 mock 会让用户把假结果当成 B 模型的质检结论
    throw new Error('质检结果解析失败：模型未返回合法 JSON');
  } catch (err) {
    console.warn('selfCheck failed:', err);
    throw err;
  }
}

function buildSystemPrompt(): string {
  return `你是一个严谨的知识内容质检员。待审查的内容由另一个 AI 模型生成，你是独立的第三方审查者——它与你的声誉无关，不必手下留情，也不必迎合它。

【审查方式】
先分析，后结论。在给出任何评分和问题列表之前，必须先逐模块、逐维度过一遍检查（写入 analysis 字段）。直接跳到结论会漏掉真问题。

【审查维度】
1. **准确性（accuracy）**：内容是否有明显的事实错误、数据不准、概念混淆。
   - 注意：你只能指出"你确定错误"的内容，不确定的不要瞎标。
   - 如果某个说法你不确定对错，标记为"待验证"而不是"错误"。

2. **逻辑性（logic）**：内容是否存在前后矛盾、因果倒置、推理跳跃、概念偷换。
   - 检查模块之间是否有说法不一致的地方。
   - 检查流程类内容步骤顺序是否合理。

3. **完整性（completeness）**：主题是否有明显遗漏的关键知识点。
   - 比如讲"做豆腐"不能漏掉"点卤"这个核心步骤。
   - 比如讲"糖尿病"不能只讲症状不讲治疗/预防。

4. **表述清晰度（clarity）**：内容是否含糊不清、有歧义、过于笼统。
   - "很多""非常好"这种空洞表述需要指出。
   - 专业术语没有解释、读者可能看不懂的，需要指出。

【输出格式】
只返回 JSON（不要任何解释、不要 markdown 代码块、不要反引号），且字段必须按下面的顺序生成——先写 analysis，再给结论：
{
  "analysis": "逐模块检查：m1（xxx）：准确性无问题，逻辑通顺…；m2（xxx）：第 2 条要点与 m1 正文矛盾…；m3（xxx）：「yyy」说法存疑，我确定它是错的因为…",
  "confidenceScore": 85,
  "overallComment": "整体内容质量较好，结构完整，但有 2 处数据需要核实，1 个关键步骤缺失。",
  "issues": [
    {
      "moduleId": "m3",
      "severity": "warning",
      "type": "accuracy",
      "message": "「豆腐起源于汉代淮南王刘安」这一说法存在争议，并非定论",
      "suggestion": "建议改为「相传豆腐起源于汉代淮南王刘安」或添加"据考证"等限定词"
    }
  ],
  "improvedModules": [
    {
      "id": "m3",
      "body": "相传豆腐起源于汉代淮南王刘安，距今已有两千多年历史。"
    },
    {
      "id": "m5",
      "bullets": ["Wi-Fi 7 使用 2.4/5/6 GHz 频段", "支持 320 MHz 信道", "支持 4K-QAM"]
    }
  ]
}

字段说明：
- analysis：必填。按模块顺序逐一写出你的检查过程和依据，每个模块 1-2 句；这是后续结论的推导基础，不许走过场
- confidenceScore：你对整组内容的可信度评分，0-100
- overallComment：整体评价，50 字以内
- issues：问题列表，按严重程度排序（error 在前），只允许包含 analysis 中有依据的问题
  - severity：error（必须改）/ warning（建议改）/ info（可优化）
  - type：accuracy / logic / completeness / clarity
- improvedModules：可选，给出你建议修改后的内容，只填需要改写的字段。**铁律：若你确认某条"要点(bullet)"存在事实/数据错误，必须给出该模块修正后的完整 bullets（最多 5 条，把错误要点替换为正确表述）——不要只写 suggestion 让用户手动改；同理，正文错误给修正后的 body**。用户"一键采纳"时只认 improvedModules 里的字段，光有 suggestion 不会真正改掉内容。

【重要原则】
- 先分析后结论：issues 和 confidenceScore 必须从 analysis 的检查过程中推导出来
- 宁缺毋滥：只报你有把握的问题，不要为了"显得专业"而凑数
- 实事求是：不确定就标"待验证"，不要瞎给结论
- 独立判断：内容质量差就给低分，不要客气；内容没问题就给高分，不要硬挑
- 聚焦重点：优先找真正影响内容质量的问题，小语病之类不用挑`;
}

function buildUserPrompt(result: DecomposeResult): string {
  const lines: string[] = [];
  lines.push(`主题/系列：${result.seriesTitle}`);
  lines.push('');
  lines.push('知识模块列表：');
  result.modules.forEach((m, i) => {
    lines.push(`${i + 1}. [${m.type}] ${m.title}（ID: ${m.id}）`);
    lines.push(`   正文：${m.body || '(空)'}`);
    if (m.bullets && m.bullets.length > 0) {
      lines.push(`   要点：${m.bullets.join('；')}`);
    }
  });
  lines.push('');
  lines.push('请先在 analysis 字段中逐模块写出检查过程，再给出评分、整体评价和问题列表。输出 JSON。');
  return lines.join('\n');
}

function parseSelfCheckResult(text: string): SelfCheckResult | null {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0]);
    const score = typeof p.confidenceScore === 'number' ? Math.max(0, Math.min(100, p.confidenceScore)) : 70;
    const comment = String(p.overallComment ?? '').slice(0, 200);
    const issues: SelfCheckIssue[] = Array.isArray(p.issues)
      ? p.issues
          .filter((x: any) => x && x.message)
          .map((x: any) => ({
            moduleId: x.moduleId ? String(x.moduleId) : undefined,
            severity: (['error', 'warning', 'info'].includes(x.severity) ? x.severity : 'warning') as SelfCheckIssue['severity'],
            type: (['accuracy', 'logic', 'completeness', 'clarity'].includes(x.type) ? x.type : 'clarity') as SelfCheckIssue['type'],
            message: String(x.message).slice(0, 200),
            suggestion: x.suggestion ? String(x.suggestion).slice(0, 200) : undefined,
          }))
      : [];
    const improved = Array.isArray(p.improvedModules)
      ? p.improvedModules
          .filter((x: any) => x && x.id)
          .map((x: any) => ({
            id: String(x.id),
            title: x.title ? trimTitle(x.title, '', 40) : undefined,
            body: x.body ? String(x.body).slice(0, 200) : undefined,
            bullets: Array.isArray(x.bullets) ? x.bullets.map((b: any) => String(b).slice(0, 50)).slice(0, 5) : undefined,
          }))
      : undefined;

    return {
      confidenceScore: score,
      analysis: p.analysis ? String(p.analysis).slice(0, 1500) : undefined,
      overallComment: comment,
      issues,
      improvedModules: improved,
    };
  } catch {
    return null;
  }
}

// ===== Mock 数据 =====
function mockSelfCheck(result: DecomposeResult): SelfCheckResult {
  const issues: SelfCheckIssue[] = [];

  // 根据模块数量和内容简单模拟几个问题
  const stepModules = result.modules.filter((m) => m.type === 'step');

  if (stepModules.length > 0 && stepModules.length < 4) {
    issues.push({
      moduleId: stepModules[0].id,
      severity: 'warning',
      type: 'completeness',
      message: '流程步骤可能不够完整，关键环节有遗漏风险',
      suggestion: '建议检查是否缺少核心步骤，确保流程闭环',
    });
  }

  const hasData = result.modules.some((m) => m.type === 'stat');
  if (!hasData) {
    issues.push({
      severity: 'info',
      type: 'completeness',
      message: '缺少数据类模块，可以增加具体数字增强说服力',
      suggestion: '考虑添加 1 个 stat 类型模块，用数据支撑内容',
    });
  }

  const totalBullets = result.modules.reduce((sum, m) => sum + (m.bullets?.length || 0), 0);
  if (totalBullets < result.modules.length) {
    issues.push({
      severity: 'info',
      type: 'clarity',
      message: '多数模块只有正文没有要点，信息层级不够清晰',
      suggestion: '建议为主要知识点模块补充 2-3 条要点，便于快速阅读',
    });
  }

  // 可信度评分
  let score = 82;
  if (issues.some((i) => i.severity === 'error')) score -= 20;
  if (issues.some((i) => i.severity === 'warning')) score -= 8;

  // 示例改写建议：让 mock 模式也能完整测试“对比 → 采纳 → 撤销”流程
  // 一条挂在 step 警告问题上（问题条目内联展示），一条挂在首个模块上（若无对应问题则走独立“AI 改写”卡片）
  const improvedModules: SelfCheckResult['improvedModules'] = [];
  const m0 = result.modules[0];
  if (m0) {
    improvedModules.push({
      id: m0.id,
      body: `【Mock 示例改写】${m0.body}`,
      bullets: m0.bullets?.length ? m0.bullets : ['示例要点一（采纳后可撤销）', '示例要点二'],
    });
  }
  if (stepModules[0] && stepModules[0].id !== m0?.id) {
    improvedModules.push({ id: stepModules[0].id, body: `【Mock 示例改写】${stepModules[0].body}` });
  }

  return {
    confidenceScore: Math.max(0, score),
    overallComment: `整体内容结构完整，共 ${result.modules.length} 个模块覆盖了主要知识点。${issues.length > 0 ? `发现 ${issues.length} 处可优化点，主要集中在${issues.map((i) => i.type).join('、')}方面。` : '未发现明显问题。'}`,
    issues,
    improvedModules,
  };
}
