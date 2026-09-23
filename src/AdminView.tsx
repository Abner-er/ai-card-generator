/**
 * AdminView.tsx — 后台管理
 *
 * 统一管理系统配置：模型、温度、生图参数、API Key、端点、学习/测验参数。
 * server 模式（npm run dev）：写入服务端 settings.json，改完即时生效。
 * local 模式（静态部署，如 GitHub Pages）：设置与端点写 localStorage；
 * API Key 仅存本浏览器 localStorage，直连各家 API（网关见 blocks/gateway.ts），
 * 绝不进代码仓库或任何服务器。
 */
import { useEffect, useState } from 'react';
import {
  getSettings, getMode, getProxy, getKeysView, subscribe,
  saveRuntimeSettings, saveKeys, saveProxy, resetSettings,
  testTextModel, testImageModel, testCheckModel,
  DEFAULT_APP_NAME, DEFAULT_APP_SUBTITLE,
  type TestResult,
} from './blocks/settings';
import {
  STYLE_PRESETS, type PageBadgeFormat, type PageBadgePos,
} from './blocks/styleEngine';

interface Props {
  onBack: () => void;
  onToast: (m: string) => void;
}

/** 数值草稿（字符串承载，允许自由输入，保存时解析钳制） */
interface Draft {
  mock: boolean;
  appName: string;
  appSubtitle: string;
  uiStylePresetId: string;
  uiPageNumber: boolean;
  uiPagePos: PageBadgePos;
  uiPageFormat: PageBadgeFormat;
  textModel: string;
  checkModel: string;
  extractModel: string;
  temperature: string;
  selfCheckTemperature: string;
  extractTemperature: string;
  imageModel: string;
  imageProvider: 'qwen' | 'sensenova';
  promptExtend: boolean;
  maxRetries: string;
  retryBackoffSec: string;
  initialEase: string;
  minEase: string;
  easyBonus: string;
  quizCount: string;
  quizDifficulty: 'easy' | 'medium' | 'hard';
  textBaseUrl: string;
  dashBaseUrl: string;
  checkBaseUrl: string;
  senBaseUrl: string;
  keyAgnes: string;
  keyDash: string;
  keyCheck: string;
  keySen: string;
}

/** 页码角标可选位置 / 格式（与输入步骤的「输出选项」保持一致） */
const PAGE_POS_LABEL: Record<PageBadgePos, string> = {
  tl: '左上角', tc: '上边缘正中', tr: '右上角', bl: '左下角', bc: '下边缘正中', br: '右下角',
};
const PAGE_FMT_LABEL: Record<PageBadgeFormat, string> = {
  cn: '第 X / N 页', slash: 'X / N', dot: 'X · N',
};

/** 各服务商的默认模型名（切换服务商时联动填充目标默认） */
const DEFAULT_IMAGE_MODEL: Record<'qwen' | 'sensenova', string> = {
  qwen: 'qwen-image-3.0',
  sensenova: 'sensenova-u1.5-lite',
};

function draftFromSettings(): Draft {
  const s = getSettings();
  return {
    mock: s.mock,
    appName: s.app.name,
    appSubtitle: s.app.subtitle,
    uiStylePresetId: s.ui.stylePresetId,
    uiPageNumber: s.ui.pageNumber,
    uiPagePos: s.ui.pagePos,
    uiPageFormat: s.ui.pageFormat,
    textModel: s.text.model,
    checkModel: s.text.checkModel,
    extractModel: s.text.extractModel,
    temperature: String(s.text.temperature),
    selfCheckTemperature: String(s.text.selfCheckTemperature),
    extractTemperature: String(s.text.extractTemperature),
    imageModel: s.image.model,
    imageProvider: s.image.providerId,
    promptExtend: s.image.promptExtend,
    maxRetries: String(s.image.maxRetries),
    retryBackoffSec: String(s.image.retryBackoffMs / 1000),
    initialEase: String(s.study.initialEase),
    minEase: String(s.study.minEase),
    easyBonus: String(s.study.easyBonus),
    quizCount: String(s.quiz.defaultCount),
    quizDifficulty: s.quiz.defaultDifficulty,
    textBaseUrl: getProxy().textBaseUrl,
    dashBaseUrl: getProxy().dashBaseUrl,
    checkBaseUrl: getProxy().checkBaseUrl,
    senBaseUrl: getProxy().sensenovaBaseUrl,
    keyAgnes: '',
    keyDash: '',
    keyCheck: '',
    keySen: '',
  };
}

