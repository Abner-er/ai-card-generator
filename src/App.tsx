import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { CardTemplate, CardContent, AIImageConfig, GenerationStatus } from './types';
import { templates } from './templates';
import { ImageGenerationService } from './services/imageService';
import { PromptBuilder } from './services/promptBuilder';
import { ExportService } from './services/exportService';
import { CardRenderer } from './components/CardRenderer';

const DEFAULT_CONTENT: CardContent = {
  title: '二十四节气之立春',
  subtitle: '万物复苏，春意盎然',
  body: '立春，为二十四节气之首。立，是"开始"之意；春，代表着温暖、生长。立春标志着万物闭藏的冬季已过去，开始进入风和日暖、万物生长的春季。',
  footer: '知识卡片 · 2026年7月29日',
  tags: ['传统文化', '节气'],
};

const DEFAULT_AI_CONFIG: AIImageConfig = {
  provider: 'mock',
  size: '1024*1024',
  mode: 'fast',
};

const App: React.FC = () => {
  // 状态管理
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate>(templates[0]);
  const [content, setContent] = useState<CardContent>(DEFAULT_CONTENT);
  const [aiConfig, setAiConfig] = useState<AIImageConfig>(DEFAULT_AI_CONFIG);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewScale, setPreviewScale] = useState(0.4);
  const [apiKey, setApiKey] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  // 卡片渲染ref（用于截图导出）
  const cardRef = useRef<HTMLDivElement>(null);
  // 预览容器ref
  const previewContainerRef = useRef<HTMLDivElement>(null);
  // 图片服务实例
  const imageServiceRef = useRef<ImageGenerationService>(new ImageGenerationService(DEFAULT_AI_CONFIG));

  // 自动计算预览缩放比例
  useEffect(() => {
    const calculateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 48; // 减去padding
        const containerHeight = previewContainerRef.current.clientHeight - 48;
        const scaleX = containerWidth / selectedTemplate.canvas.width;
        const scaleY = containerHeight / selectedTemplate.canvas.height;
        setPreviewScale(Math.min(scaleX, scaleY, 0.5));
      }
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [selectedTemplate]);

  // 生成AI底图
  const handleGenerateImage = useCallback(async () => {
    setStatus('generating-image');
    setErrorMsg('');

    try {
      // 更新服务配置
      imageServiceRef.current.updateConfig({ ...aiConfig, apiKey });

      // 找到模板中的图片图层，获取尺寸
      const imageLayer = selectedTemplate.layers.find(l => l.type === 'image');
      const imgWidth = imageLayer?.width || 1080;
      const imgHeight = imageLayer?.height || 900;

      // 生成图片
      const url = await imageServiceRef.current.generate(
        selectedTemplate.promptTemplate,
        content,
        imgWidth,
        imgHeight
      );

      setImageUrl(url);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '生成失败');
      setStatus('error');
    }
  }, [selectedTemplate, content, aiConfig, apiKey]);

  // 导出PNG
  const handleExportPng = useCallback(async () => {
    if (!cardRef.current) return;
    setStatus('rendering');
    try {
      const dataUrl = await ExportService.exportAsPng(cardRef.current, {
        width: selectedTemplate.canvas.width,
        height: selectedTemplate.canvas.height,
        pixelRatio: 2,
        backgroundColor: selectedTemplate.canvas.backgroundColor,
      });
      ExportService.download(dataUrl, `${content.title || '知识卡片'}-${Date.now()}.png`);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出失败');
      setStatus('error');
    }
  }, [selectedTemplate, content]);

  // 获取当前提示词预览
  const currentPrompt = PromptBuilder.build(selectedTemplate.promptTemplate, content);
  const currentNegativePrompt = PromptBuilder.getNegativePrompt(selectedTemplate.promptTemplate);

  // 文本输入组件
  const TextInput: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    multiline?: boolean;
  }> = ({ label, value, onChange, placeholder, multiline }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition resize-y"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ====== 左侧控制面板 ====== */}
      <aside className="w-[420px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* 顶部标题 */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            AI知识卡片生成器
          </h1>
          <p className="text-xs text-gray-500 mt-1">AI出底图 · HTML精确排版 · 一键导出</p>
        </div>

        {/* 可滚动内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 模板选择 */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 16a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
              模板选择
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`text-left px-3 py-2.5 rounded-lg border-2 transition ${
                    selectedTemplate.id === tpl.id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-800">{tpl.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tpl.category === 'guofeng' ? 'bg-yellow-100 text-yellow-700' :
                      tpl.category === 'modern' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {tpl.category === 'guofeng' ? '国风' : tpl.category === 'modern' ? '科技' : '简约'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{tpl.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* 内容编辑 */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              内容编辑
            </h2>
            <TextInput
              label="标签（用逗号分隔）"
              value={content.tags.join('，')}
              onChange={(v) => setContent({ ...content, tags: v.split('，').map(t => t.trim()).filter(Boolean) })}
              placeholder="如：传统文化，节气"
            />
            <TextInput
              label="主标题"
              value={content.title}
              onChange={(v) => setContent({ ...content, title: v })}
              placeholder="输入卡片主标题"
            />
            <TextInput
              label="副标题"
              value={content.subtitle}
              onChange={(v) => setContent({ ...content, subtitle: v })}
              placeholder="输入副标题"
            />
            <TextInput
              label="正文内容"
              value={content.body}
              onChange={(v) => setContent({ ...content, body: v })}
              placeholder="输入正文内容"
              multiline
            />
            <TextInput
              label="底部信息"
              value={content.footer}
              onChange={(v) => setContent({ ...content, footer: v })}
              placeholder="如：作者 · 日期"
            />
          </section>

          {/* AI配置 */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI图片生成配置
            </h2>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">生成方式</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'mock', label: '本地Mock', desc: '无需API' },
                  { value: 'tongyi', label: '通义万相', desc: '推荐' },
                  { value: 'wenxin', label: '文心一格', desc: '百度' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAiConfig({ ...aiConfig, provider: opt.value })}
                    className={`px-2 py-2 rounded-lg border-2 text-center transition ${
                      aiConfig.provider === opt.value
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xs font-medium text-gray-800">{opt.label}</div>
                    <div className="text-[10px] text-gray-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {aiConfig.provider !== 'mock' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="输入API Key"
                />
                <p className="text-xs text-gray-400 mt-1">提示：实际使用需配置后端代理转发API请求</p>
              </div>
            )}

            {/* 提示词预览 */}
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              <svg className={`w-3 h-3 transition-transform ${showPrompt ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              查看/编辑提示词
            </button>
            {showPrompt && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">正向提示词：</p>
                  <p className="text-xs text-gray-500 leading-relaxed break-all">{currentPrompt}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">负面提示词：</p>
                  <p className="text-xs text-gray-500 leading-relaxed break-all">{currentNegativePrompt}</p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 底部操作按钮 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white space-y-2">
          <button
            onClick={handleGenerateImage}
            disabled={status === 'generating-image'}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === 'generating-image' ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                生成中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                生成AI底图
              </>
            )}
          </button>
          <button
            onClick={handleExportPng}
            disabled={status === 'rendering' || !imageUrl}
            className="w-full py-2.5 bg-gray-800 text-white rounded-lg font-medium text-sm hover:bg-gray-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === 'rendering' ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                导出中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                导出PNG图片
              </>
            )}
          </button>
          {errorMsg && (
            <p className="text-xs text-red-500 text-center">{errorMsg}</p>
          )}
        </div>
      </aside>

      {/* ====== 右侧预览区 ====== */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-200">
        {/* 预览工具栏 */}
        <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">卡片预览</span>
            <span className="text-xs text-gray-400">
              {selectedTemplate.canvas.width} × {selectedTemplate.canvas.height}px
            </span>
          </div>
          <div className="flex items-center gap-2">
            {imageUrl && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                AI底图已生成
              </span>
            )}
          </div>
        </div>

        {/* 预览画布 */}
        <div
          ref={previewContainerRef}
          className="flex-1 flex items-center justify-center overflow-auto p-6"
          style={{
            background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%) 50% / 20px 20px',
          }}
        >
          <div
            style={{
              width: selectedTemplate.canvas.width * previewScale,
              height: selectedTemplate.canvas.height * previewScale,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <CardRenderer
              template={selectedTemplate}
              content={content}
              imageUrl={imageUrl}
              scale={previewScale}
              innerRef={cardRef}
            />
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className="px-6 py-2 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>模板: {selectedTemplate.name}</span>
            <span>缩放: {Math.round(previewScale * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            {status === 'idle' && <span>就绪 - 点击"生成AI底图"开始</span>}
            {status === 'generating-image' && <span className="text-amber-600">正在生成AI底图...</span>}
            {status === 'rendering' && <span className="text-amber-600">正在导出图片...</span>}
            {status === 'done' && imageUrl && <span className="text-green-600">生成完成</span>}
            {status === 'error' && <span className="text-red-500">出错了: {errorMsg}</span>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
