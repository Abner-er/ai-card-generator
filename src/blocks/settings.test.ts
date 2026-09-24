import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportConfig, importConfig, getSettings, resetSettings,
  CONFIG_BUNDLE_VERSION, DEFAULT_APP_NAME,
} from './settings';

describe('配置导出 / 导入', () => {
  beforeEach(async () => {
    await resetSettings();
  });

  it('导出结构完整并带来源标识与版本号', () => {
    const b = exportConfig();
    expect(b.app).toBe('ai-card-generator');
    expect(b.version).toBe(CONFIG_BUNDLE_VERSION);
    expect(b.settings.text.model).toBeTruthy();
    expect(b.proxy.textBaseUrl).toBeTruthy();
    expect(typeof b.exportedAt).toBe('string');
  });

  it('拒绝结构不对的文件', async () => {
    const bad: unknown[] = [null, undefined, 'x', 42, [], {}, { foo: 1 }, { settings: 'nope' }, { settings: [] }];
    for (const item of bad) {
      const r = await importConfig(item);
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy();
    }
  });

  it('导入合法配置后设置生效', async () => {
    const r = await importConfig({
      settings: { mock: true, app: { name: '测试名' }, text: { model: 'my-model' } },
    });
    expect(r.ok).toBe(true);
    const s = getSettings();
    expect(s.mock).toBe(true);
    expect(s.app.name).toBe('测试名');
    expect(s.text.model).toBe('my-model');
  });

  it('过滤脏数据：类型不符 / 未知键 / 非法枚举都不吸收', async () => {
    await importConfig({ settings: { text: { model: 'good-model' } } });
    await importConfig({
      settings: {
        text: { temperature: 'hot', model: 123, unknownField: 'x' },
        ui: { stylePresetId: '不存在的预设', pagePos: 'middle', pageFormat: 'dot' },
        image: { providerId: 'evil' },
        quiz: { defaultDifficulty: 'impossible' },
      },
    });
    const s = getSettings();
    expect(s.text.model).toBe('good-model');
    expect(s.text.temperature).toBe(0.6);
    expect(Object.keys(s.text)).not.toContain('unknownField');
    expect(s.ui.stylePresetId).toBe('auto');
    expect(s.ui.pagePos).toBe('tr');
    expect(s.ui.pageFormat).toBe('dot');
    expect(s.image.providerId).toBe('qwen');
    expect(s.quiz.defaultDifficulty).toBe('medium');
  });

  it('导出后再导入可还原设置', async () => {
    await importConfig({ settings: { app: { name: '往返测试', subtitle: 'sub' }, quiz: { defaultCount: 7 } } });
    const bundle = exportConfig();

    await resetSettings();
    expect(getSettings().app.name).toBe(DEFAULT_APP_NAME);
    expect(getSettings().quiz.defaultCount).toBe(10);

    const r = await importConfig(bundle);
    expect(r.ok).toBe(true);
    expect(getSettings().app.name).toBe('往返测试');
    expect(getSettings().app.subtitle).toBe('sub');
    expect(getSettings().quiz.defaultCount).toBe(7);
  });

  it('代理口令与代理端点随配置导出 / 导入往返一致', async () => {
    const proxyUrl = 'https://p.example.com/https/api.agnes-ai.cn/v1';
    await importConfig({
      settings: { app: { name: '托管测试' } },
      proxy: { proxyToken: 'tok-1', textBaseUrl: proxyUrl },
    });
    const b = exportConfig();
    expect(b.proxy.proxyToken).toBe('tok-1');
    expect(b.proxy.textBaseUrl).toBe(proxyUrl);

    // 只改口令：端点应保持（saveProxy 是合并语义，不是整体替换）
    await importConfig({ settings: { app: { name: '覆盖后' } }, proxy: { proxyToken: 'tok-2' } });
    expect(exportConfig().proxy.proxyToken).toBe('tok-2');
    expect(exportConfig().proxy.textBaseUrl).toBe(proxyUrl);
  });

  it('导入时非字符串的口令被丢弃，不写进配置', async () => {
    await importConfig({ settings: { app: { name: 'x' } }, proxy: { proxyToken: { evil: 1 } } });
    expect(exportConfig().proxy.proxyToken).toBe('');
  });

  it('恢复默认会清掉端点与代理口令，避免凭证静默残留', async () => {
    await importConfig({
      settings: { app: { name: 'x' } },
      proxy: { proxyToken: 'tok-residue', textBaseUrl: 'https://p.example.com/https/a.cn/v1' },
    });
    expect(exportConfig().proxy.proxyToken).toBe('tok-residue');

    await resetSettings();
    const after = exportConfig();
    expect(after.proxy.proxyToken).toBe('');
    expect(after.proxy.textBaseUrl).toBe('https://api.agnes-ai.cn/v1');
  });
});