function clampNum(str: string, min: number, max: number, fallback: number, int = false): number {
  let v = parseFloat(str);
  if (Number.isNaN(v)) return fallback;
  v = Math.max(min, Math.min(max, v));
  return int ? Math.round(v) : Math.round(v * 100) / 100;
}

export default function AdminView({ onBack, onToast }: Props) {
  const [draft, setDraft] = useState<Draft>(draftFromSettings);
  const [mode, setMode] = useState(getMode());
  const [saving, setSaving] = useState(false);
  const [testingText, setTestingText] = useState(false);
  const [testingImage, setTestingImage] = useState(false);
  const [testingCheck, setTestingCheck] = useState(false);
  const [textTest, setTextTest] = useState<TestResult | null>(null);
  const [checkTest, setCheckTest] = useState<TestResult | null>(null);
  const [imgTest, setImgTest] = useState<TestResult | null>(null);
  const settings = getSettings();

  useEffect(() => subscribe(() => setMode(getMode())), []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /** 切换服务商：模型名是默认值时联动填充目标默认，用户自定义过则保留 */
  const switchProvider = (p: 'qwen' | 'sensenova') => {
    setDraft((d) => {
      const cur = DEFAULT_IMAGE_MODEL[d.imageProvider];
      const next = DEFAULT_IMAGE_MODEL[p];
      const model = d.imageModel === cur || d.imageModel === next ? next : d.imageModel;
      return { ...d, imageProvider: p, imageModel: model };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const keysPayload: { agnes?: string; dashscope?: string; check?: string; sensenova?: string } = {};
    if (draft.keyAgnes.trim()) keysPayload.agnes = draft.keyAgnes.trim();
    if (draft.keyDash.trim()) keysPayload.dashscope = draft.keyDash.trim();
    if (draft.keyCheck.trim()) keysPayload.check = draft.keyCheck.trim();
    if (draft.keySen.trim()) keysPayload.sensenova = draft.keySen.trim();

    const patch = {
      mock: draft.mock,
      app: {
        name: draft.appName.trim() || DEFAULT_APP_NAME,
        subtitle: draft.appSubtitle.trim(),
      },
      ui: {
        stylePresetId: draft.uiStylePresetId,
        pageNumber: draft.uiPageNumber,
        pagePos: draft.uiPagePos,
        pageFormat: draft.uiPageFormat,
      },
      text: {
        model: draft.textModel.trim() || 'agnes-2.5-flash',
        checkModel: draft.checkModel.trim(),
        extractModel: draft.extractModel.trim(),
        temperature: clampNum(draft.temperature, 0, 2, 0.6),
        selfCheckTemperature: clampNum(draft.selfCheckTemperature, 0, 2, 0),
        extractTemperature: clampNum(draft.extractTemperature, 0, 2, 0.3),
      },
      image: {
        providerId: draft.imageProvider,
        model: draft.imageModel.trim() || 'qwen-image-3.0',
        promptExtend: draft.promptExtend,
        maxRetries: clampNum(draft.maxRetries, 0, 5, 3, true),
        retryBackoffMs: clampNum(draft.retryBackoffSec, 1, 120, 20) * 1000,
      },
      study: {
        initialEase: clampNum(draft.initialEase, 1.3, 3.3, 2.5),
        minEase: clampNum(draft.minEase, 1.0, 2.5, 1.3),
        easyBonus: clampNum(draft.easyBonus, 1.0, 2.0, 1.3),
      },
      quiz: {
        defaultCount: clampNum(draft.quizCount, 1, 30, 10, true),
        defaultDifficulty: draft.quizDifficulty,
      },
    };
    // minEase 不应高于 initialEase
    if (patch.study.minEase > patch.study.initialEase) {
      patch.study.minEase = patch.study.initialEase;
      onToast('难度下限已钳制为不超过初始难度因子');
    }

    let res = await saveRuntimeSettings(patch);
    if (res.ok && (draft.textBaseUrl || draft.dashBaseUrl || draft.checkBaseUrl || draft.senBaseUrl)) {
      res = await saveProxy({
        ...(draft.textBaseUrl.trim() ? { textBaseUrl: draft.textBaseUrl.trim() } : {}),
        ...(draft.dashBaseUrl.trim() ? { dashBaseUrl: draft.dashBaseUrl.trim() } : {}),
        ...(draft.senBaseUrl.trim() ? { sensenovaBaseUrl: draft.senBaseUrl.trim() } : {}),
        // checkBaseUrl 允许清空（清空 = 回退 A 端点），故始终回传
        checkBaseUrl: draft.checkBaseUrl.trim(),
      });
    }
    if (res.ok && Object.keys(keysPayload).length) {
      res = await saveKeys(keysPayload);
    }
    setSaving(false);
    if (res.ok) {
      setDraft(draftFromSettings());
      setTextTest(null); setImgTest(null); setCheckTest(null);
      onToast('设置已保存，即时生效');
    } else {
      onToast('保存失败：' + res.error);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('确认恢复默认配置？API Key 不受影响。')) return;
    const res = await resetSettings();
    if (res.ok) {
      setDraft(draftFromSettings());
      onToast('已恢复默认配置');
    } else {
      onToast('重置失败：' + res.error);
    }
  };

  const runTextTest = async () => {
    setTestingText(true); setTextTest(null);
    setTextTest(await testTextModel());
    setTestingText(false);
  };
  const runCheckTest = async () => {
    setTestingCheck(true); setCheckTest(null);
    setCheckTest(await testCheckModel());
    setTestingCheck(false);
  };
  const runImageTest = async () => {
    setTestingImage(true); setImgTest(null);
    setImgTest(await testImageModel());
    setTestingImage(false);
  };

  const isServer = mode === 'server';
  const keyStatus = getKeysView();

  return (
    <div style={S.wrap} className="fade-in">
      <div style={S.head}>
        <button style={S.backBtn} onClick={onBack}>← 返回</button>
        <div style={S.headTitles}>
          <h2 style={S.h2}>⚙ 后台管理</h2>
          <p style={S.h2desc}>模型、密钥、学习参数统一在这里配置，保存后即时生效，无需重启</p>
        </div>
        <span style={{ ...S.modeBadge, ...(isServer ? S.modeServer : S.modeLocal) }}>
          {isServer ? '● 服务端模式' : '○ 本地模式'}
        </span>
      </div>

      {!isServer && (
        <div style={S.notice}>
          当前为静态部署模式：API Key 只保存在<b>本浏览器</b>（localStorage），请求由浏览器直连各服务商，
          不经过任何服务器；清除浏览器数据会丢失 Key，需重新填写。开发时可用 <code style={S.code}>npm run dev</code> 切回服务端模式。
        </div>
      )}

      {/* ============ 应用与默认输出 ============ */}
      <section style={S.section}>
        <div style={S.secHead}>
          <h3 style={S.secTitle}>🏷 应用与默认输出</h3>
          <span style={S.secHint}>名称即时生效；风格与页码是每次生成的默认值</span>
        </div>
        <div style={S.grid}>
          <Field label="应用名称" hint="导航栏标题与浏览器标签页">
            <input
              style={S.input}
              value={draft.appName}
              maxLength={24}
              onChange={(e) => set('appName', e.target.value)}
              placeholder={DEFAULT_APP_NAME}
            />
          </Field>
          <Field label="副标题" hint="名称下方小字，留空则不显示">
            <input
              style={S.input}
              value={draft.appSubtitle}
              maxLength={48}
              onChange={(e) => set('appSubtitle', e.target.value)}
              placeholder={DEFAULT_APP_SUBTITLE}
            />
          </Field>
          <Field label="默认视觉风格" hint="选「跟随 AI 推荐」时由模型按输入内容判断">
            <select style={S.select} value={draft.uiStylePresetId} onChange={(e) => set('uiStylePresetId', e.target.value)}>
              <option value="auto">✨ 跟随 AI 推荐</option>
              {STYLE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="默认页码角标" hint="在卡片图上标注页码">
            <Toggle
              on={draft.uiPageNumber}
              onChange={(v) => set('uiPageNumber', v)}
              label={draft.uiPageNumber ? '显示页码' : '不显示页码'}
            />
          </Field>
          <Field label="页码位置">
            <select
              style={{ ...S.select, ...(draft.uiPageNumber ? {} : S.fieldOff) }}
              value={draft.uiPagePos}
              disabled={!draft.uiPageNumber}
              onChange={(e) => set('uiPagePos', e.target.value as PageBadgePos)}
            >
              {(Object.keys(PAGE_POS_LABEL) as PageBadgePos[]).map((k) => (
                <option key={k} value={k}>{PAGE_POS_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="页码格式">
            <select
              style={{ ...S.select, ...(draft.uiPageNumber ? {} : S.fieldOff) }}
              value={draft.uiPageFormat}
              disabled={!draft.uiPageNumber}
              onChange={(e) => set('uiPageFormat', e.target.value as PageBadgeFormat)}
            >
              {(Object.keys(PAGE_FMT_LABEL) as PageBadgeFormat[]).map((k) => (
                <option key={k} value={k}>{PAGE_FMT_LABEL[k]}</option>
              ))}
            </select>
          </Field>
        </div>
        <p style={S.gridHint}>保存后立即生效：页码设置的改动会同步重建已生成的提示词；视觉风格作用于之后新生成的内容。</p>
      </section>

      {/* ============ 文本模型 ============ */}
      <section style={S.section}>
        <div style={S.secHead}>
          <h3 style={S.secTitle}>🧠 文本模型</h3>
          <span style={S.secHint}>生成（A）与质检（B）建议用不同家族的模型，规避自我偏好</span>
        </div>
        <div style={S.colWrap}>
          {/* —— 生成（A）列 —— */}
          <div style={S.col}>
            <div style={{ ...S.colHead, ...S.colHeadA }}>生成（A）</div>
            <Field label="生成模型" hint="内容拆解">
              <input style={S.input} value={draft.textModel} onChange={(e) => set('textModel', e.target.value)} placeholder="agnes-2.5-flash" />
            </Field>
            <Field label="生成温度（0 ~ 2）" hint="拆解创意度">
              <input style={S.input} type="number" min={0} max={2} step={0.05} value={draft.temperature} onChange={(e) => set('temperature', e.target.value)} />
            </Field>
            <Field label="请求端点（Base URL）">
              <input style={S.input} value={draft.textBaseUrl} onChange={(e) => set('textBaseUrl', e.target.value)} placeholder="https://api.agnes-ai.cn/v1" />
            </Field>
            <Field label={isServer ? 'API Key（服务端保管）' : 'API Key（仅存本浏览器）'} hint="主端点 Key，生成与提取共用">
              <div style={S.keyRow}>
                <input
                  style={S.input}
                  type="password"
                  autoComplete="off"
                  value={draft.keyAgnes}
                  onChange={(e) => set('keyAgnes', e.target.value)}
                  placeholder={keyStatus?.agnes?.set ? `已设置 ${keyStatus.agnes.masked}，留空不修改` : '粘贴新 Key…'}
                />
                {keyStatus?.agnes?.set && (
                  <button style={S.miniDanger} onClick={() => { set('keyAgnes', '__CLEAR__'); onToast('点击保存后将清除该 Key'); }}>清除</button>
                )}
              </div>
            </Field>
            <div style={S.testRow}>
              <button style={S.testBtn} onClick={runTextTest} disabled={testingText}>
                {testingText ? '测试中…' : '⚡ 测试生成模型'}
              </button>
              <TestResultView r={textTest} />
            </div>
          </div>

          {/* —— 质检（B）列 —— */}
          <div style={S.col}>
            <div style={{ ...S.colHead, ...S.colHeadB }}>质检（B）</div>
            <Field label="质检模型" hint="建议不同家族，留空 = 用生成模型">
              <input style={S.input} value={draft.checkModel} onChange={(e) => set('checkModel', e.target.value)} placeholder="Qwen/Qwen3.8-Flash-Next" />
            </Field>
            <Field label="质检温度（0 ~ 2）" hint="建议 0，保证质检可复现">
              <input style={S.input} type="number" min={0} max={2} step={0.05} value={draft.selfCheckTemperature} onChange={(e) => set('selfCheckTemperature', e.target.value)} />
            </Field>
            <Field label="质检端点（Base URL）" hint="留空 = 用生成端点">
              <input style={S.input} value={draft.checkBaseUrl} onChange={(e) => set('checkBaseUrl', e.target.value)} placeholder="https://api-inference.modelscope.cn/v1" />
            </Field>
            <Field label="质检 API Key" hint="独立端点对应的 Key">
              <div style={S.keyRow}>
                <input
                  style={S.input}
                  type="password"
                  autoComplete="off"
                  value={draft.keyCheck}
                  onChange={(e) => set('keyCheck', e.target.value)}
                  placeholder={keyStatus?.check?.set ? `已设置 ${keyStatus.check.masked}，留空不修改` : '粘贴新 Key…'}
                />
                {keyStatus?.check?.set && (
                  <button style={S.miniDanger} onClick={() => { set('keyCheck', '__CLEAR__'); onToast('点击保存后将清除该 Key'); }}>清除</button>
                )}
              </div>
            </Field>
            <div style={S.testRow}>
              <button style={S.testBtn} onClick={runCheckTest} disabled={testingCheck}>
                {testingCheck ? '测试中…' : '🔍 测试质检模型'}
              </button>
              <TestResultView r={checkTest} />
            </div>
          </div>

          {/* —— 提取列 —— */}
          <div style={S.col}>
            <div style={{ ...S.colHead, ...S.colHeadC }}>提取</div>
            <Field label="提取模型" hint="网页/长文抽取，留空 = 用生成模型">
              <input style={S.input} value={draft.extractModel} onChange={(e) => set('extractModel', e.target.value)} placeholder="可选" />
            </Field>
            <Field label="提取温度（0 ~ 2）" hint="内容抽取">
              <input style={S.input} type="number" min={0} max={2} step={0.05} value={draft.extractTemperature} onChange={(e) => set('extractTemperature', e.target.value)} />
            </Field>
            <Field label="走哪个端点 / Key？" hint="说明">
              <span style={S.staticText}>默认走左侧生成（A）的端点与 Key；如需独立配置提取链路，后续可扩展。</span>
            </Field>
          </div>
        </div>
      </section>

      {/* ============ 生图模型 ============ */}
      <section style={S.section}>
        <div style={S.secHead}>
          <h3 style={S.secTitle}>🎨 生图模型</h3>
          <span style={S.secHint}>
            {draft.imageProvider === 'sensenova' ? 'SenseNova U1.5 Lite 图文卡生成' : 'Qwen-Image 图文卡生成'}
          </span>
        </div>
        <div style={S.grid}>
          <Field label="生图服务商">
            <div style={S.keyRow}>
              <button style={{ ...S.segBtn, ...(draft.imageProvider !== 'sensenova' ? S.segOn : {}) }} onClick={() => switchProvider('qwen')}>通义千问 Qwen-Image</button>
              <button style={{ ...S.segBtn, ...(draft.imageProvider === 'sensenova' ? S.segOn : {}) }} onClick={() => switchProvider('sensenova')}>商汤 SenseNova U1.5</button>
            </div>
          </Field>
          <Field label="模型名称">
            <input style={S.input} value={draft.imageModel} onChange={(e) => set('imageModel', e.target.value)} placeholder={draft.imageProvider === 'sensenova' ? 'sensenova-u1.5-lite' : 'qwen-image-3.0'} />
          </Field>
          {draft.imageProvider === 'sensenova' ? (
            <>
              <Field label="SenseNova API Key" hint="https://platform.sensenova.cn 控制台获取，sk- 开头">
                <div style={S.keyRow}>
                  <input
                    style={S.input}
                    type="password"
                    autoComplete="off"
                    value={draft.keySen}
                    onChange={(e) => set('keySen', e.target.value)}
                    placeholder={keyStatus?.sensenova?.set ? `已设置 ${keyStatus.sensenova.masked}，留空不修改` : '粘贴新 Key…'}
                  />
                  {keyStatus?.sensenova?.set && (
                    <button style={S.miniDanger} onClick={() => { set('keySen', '__CLEAR__'); onToast('点击保存后将清除该 Key'); }}>清除</button>
                  )}
                </div>
              </Field>
              <Field label="SenseNova 端点（Base URL）">
                <input style={S.input} value={draft.senBaseUrl} onChange={(e) => set('senBaseUrl', e.target.value)} placeholder="https://token.sensenova.cn/v1" />
              </Field>
            </>
          ) : (
            <>
              <Field label="DashScope API Key">
                <div style={S.keyRow}>
                  <input
                    style={S.input}
                    type="password"
                    autoComplete="off"
                    value={draft.keyDash}
                    onChange={(e) => set('keyDash', e.target.value)}
                    placeholder={keyStatus?.dashscope?.set ? `已设置 ${keyStatus.dashscope.masked}，留空不修改` : '粘贴新 Key…'}
                  />
                  {keyStatus?.dashscope?.set && (
                    <button style={S.miniDanger} onClick={() => { set('keyDash', '__CLEAR__'); onToast('点击保存后将清除该 Key'); }}>清除</button>
                  )}
                </div>
              </Field>
              <Field label="DashScope 端点（Base URL）">
                <input style={S.input} value={draft.dashBaseUrl} onChange={(e) => set('dashBaseUrl', e.target.value)} placeholder="https://dashscope.aliyuncs.com" />
              </Field>
            </>
          )}
          <Field label="Prompt 自动扩写">
            <Toggle on={draft.promptExtend} onChange={(v) => set('promptExtend', v)} label={draft.promptExtend ? '开启（模型会润色提示词）' : '关闭（严格按提示词出图）'} />
          </Field>
          <Field label="重试次数（0 ~ 5）">
            <input style={S.input} type="number" min={0} max={5} step={1} value={draft.maxRetries} onChange={(e) => set('maxRetries', e.target.value)} />
          </Field>
          <Field label="限流退避（秒，1 ~ 120）" hint="429 后等待时长">
            <input style={S.input} type="number" min={1} max={120} step={1} value={draft.retryBackoffSec} onChange={(e) => set('retryBackoffSec', e.target.value)} />
          </Field>
        </div>
        <div style={S.testRow}>
          <button style={S.testBtn} onClick={runImageTest} disabled={testingImage}>
            {testingImage ? '测试中…' : '⚡ 测试鉴权'}
          </button>
          <TestResultView r={imgTest} />
        </div>
      </section>

      {/* ============ 学习参数 ============ */}
      <section style={S.section}>
        <div style={S.secHead}>
          <h3 style={S.secTitle}>📚 间隔重复（SM-2）</h3>
          <span style={S.secHint}>影响新建卡片与后续复习调度</span>
        </div>
        <div style={S.grid}>
          <Field label="初始难度因子（1.3 ~ 3.3）" hint="越大间隔增长越快，标准 2.5">
            <input style={S.input} type="number" min={1.3} max={3.3} step={0.05} value={draft.initialEase} onChange={(e) => set('initialEase', e.target.value)} />
          </Field>
          <Field label="难度因子上限钳制下限（1.0 ~ 2.5）" hint="复习失误衰减到此为止，标准 1.3">
            <input style={S.input} type="number" min={1.0} max={2.5} step={0.05} value={draft.minEase} onChange={(e) => set('minEase', e.target.value)} />
          </Field>
          <Field label="「简单」间隔加成（1.0 ~ 2.0）" hint="评简单时间隔额外乘数，标准 1.3">
            <input style={S.input} type="number" min={1.0} max={2.0} step={0.05} value={draft.easyBonus} onChange={(e) => set('easyBonus', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* ============ 测验参数 ============ */}
      <section style={S.section}>
        <div style={S.secHead}>
          <h3 style={S.secTitle}>📝 测验默认值</h3>
          <span style={S.secHint}>测验页未手动指定时的默认配置</span>
        </div>
        <div style={S.grid}>
          <Field label="默认题目数（1 ~ 30）">
            <input style={S.input} type="number" min={1} max={30} step={1} value={draft.quizCount} onChange={(e) => set('quizCount', e.target.value)} />
          </Field>
          <Field label="默认难度">
            <div style={S.seg}>
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  style={{ ...S.segBtn, ...(draft.quizDifficulty === d ? S.segOn : {}) }}
                  onClick={() => set('quizDifficulty', d)}
                >
                  {d === 'easy' ? '简单' : d === 'medium' ? '中等' : '困难'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="全局 Mock 模式" hint="占位预览，不调用真实模型">
            <Toggle on={draft.mock} onChange={(v) => set('mock', v)} label={draft.mock ? '已开启（全流程离线）' : '已关闭（真实调用）'} />
          </Field>
        </div>
      </section>

      {/* ============ 操作栏 ============ */}
      <div style={S.actions}>
        <button style={S.ghostBtn} onClick={handleReset}>恢复默认</button>
        <div style={{ flex: 1 }} />
        <button style={{ ...S.saveBtn, ...(saving ? S.disabled : {}) }} onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存全部设置'}
        </button>
      </div>
      <p style={S.footNote}>
        {isServer
          ? '配置写入项目根目录 settings.json（已 gitignore），API Key 仅存于本机服务端，浏览器不接触明文。'
          : '配置保存在本浏览器（localStorage），仅本机可见。'}
      </p>
    </div>
  );
}

/* ---------------- 小组件 ---------------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
      {hint && <span style={S.fieldHint}>{hint}</span>}
    </label>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={S.toggleRow} onClick={() => onChange(!on)}>
      <span style={{ ...S.toggleTrack, ...(on ? S.toggleOn : {}) }}>
        <span style={S.toggleKnob} />
      </span>
      <span style={S.toggleLabel}>{label}</span>
    </div>
  );
}

function TestResultView({ r }: { r: TestResult | null }) {
  if (!r) return null;
  if (r.ok) {
    return (
      <span style={S.testOk}>
        ✓ 通过 {r.latencyMs ? `（${r.latencyMs}ms）` : ''}{r.note ? ` · ${r.note}` : ''}
      </span>
    );
  }
  return <span style={S.testFail}>✗ {r.error}</span>;
}

/* ---------------- 样式 ---------------- */

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 820, margin: '0 auto', paddingBottom: 60 },
  head: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
  headTitles: { flex: 1 },
  backBtn: {
    padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-2)',
    background: 'var(--surface-2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
    backdropFilter: 'blur(8px)', flexShrink: 0, marginTop: 4,
  },
  h2: { fontSize: 24, fontWeight: 700, color: 'var(--text-bright)', letterSpacing: '-0.02em' },
  h2desc: { fontSize: 13, color: 'var(--text-muted)', marginTop: 4 },
  modeBadge: {
    fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap', marginTop: 6,
  },
  modeServer: { background: 'rgba(52,211,153,0.12)', color: 'var(--success)', border: '1px solid rgba(52,211,153,0.3)' },
  modeLocal: { background: 'rgba(251,191,36,0.12)', color: 'var(--warning)', border: '1px solid rgba(251,191,36,0.3)' },
  notice: {
    padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 13, lineHeight: 1.7,
    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: 'var(--text-secondary)',
  },
  code: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 6 },

  section: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
    padding: '20px 22px', marginBottom: 18, backdropFilter: 'blur(14px)', boxShadow: 'var(--shadow-md)',
  },
  secHead: { display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 },
  secTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' },
  secHint: { fontSize: 12, color: 'var(--text-faint)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 },
  colWrap: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14, alignItems: 'start' },
  col: {
    display: 'flex', flexDirection: 'column', gap: 12, padding: 14,
    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12,
  },
  colHead: {
    fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
    padding: '4px 10px', borderRadius: 8, alignSelf: 'flex-start',
  },
  colHeadA: { color: 'var(--accent-text)', background: 'rgba(var(--accent-rgb), 0.12)' },
  colHeadB: { color: 'var(--success)', background: 'rgba(var(--success-rgb), 0.12)' },
  colHeadC: { color: 'var(--text-muted)', background: 'var(--surface-3)' },
  staticText: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, padding: '9px 0' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' },
  fieldHint: { fontSize: 11, color: 'var(--text-faint)' },
  input: {
    padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-2)',
    background: 'var(--surface-3)', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%',
    fontFamily: 'inherit',
  },
  keyRow: { display: 'flex', gap: 8, alignItems: 'center' },
  select: {
    padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-2)',
    background: 'var(--surface-3)', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  fieldOff: { opacity: 0.45, cursor: 'not-allowed' },
  gridHint: { fontSize: 11.5, color: 'var(--text-faint)', marginTop: 14, lineHeight: 1.6 },
  miniDanger: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)',
    background: 'transparent', color: 'var(--error)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
  },

  toggleRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' },
  toggleTrack: {
    width: 40, height: 22, borderRadius: 999, background: 'var(--surface-2)',
    border: '1px solid var(--border-2)', position: 'relative', transition: 'background .2s', flexShrink: 0,
  },
  toggleOn: { background: 'var(--accent-gradient)', border: '1px solid transparent' },
  toggleKnob: {
    position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform .2s',
  },
  toggleLabel: { fontSize: 12.5, color: 'var(--text-secondary)' },

  seg: { display: 'inline-flex', border: '1px solid var(--border-2)', borderRadius: 10, overflow: 'hidden' },
  segBtn: {
    padding: '8px 14px', fontSize: 12.5, border: 'none', background: 'transparent',
    color: 'var(--text-muted)', cursor: 'pointer',
  },
  segOn: { background: 'var(--accent-gradient)', color: '#fff', fontWeight: 600 },

  testRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 },
  testBtn: {
    padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-2)',
    background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer',
  },
  testOk: { fontSize: 12.5, color: 'var(--success)' },
  testFail: { fontSize: 12.5, color: 'var(--error)' },

  actions: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 },
  ghostBtn: {
    padding: '10px 18px', borderRadius: 12, border: '1px solid var(--border-2)',
    background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
  },
  saveBtn: {
    padding: '12px 26px', borderRadius: 12, border: 'none', background: 'var(--accent-gradient)',
    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-glow)',
  },
  disabled: { opacity: 0.55, cursor: 'not-allowed' },
  footNote: { fontSize: 11.5, color: 'var(--text-faint)', marginTop: 12, lineHeight: 1.6 },
};
