/**
 * blocks/expandForLearn.ts — 学习内容扩写服务（LLM）
 *
 * 拆解出的每个模块是「给生图用」的极简骨架（body≤40字、bullets≤4条），
 * 直接拿来做学习页太单薄。本服务调用模型把每个模块「扩写成给学习者读的内容」：
 * 更完整的正文、分层要点、备注/延伸——不追求压缩，追求讲透、可读、有层次。
 *
 * 一次性把整批模块并发发出，返回键为模块 id 的映射。
 */
import type { DecomposedModule, LearnModule, ModuleStyle } from './types';
import { getSettings } from './settings';
import { gatewayFetch } from './gateway';

export interface ExpandOptions {
  mock?: boolean;
}

/** 将模块拆解结果中的模块列表作为输入，扩写学习内容 */
export async function expandForLearn(
  modules: DecomposedModule[],
  style: ModuleStyle,
  opts: ExpandOptions = {},
): Promise<Map<string, LearnModule>> {
  if (!modules.length) return new Map();
  const useMock = opts.mock ?? getSettings().mock;
  if (useMock) return mockExpand(modules);

  const system = buildExpandSystemPrompt(style);
  const user = buildExpandUser(modules);

  try {
    const resp = await gatewayFetch('/ai-api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getSettings().text.extractModel || getSettings().text.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`学习内容扩写失败: ${resp.status} ${txt.slice(0, 160)}`);
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseExpand(text, modules);
    if (parsed.size) return parsed;
    throw new Error('模型输出无法解析为扩写内容，请重试');
  } catch (err) {
    // 此前失败会静默返回 mockExpand（把骨架原样拷一遍充当"已扩写"），
    // 用户以为学习页拿到了完整内容，实际什么也没多。改为显式抛错，
    // 调用方（App.runExpandLearn）学习页自然按骨架显示并提示失败原因。
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg.startsWith('学习内容扩写失败') ? msg : `学习内容扩写失败：${msg}`);
  }
}

function buildExpandSystemPrompt(style: ModuleStyle): string {
  return `你是知识整理与学习内容编辑。用户会给你一批「知识点骨架」，每个骨架只有一句话正文和几句要点，这是为了给图片生成压缩过的。

你的任务：把这些骨架扩写为「给学习者阅读」的完整学习内容。记住读者是人，不是画家——内容要讲清楚、讲透、有层次，但绝不能跑题或编造。

对每个骨架，输出三块：
- fullBody：一段完整的正文，2~5 句话，把该知识点讲清楚、讲透。以一句话开门见山表明核心，再展开解释、补充关键细节、点出为什么重要。
- fullBullets：3~6 条分层要点，每一条是一句完整的话，覆盖该知识点的主要方面（定义、机制、应用、易错点等）。
- notes：可选，1~2 句「备注 / 延伸 / 易错提醒」，写正文没覆盖但有价值的补充；没有可省略。

约束：
- 严格基于给定的骨架展开，不要自行引入不存在的概念，不要编造事实。
- 语言风格：清晰、专业、平实，面向有一定基础的读者。
- 全部使用简体中文输出（骨架里是英文缩写如 MQTT、QoS 可保留原样）。

输出格式：必须是严格的 JSON 对象，键为骨架的 id，值为 {"fullBody": "...", "fullBullets": ["..."], "notes": "..."}。不要输出任何 JSON 以外的说明文字。`;
}

function buildExpandUser(modules: DecomposedModule[]): string {
  const rows = modules
    .map((m) => `#${m.id}（类型：${m.type}）\n标题：${m.title}\n正文骨架：${m.body}\n要点骨架：${(m.bullets ?? []).join('；') || '无'}`)
    .join('\n\n');
  return `以下是全部知识点骨架，请逐条扩写为完整学习内容，以 JSON 对象返回（键为各自的 id）：\n\n${rows}`;
}

function parseExpand(text: string, modules: DecomposedModule[]): Map<string, LearnModule> {
  // 模型可能用 ```json 包裹，剔除
  const cleaned = text
    .replace(/```(?:json)?/gi, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    console.warn('expand JSON parse failed:', e);
    return new Map();
  }
  const map = new Map<string, LearnModule>();
  const validIds = new Set(modules.map((m) => m.id));
  for (const id of Object.keys(obj)) {
    if (!validIds.has(id)) continue;
    const v = obj[id] as Partial<LearnModule> | undefined;
    if (!v || typeof v !== 'object') continue;
    const fullBody = typeof v.fullBody === 'string' && v.fullBody.trim() ? v.fullBody.trim() : '';
    const rawBullets = Array.isArray(v.fullBullets)
      ? v.fullBullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
      : [];
    const notes = typeof v.notes === 'string' && v.notes.trim() ? v.notes.trim() : undefined;
    if (!fullBody) continue;
    map.set(id, { id, fullBody, fullBullets: rawBullets, notes });
  }
  return map;
}

/** Mock：把骨架稍作展开，保证流程可跑、UI 可看 */
function mockExpand(modules: DecomposedModule[]): Map<string, LearnModule> {
  const map = new Map<string, LearnModule>();
  for (const m of modules) {
    const bullets = (m.bullets ?? []).length
      ? [...(m.bullets ?? [])]
      : [`${m.title}：${m.body}`];
    map.set(m.id, {
      id: m.id,
      fullBody: m.body,
      fullBullets: bullets.slice(0, 6),
      notes: undefined,
    });
  }
  return map;
}