import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { CardTemplate, CardContent, AIImageConfig, AITextConfig, AIGeneratedContent, WorkflowStep, ContentSection } from './types';
import { templates } from './templates';
import { ImageGenerationService } from './services/imageService';
import { ContentGenerationService } from './services/contentService';
import { PromptBuilder } from './services/promptBuilder';
import { ExportService } from './services/exportService';
import { CardRenderer } from './components/CardRenderer';
import { RichCardRenderer } from './components/RichCardRenderer';

const EMPTY_CONTENT: CardContent = {
  title: '', subtitle: '', body: '', footer: '', tags: [],
};

const DEFAULT_AI_IMAGE_CONFIG: AIImageConfig = {
  provider: 'mock', size: '1024*1024', mode: 'fast',
};

const DEFAULT_AI_TEXT_CONFIG: AITextConfig = {
  provider: 'mock',
};

const App: React.FC = () => {
  // 工作流状态
  const [step, setStep] = useState<WorkflowStep>('input');
  const [topic, setTopic] = useState('');

  // 模板与内容
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate>(templates[0]);
  const [content, setContent] = useState<CardContent>(EMPTY_CONTENT);
  const [aiContent, setAiContent] = useState<AIGeneratedContent | null>(null);

  // AI配置
  const [imageConfig, setImageConfig] = useState<AIImageConfig>(DEFAULT_AI_IMAGE_CONFIG);
  const [textConfig, setTextConfig] = useState<AITextConfig>(DEFAULT_AI_TEXT_CONFIG);
  const [apiKey, setApiKey] = useState('');
  const [textApiKey, setTextApiKey] = useState('');

  // 生成状态
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewScale, setPreviewScale] = useState(0.35);
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');

  // Refs
  const cardRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageServiceRef = useRef(new ImageGenerationService(DEFAULT_AI_IMAGE_CONFIG));
  const contentServiceRef = useRef(new ContentGenerationService(DEFAULT_AI_TEXT_CONFIG));

  // 自动计算缩放
  useEffect(() => {
    const calc = () => {
      if (previewContainerRef.current) {
        const w = previewContainerRef.current.clientWidth - 48;
        const h = previewContainerRef.current.clientHeight - 48;
        setPreviewScale(Math.min(w / selectedTemplate.canvas.width, h / selectedTemplate.canvas.height, 0.5));
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [selectedTemplate]);

  // ===== 步骤1: AI生成内容 =====
  const handleGenerateContent = useCallback(async () => {
    if (!topic.trim()) { setErrorMsg('请输入主题'); return; }

    setStep('generating-content');
    setStatus('AI正在搜索知识并生成内容...');
    setErrorMsg('');

    try {
      contentServiceRef.current.updateConfig({ ...textConfig, apiKey: textApiKey });
      const result = await contentServiceRef.current.generate(topic, selectedTemplate);

      setAiContent(result);
      setContent({
        title: result.title,
        subtitle: result.subtitle,
        body: result.body,
        footer: `知识卡片 · ${new Date().toLocaleDateString('zh-CN')}`,
        tags: result.tags,
        sections: result.sections,
        highlights: result.highlights,
        chapter: result.chapter,
      });

      // 设置AI生成的图片提示词
      setEditedPrompt(result.imagePrompt || PromptBuilder.build(selectedTemplate.promptTemplate, {
        title: result.title, subtitle: result.subtitle, body: result.body, footer: '', tags: result.tags,
      }));

      setStep('review-content');
      setStatus('内容已生成，请检查并编辑');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '内容生成失败');
      setStep('input');
      setStatus('');
    }
  }, [topic, selectedTemplate, textConfig, textApiKey]);

  // ===== 步骤2: 生成AI底图 =====
  const handleGenerateImage = useCallback(async () => {
    setStep('generating-image');
    setStatus('正在生成AI底图...');
    setErrorMsg('');

    try {
      imageServiceRef.current.updateConfig({ ...imageConfig, apiKey });

      const imageLayer = selectedTemplate.layers?.find(l => l.type === 'image');
      const imgWidth = imageLayer?.width || 1080;
      const imgHeight = imageLayer?.height || 900;

      // 使用用户编辑后的提示词（如果有）或AI生成的提示词
      const { prompt: finalPrompt, negative } = PromptBuilder.rebuildFromEditedContent(
        selectedTemplate.promptTemplate,
        content,
        selectedTemplate,
        editedPrompt || aiContent?.imagePrompt
      );

      // 更新模板的提示词配置
      const updatedConfig = {
        ...selectedTemplate.promptTemplate,
        subject: finalPrompt,
        negative,
      };

      const url = await imageServiceRef.current.generate(updatedConfig, content, imgWidth, imgHeight);
      setImageUrl(url);
      setStep('done');
      setStatus('底图生成完成，可导出图片');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '图片生成失败');
      setStep('review-content');
      setStatus('');
    }
  }, [selectedTemplate, content, imageConfig, apiKey, editedPrompt, aiContent]);

  // ===== 导出PNG =====
  const handleExport = useCallback(async () => {
    if (!cardRef.current) return;
    setStatus('正在导出图片...');
    try {
      const dataUrl = await ExportService.exportAsPng(cardRef.current, {
        width: selectedTemplate.canvas.width,
        height: selectedTemplate.canvas.height,
        pixelRatio: 2,
        backgroundColor: selectedTemplate.canvas.backgroundColor,
      });
      ExportService.download(dataUrl, `${content.title || '知识卡片'}-${Date.now()}.png`);
      setStatus('导出完成');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出失败');
    }
  }, [selectedTemplate, content]);

  // ===== 重新开始 =====
  const handleReset = useCallback(() => {
    setStep('input');
    setTopic('');
    setContent(EMPTY_CONTENT);
    setAiContent(null);
    setImageUrl('');
    setStatus('');
    setErrorMsg('');
    setEditedPrompt('');
  }, []);

  // 当前提示词信息
  const currentPromptInfo = aiContent
    ? PromptBuilder.buildFromAIContent(selectedTemplate.promptTemplate, content, aiContent)
    : { prompt: PromptBuilder.build(selectedTemplate.promptTemplate, content), negative: selectedTemplate.promptTemplate.negative, source: 'template' as const };

  // 输入框组件
  const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }> =
    ({ label, value, onChange, placeholder, multiline }) => (
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        {multiline ? (
          <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition resize-y" rows={3}
            value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        ) : (
          <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        )}
      </div>
    );

  // 步骤指示器
  const StepIndicator: React.FC = () => {
    const steps = [
      { key: 'input', label: '输入主题', icon: '1' },
      { key: 'review-content', label: '检查内容', icon: '2' },
      { key: 'done', label: '生成底图', icon: '3' },
    ];
    const currentIdx = steps.findIndex(s => s.key === step || (step === 'generating-content' && s.key === 'input') || (step === 'generating-image' && s.key === 'review-content'));

    return (
      <div className="flex items-center gap-1 mb-4">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-1.5 ${i <= currentIdx ? 'text-amber-600' : 'text-gray-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i < currentIdx ? 'bg-amber-500 text-white' : i === currentIdx ? 'bg-amber-100 text-amber-600 border-2 border-amber-500' : 'bg-gray-100'
              }`}>
                {i < currentIdx ? '✓' : s.icon}
              </span>
              <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < currentIdx ? 'bg-amber-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ====== 左侧控制面板 ====== */}
      <aside className="w-[440px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* 顶部标题 */}
        <div className="px-5 py-3.5 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            AI知识卡片生成器
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">输入主题 → AI生成内容 → 检查编辑 → 生成底图 → 导出</p>
        </div>

        {/* 步骤指示器 */}
        <div className="px-5 pt-4">
          <StepIndicator />
        </div>

        {/* 可滚动内容区 */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* ===== 步骤1: 主题输入 ===== */}
          {(step === 'input' || step === 'generating-content') && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">输入主题</h2>
              <div className="mb-3">
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateContent()}
                  placeholder="输入知识卡片主题，如：立春、人工智能、茶文化..."
                  disabled={step === 'generating-content'}
                />
                <p className="text-xs text-gray-400 mt-1.5">AI会自动搜索相关知识，生成标题、正文和配图提示词</p>
              </div>

              {/* 快捷主题 */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">试试这些主题：</p>
                <div className="flex flex-wrap gap-1.5">
                  {['立春', '雨水', '惊蛰', '茶文化', '书法', '人工智能', '量子计算', '区块链', '深海', '极光', '睡眠', '敦煌', '长城', '丝绸之路', '国画', '京剧', '火山'].map(t => (
                    <button key={t} onClick={() => setTopic(t)}
                      className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-amber-100 hover:text-amber-700 rounded-full transition">
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 模板选择 */}
              <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">选择模板</h2>
              <div className="space-y-1.5 mb-4">
                {templates.map(tpl => (
                  <button key={tpl.id} onClick={() => setSelectedTemplate(tpl)}
                    className={`w-full text-left px-3 py-2 rounded-lg border-2 transition ${
                      selectedTemplate.id === tpl.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-800">{tpl.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        tpl.category === 'guofeng' ? 'bg-yellow-100 text-yellow-700' :
                        tpl.category === 'modern' ? 'bg-blue-100 text-blue-700' :
                        tpl.category === 'minimal' ? 'bg-green-100 text-green-700' :
                        tpl.category === 'scroll' ? 'bg-orange-100 text-orange-700' :
                        tpl.category === 'handcraft' ? 'bg-pink-100 text-pink-700' :
                        tpl.category === 'tech' ? 'bg-purple-100 text-purple-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>{
                        tpl.category === 'guofeng' ? '国风' :
                        tpl.category === 'modern' ? '科技' :
                        tpl.category === 'minimal' ? '简约' :
                        tpl.category === 'scroll' ? '卷轴' :
                        tpl.category === 'handcraft' ? '手账' :
                        tpl.category === 'tech' ? '信息图' : '自然'
                      }</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* AI文本模型配置 */}
              <details className="mb-3">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">AI文本模型配置</summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {([
                      { v: 'mock', l: '本地' },
                      { v: 'qianwen', l: '千问' },
                      { v: 'deepseek', l: 'DeepSeek' },
                      { v: 'zhipu', l: '智谱' },
                    ] as const).map(o => (
                      <button key={o.v} onClick={() => setTextConfig({ ...textConfig, provider: o.v })}
                        className={`px-1 py-1.5 text-xs rounded border ${textConfig.provider === o.v ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200'}`}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                  {textConfig.provider !== 'mock' && (
                    <input type="password" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                      value={textApiKey} onChange={e => setTextApiKey(e.target.value)} placeholder="文本模型API Key" />
                  )}
                </div>
              </details>

              <button onClick={handleGenerateContent} disabled={step === 'generating-content' || !topic.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {step === 'generating-content' ? (
                  <><Spinner /> AI正在生成内容...</>
                ) : (
                  <><span>🔍</span> AI生成知识内容</>
                )}
              </button>
            </section>
          )}

          {/* ===== 步骤2: 检查编辑内容 ===== */}
          {(step === 'review-content' || step === 'generating-image') && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">检查并编辑内容</h2>
                <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">← 重新输入</button>
              </div>

              {aiContent?.summary && (
                <div className="mb-3 p-2.5 bg-blue-50 border-l-3 border-blue-400 rounded-r-lg">
                  <p className="text-xs text-blue-700"><span className="font-medium">AI摘要：</span>{aiContent.summary}</p>
                </div>
              )}

              <Field label="标签（逗号分隔）" value={content.tags.join('，')} onChange={v => setContent({ ...content, tags: v.split('，').map(t => t.trim()).filter(Boolean) })} />
              <Field label="主标题" value={content.title} onChange={v => setContent({ ...content, title: v })} />
              <Field label="副标题" value={content.subtitle} onChange={v => setContent({ ...content, subtitle: v })} />
              <Field label="正文" value={content.body} onChange={v => setContent({ ...content, body: v })} multiline />
              <Field label="底部信息" value={content.footer} onChange={v => setContent({ ...content, footer: v })} />

              {/* 多区块内容编辑（富文本模板） */}
              {content.sections && content.sections.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">内容区块（{content.sections.length}个）</label>
                    <button onClick={() => {
                      const newSection: ContentSection = { id: `sec-${Date.now()}`, title: '新区块', body: '', icon: '📌' };
                      setContent({ ...content, sections: [...(content.sections || []), newSection] });
                    }} className="text-xs text-amber-600 hover:text-amber-700">+ 添加区块</button>
                  </div>
                  {content.sections.map((sec, i) => (
                    <div key={sec.id} className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-1.5">
                        <input type="text" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                          value={sec.title} onChange={e => {
                            const sections = [...(content.sections || [])];
                            sections[i] = { ...sec, title: e.target.value };
                            setContent({ ...content, sections });
                          }} placeholder="区块标题" />
                        <input type="text" className="w-12 px-1 py-1 border border-gray-300 rounded text-xs text-center"
                          value={sec.icon || ''} onChange={e => {
                            const sections = [...(content.sections || [])];
                            sections[i] = { ...sec, icon: e.target.value };
                            setContent({ ...content, sections });
                          }} placeholder="图标" />
                        <button onClick={() => {
                          const sections = (content.sections || []).filter((_, j) => j !== i);
                          setContent({ ...content, sections });
                        }} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
                      </div>
                      <textarea className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs resize-y" rows={2}
                        value={sec.body} onChange={e => {
                          const sections = [...(content.sections || [])];
                          sections[i] = { ...sec, body: e.target.value };
                          setContent({ ...content, sections });
                        }} placeholder="区块内容" />
                    </div>
                  ))}
                </div>
              )}

              {/* 要点列表编辑 */}
              {content.highlights && content.highlights.length > 0 && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">要点列表</label>
                  {content.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-1 mb-1">
                      <input type="text" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                        value={h} onChange={e => {
                          const highlights = [...(content.highlights || [])];
                          highlights[i] = e.target.value;
                          setContent({ ...content, highlights });
                        }} />
                      <button onClick={() => {
                        const highlights = (content.highlights || []).filter((_, j) => j !== i);
                        setContent({ ...content, highlights });
                      }} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* 提示词编辑面板 */}
              <div className="mb-3">
                <button onClick={() => setShowPromptPanel(!showPromptPanel)}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                  <span className={`transition-transform ${showPromptPanel ? 'rotate-90' : ''}`}>▶</span>
                  配图提示词 {currentPromptInfo.source === 'ai' && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 rounded-full">AI生成</span>}
                </button>
                {showPromptPanel && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">正向提示词（可编辑）</label>
                      <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 resize-y" rows={3}
                        value={editedPrompt} onChange={e => setEditedPrompt(e.target.value)} />
                      <p className="text-[10px] text-gray-400 mt-0.5">编辑内容后提示词会自动更新，也可手动修改</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">负面提示词</label>
                      <p className="text-xs text-gray-500 p-2 bg-gray-50 rounded break-all">{selectedTemplate.promptTemplate.negative}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 图片模型配置 */}
              <details className="mb-3">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">AI图片模型配置</summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {([
                      { v: 'mock', l: '本地Mock' },
                      { v: 'tongyi', l: '通义万相' },
                      { v: 'wenxin', l: '文心一格' },
                    ] as const).map(o => (
                      <button key={o.v} onClick={() => setImageConfig({ ...imageConfig, provider: o.v })}
                        className={`px-1 py-1.5 text-xs rounded border ${imageConfig.provider === o.v ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200'}`}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                  {imageConfig.provider !== 'mock' && (
                    <input type="password" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                      value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="图片API Key" />
                  )}
                </div>
              </details>

              <button onClick={handleGenerateImage} disabled={step === 'generating-image'}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {step === 'generating-image' ? (<><Spinner /> 正在生成底图...</>) : (<><span>🎨</span> 生成AI底图</>)}
              </button>
            </section>
          )}

          {/* ===== 步骤3: 完成 ===== */}
          {step === 'done' && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">生成完成</h2>
                <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">← 重新开始</button>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                <p className="text-sm text-green-700 font-medium">✓ 卡片已生成完成</p>
                <p className="text-xs text-green-600 mt-1">可以导出图片，或返回编辑内容后重新生成底图</p>
              </div>

              {/* 快速编辑入口 */}
              <button onClick={() => setStep('review-content')}
                className="w-full py-2 mb-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                ✏️ 编辑内容后重新生成
              </button>

              <div className="mb-3">
                <Field label="主标题" value={content.title} onChange={v => setContent({ ...content, title: v })} />
                <Field label="正文" value={content.body} onChange={v => setContent({ ...content, body: v })} multiline />
              </div>
            </section>
          )}

          {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
        </div>

        {/* 底部导出按钮 */}
        {imageUrl && (
          <div className="px-5 py-3 border-t border-gray-200 bg-white">
            <button onClick={handleExport}
              className="w-full py-2.5 bg-gray-800 text-white rounded-lg font-medium text-sm hover:bg-gray-700 transition flex items-center justify-center gap-2">
              <span>⬇</span> 导出PNG图片
            </button>
          </div>
        )}
      </aside>

      {/* ====== 右侧预览区 ====== */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-200">
        <div className="px-6 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">卡片预览</span>
            <span className="text-xs text-gray-400">{selectedTemplate.canvas.width} × {selectedTemplate.canvas.height}px</span>
          </div>
          <div className="flex items-center gap-3">
            {imageUrl && <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>底图已生成</span>}
            {aiContent && <span className="text-xs text-blue-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>AI内容</span>}
          </div>
        </div>

        <div ref={previewContainerRef} className="flex-1 flex items-center justify-center overflow-auto p-6"
          style={{ background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%) 50% / 20px 20px' }}>
          <div style={{
              width: selectedTemplate.canvas.width * previewScale,
              height: selectedTemplate.canvas.height * previewScale,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              {selectedTemplate.renderer === 'html' ? (
                <RichCardRenderer template={selectedTemplate} content={content} imageUrl={imageUrl} scale={previewScale} innerRef={cardRef} />
              ) : (
                <CardRenderer template={selectedTemplate} content={content} imageUrl={imageUrl} scale={previewScale} innerRef={cardRef} />
              )}
            </div>
        </div>

        <div className="px-6 py-2 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>模板: {selectedTemplate.name} · 缩放: {Math.round(previewScale * 100)}%</span>
          <span>{status || '就绪'}</span>
        </div>
      </main>
    </div>
  );
};

// 旋转加载图标
const Spinner: React.FC = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export default App;
