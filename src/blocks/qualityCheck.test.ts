/**
 * qualityCheck 回归测试（表驱动）
 *
 * 钉死的历史缺陷：
 *  - [A-2] 关键词单命中即判"高风险领域" → Wi-Fi 科技文因正文一句修辞
 *          （"像做手术一样""这笔投资值不值"）被误报"手术、投资"（用户截图）
 *  - [A-3] "收益"出现在金融词表 → "性能收益"误报金融内容
 *  - [A-4] 技术处理语境（"医学图像识别"）被误报医疗风险
 */
import { describe, it, expect } from 'vitest';
import { checkQuality } from './qualityCheck';
import type { DecomposeResult, DecomposedModule } from './types';

/** 构造最小可用的拆解结果（质检只读 title/body/bullets/type 及标题层文本） */
function make(
  seriesTitle: string,
  mods: Array<Partial<DecomposedModule> & { title: string; body?: string; bullets?: string[] }>,
): DecomposeResult {
  const modules = mods.map((m, i) => ({
    id: m.id ?? `m${i + 1}`,
    type: m.type ?? 'fact',
    title: m.title,
    body: m.body ?? '',
    bullets: m.bullets,
    ratio: '1:1',
    layout: 'text-top',
  })) as unknown as DecomposedModule[];
  return {
    seriesTitle,
    seriesStyle: { artStyle: 'flat', palette: 'x', mood: 'y', typography: 'z' },
    modules,
    pages: [{ id: 'p1', title: seriesTitle, moduleIds: modules.map((m) => m.id), ratio: '3:4' }],
  } as DecomposeResult;
}

/** 用户截图里的真实误报样本：科技文，正文两处修辞各命中一个医疗/金融强词 */
const wifiArticle = make(
  'Wi-Fi 8 深度解读',
  [
    { type: 'cover', title: 'Wi-Fi 8 深度解读', body: '新一代无线标准的技术细节' },
    { title: '升级要谨慎', body: '换路由器的这笔投资值不值，要看你家户型和设备数量' },
    { title: '拆解天线设计', body: '理解 Wi-Fi 8 像做手术一样，需要把每个射频链路拆开看' },
    { title: '频段与吞吐', body: '6GHz 频段引入后峰值速率翻倍，延迟显著下降' },
  ],
);

/** 真·医疗主题：同域多强词且标题层命中 */
const medicalArticle = make(
  '糖尿病饮食指南',
  [
    { type: 'cover', title: '糖尿病饮食指南', body: '血糖控制的营养学基础' },
    { title: '规范治疗', body: '糖尿病治疗需要遵循医嘱，不能擅自停药' },
    { title: '食疗误区', body: '食疗只能辅助，偏方无法替代手术和药物' },
  ],
);

/** 真·金融主题：同域 2+ 强词但均不在标题 */
const financeArticle = make(
  '家庭资产配置入门',
  [
    { type: 'cover', title: '家庭资产配置入门', body: '分散风险的基本方法' },
    { title: '基金定投', body: '基金适合长期持有，股票适合波段操作' },
    { title: '期货风险', body: '期货和证券的杠杆机制完全不同' },
  ],
);

/** 技术主题：医学影像识别算法，"医学/诊断"仅为处理对象 */
const ocrArticle = make(
  '医学影像识别技术',
  [
    { type: 'cover', title: '医学影像识别技术', body: '深度学习在放射科的应用边界' },
    { title: '识别流程', body: '模型对医学影像进行扫描解析，辅助诊断报告结构化提取' },
    { title: 'OCR 单据', body: '票据识别与光学字符检测是同一条技术路线' },
  ],
);

/** "收益"修辞：科技语境 */
const perfArticle = make(
  '缓存策略优化',
  [
    { type: 'cover', title: '缓存策略优化', body: '读写路径上的性能取舍' },
    { title: '命中率收益', body: '命中率每提升 1%，数据库压力明显下降，这是最直接的收益' },
  ],
);

describe('高风险判定：要主题级证据，不要单词巧合', () => {
  it('[A-2 回归] 科技文正文单次修辞（手术/投资）不得判高风险', () => {
    const r = checkQuality(wifiArticle);
    expect(r.riskLabel).not.toBe('高风险');
    expect(r.issues.some((i) => i.code === 'RISK-001')).toBe(false);
  });

  it('医疗主题（标题命中 + 同域多词）应判高风险', () => {
    const r = checkQuality(medicalArticle);
    expect(r.riskLabel).toBe('高风险');
    expect(r.issues.some((i) => i.code === 'RISK-001')).toBe(true);
  });

  it('金融主题（同域 2+ 强词）应判高风险', () => {
    const r = checkQuality(financeArticle);
    expect(r.riskLabel).toBe('高风险');
    expect(r.issues.some((i) => i.code === 'RISK-001')).toBe(true);
  });

  it('[A-4 回归] "医学影像识别"属技术处理语境，不应报医疗风险', () => {
    const r = checkQuality(ocrArticle);
    expect(r.riskLabel).toBe('低风险');
    expect(r.issues.some((i) => i.code === 'RISK-001' || i.code === 'RISK-002')).toBe(false);
  });

  it('[A-3 回归] "收益/性能收益"不再是金融风险词', () => {
    const r = checkQuality(perfArticle);
    expect(r.riskLabel).not.toBe('高风险');
  });

  it('跨域单词各命中一次（医疗1+金融1）累计不算主题级风险', () => {
    const mixed = make(
      '产品的两次重构',
      [
        { type: 'cover', title: '产品的两次重构', body: '用架构调整让老系统重生' },
        { title: '第一刀', body: '像手术一样把冗余模块切掉' },
        { title: '第二刀', body: '把这笔投入当成投资，看长期回报曲线' },
      ],
    );
    const r = checkQuality(mixed);
    expect(r.riskLabel).not.toBe('高风险');
  });
});
