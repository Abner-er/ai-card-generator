import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type {
  CardTemplate, CardContent, AIConfig, WorkflowStage,
  KnowledgeBase, CardData, VisualPrompt, StylePreset,
  KnowledgeModule, ContentSection, StageNumber,
} from './types';
import { templates, stylePresets, getTemplateById } from './templates';
import { KnowledgeService } from './services/knowledgeService';
import { ContentGenerationService } from './services/contentService';
import { ImageGenerationService } from './services/imageService';
import { PromptBuilder } from './services/promptBuilder';
import { CardDesignService } from './services/cardDesignService';
import { ExportService } from './services/exportService';
import type { ExportCardParams } from './services/exportService';
import { ProjectService } from './services/projectService';
import { AdaptiveCardRenderer } from './components/AdaptiveCardRenderer';
import { CardRenderer } from './components/CardRenderer';
import { RichCardRenderer } from './components/RichCardRenderer';
import { KnowledgeCardRenderer } from './components/KnowledgeCardRenderer';
import { TemplatePreview } from './components/TemplatePreview';

// 默认配置 — API Key 由服务端代理持有，不暴露给前端
const DEFAULT_AI_CONFIG: AIConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/ai-api',
  textModel: import.meta.env.VITE_TEXT_MODEL || 'agnes-2.5-flash',
  imageModel: import.meta.env.VITE_IMAGE_MODEL || 'agnes-image-2.1-flash',
  imageSize: import.meta.env.VITE_IMAGE_SIZE || '1024x1536',
  imageRatio: '3:4',
};

const EMPTY_CONTENT: CardContent = {
  title: '', subtitle: '', body: '', footer: '', tags: [],
};

// 六阶段定义（含 Stage 4.5 AI 卡片设计）
  const STAGES: { num: StageNumber; key: string; label: string; icon: string }[] = [
    { num: 1, key: 'knowledge', label: '知识检索', icon: '🔍' },
    { num: 2, key: 'content', label: '内容生成', icon: '✍️' },
    { num: 3, key: 'prompt', label: 'Prompt工程', icon: '🎨' },
    { num: 4, key: 'image', label: 'AI出图', icon: '🖼️' },
    { num: 4.5 as any, key: 'design', label: 'AI卡片设计', icon: '✨' },
    { num: 5, key: 'typeset', label: '排版导出', icon: '📐' },
  ];

const App: React.FC = () => {
  // ===== 工作流状态 =====
  const [stage, setStage] = useState<WorkflowStage>('input');
  const [topic, setTopic] = useState('');

  // 模板与风格
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate>(templates[0]);
  const [selectedStylePreset, setSelectedStylePreset] = useState<StylePreset>(stylePresets[0]);

  // AI配置
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);

  // 项目数据
  const [knowledge, setKnowledge] = useState<KnowledgeBase | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // UI状态
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewScale, setPreviewScale] = useState(0.35);
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0, msg: '' });
  const [designProgress, setDesignProgress] = useState({ current: 0, total: 0, msg: '' });

  // Refs
  const cardRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const knowledgeServiceRef = useRef(new KnowledgeService(DEFAULT_AI_CONFIG));
  const contentServiceRef = useRef(new ContentGenerationService(DEFAULT_AI_CONFIG));
  const imageServiceRef = useRef(new ImageGenerationService(DEFAULT_AI_CONFIG));
  const cardDesignServiceRef = useRef(new CardDesignService(DEFAULT_AI_CONFIG));

  // 自动计算缩放
  useEffect(() => {
    const calc = () => {
      if (previewContainerRef.current) {
        const w = previewContainerRef.current.clientWidth - 48;
        const h = previewContainerRef.current.clientHeight - 48;
        setPreviewScale(Math.min(w / selectedTemplate.canvas.width, h / selectedTemplate.canvas.height, 1));
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [selectedTemplate]);

  // 初始化 PromptBuilder 的 AI 改写器
  useEffect(() => {
    PromptBuilder.configureRewriter({
      baseURL: aiConfig.baseURL,
      textModel: aiConfig.textModel,
    });
    cardDesignServiceRef.current.updateConfig(aiConfig);
  }, [aiConfig.baseURL, aiConfig.textModel]);

  // ===== 当前阶段编号 =====
  const currentStageNum = useCallback((): StageNumber | 0 => {
    const map: Record<string, StageNumber | 0> = {
      'input': 0,
      'generating-knowledge': 1, 'review-knowledge': 1,
      'generating-content': 2, 'review-content': 2,
      'generating-prompt': 3, 'review-prompt': 3,
      'generating-image': 4, 'review-image': 4,
      'designing-card': 4.5, 'review-design': 4.5,
      'typeset': 5, 'done': 5,
    };
    return map[stage] ?? 0;
  }, [stage]);

  // ===== 卡片数量（动态化）=====
  // 对于系列模板（lifecycle/timeline/process），以知识库检索到的实际阶段数量为准
  // 这样用户输入"知了的一生"时，若只有4个阶段，就只生成4张卡片
  const templateDefaultCount = selectedTemplate.cardCount || 1;
  const knowledgeSeriesCount = useMemo(() => {
    if (!knowledge) return templateDefaultCount;
    if (knowledge.lifecycleStages?.length) return knowledge.lifecycleStages.length;
    if (knowledge.timelineEvents?.length) return knowledge.timelineEvents.length;
    if (knowledge.processSteps?.length) return knowledge.processSteps.length;
    return templateDefaultCount;
  }, [knowledge, templateDefaultCount]);
  const cardCount = knowledge ? knowledgeSeriesCount : templateDefaultCount;
  const isSeries = cardCount > 1;

  // ===== 当前活跃卡片 =====
  const activeCard = cards[activeCardIndex];
  const activeContent = activeCard?.content || EMPTY_CONTENT;
  const activeImageUrl = activeCard?.imageUrl || '';

  // ============================================================
  // Stage 1: 知识检索
  // ============================================================
  const handleStart = useCallback(async () => {
    if (!topic.trim()) { setErrorMsg('请输入主题'); return; }
    setStage('generating-knowledge');
    setStatus('AI正在检索知识...');
    setErrorMsg('');

    try {
      knowledgeServiceRef.current.updateConfig(aiConfig);
      const result = await knowledgeServiceRef.current.retrieve(topic, selectedTemplate.id);
      setKnowledge(result);
      setStage('review-knowledge');
      setStatus('知识检索完成，请审校知识数据');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '知识检索失败');
      setStage('input');
      setStatus('');
    }
  }, [topic, selectedTemplate, aiConfig]);

  // ============================================================
  // Stage 2: 内容生成（为所有卡片生成内容）
  // ============================================================
  const handleGenerateContent = useCallback(async () => {
    if (!knowledge) return;
    setStage('generating-content');
    setStatus('正在为每张卡片生成内容...');
    setErrorMsg('');

    try {
      contentServiceRef.current.updateConfig(aiConfig);
      const newCards: CardData[] = [];

      for (let i = 0; i < cardCount; i++) {
        setStatus(`正在生成第${i + 1}/${cardCount}张卡片内容...`);
        const content = await contentServiceRef.current.generate(knowledge, selectedTemplate, i);

        // 生成卡片阶段标题
        let cardStage = '';
        let cardSubtitle = '';
        if (knowledge.lifecycleStages?.[i]) {
          cardStage = `${String(i + 1).padStart(2, '0')} ${knowledge.lifecycleStages[i].name}`;
          cardSubtitle = knowledge.lifecycleStages[i].period;
        } else if (knowledge.timelineEvents?.[i]) {
          cardStage = knowledge.timelineEvents[i].title;
          cardSubtitle = knowledge.timelineEvents[i].year;
        } else if (knowledge.processSteps?.[i]) {
          cardStage = `步骤${knowledge.processSteps[i].order}: ${knowledge.processSteps[i].title}`;
          cardSubtitle = `第${knowledge.processSteps[i].order}步`;
        } else {
          cardStage = content.title;
          cardSubtitle = content.subtitle;
        }

        newCards.push({
          id: i + 1,
          stage: cardStage,
          subtitle: cardSubtitle,
          knowledge,
          content,
        });
      }

      setCards(newCards);
      setActiveCardIndex(0);
      setStage('review-content');
      setStatus('内容生成完成，请逐张审校');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '内容生成失败');
      setStage('review-knowledge');
      setStatus('');
    }
  }, [knowledge, selectedTemplate, cardCount, aiConfig]);

  // ============================================================
  // Stage 3: Prompt工程（为所有卡片生成六段式Prompt）
  // 启用大模型改写：每张卡片都让 AI 根据当前阶段内容改写 prompt，
  // 避免出现与阶段冲突的元素（如成虫里出现蛋）
  // ============================================================
  const handleGeneratePrompts = useCallback(async () => {
    if (!knowledge || cards.length === 0) return;
    setStage('generating-prompt');
    setStatus('AI正在为每张卡片改写生成式提示词...');
    setErrorMsg('');

    try {
      const updatedCards: CardData[] = [];
      const total = cards.length;

      for (let idx = 0; idx < total; idx++) {
        const card = cards[idx];
        setStatus(`正在生成第 ${idx + 1}/${total} 张的AI改写Prompt...`);

        // 优先调用大模型改写 prompt，失败时自动 fallback 到模板版
        const prompt = await PromptBuilder.buildVisualPromptAsync(
          knowledge,
          card.content!,
          selectedTemplate,
          selectedStylePreset,
          idx,
          total,
        );

        updatedCards.push({ ...card, prompt });
      }

      setCards(updatedCards);
      setStage('review-prompt');
      setStatus('Prompt生成完成（已使用AI改写），请查看并可微调');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Prompt生成失败');
      setStage('review-content');
      setStatus('');
    }
  }, [knowledge, cards, selectedTemplate, selectedStylePreset]);

  // ============================================================
  // Stage 4: AI出图（为所有卡片生成图片，含限流）
  // ============================================================
  const handleGenerateImages = useCallback(async () => {
    if (cards.length === 0) return;
    setStage('generating-image');
    setErrorMsg('');
    setImageProgress({ current: 0, total: cards.length, msg: '开始生成图片...' });

    try {
      imageServiceRef.current.updateConfig(aiConfig);
      const updatedCards = [...cards];

      for (let i = 0; i < updatedCards.length; i++) {
        if (!updatedCards[i].prompt) continue;
        setImageProgress({ current: i + 1, total: cards.length, msg: `正在生成第${i + 1}/${cards.length}张图片...` });
        setStatus(`正在生成第${i + 1}/${cards.length}张图片...`);

        const url = await imageServiceRef.current.generateFromVisualPrompt(
          updatedCards[i].prompt!,
          (msg) => setImageProgress({ current: i + 1, total: cards.length, msg }),
        );
        updatedCards[i] = { ...updatedCards[i], imageUrl: url, imageStatus: 'done' };
        setCards([...updatedCards]);
      }

      setStage('review-image');
      setStatus('所有图片生成完成，请审校');
      setImageProgress({ current: 0, total: 0, msg: '' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '图片生成失败');
      setStage('review-prompt');
      setStatus('');
      setImageProgress({ current: 0, total: 0, msg: '' });
    }
  }, [cards, aiConfig]);

  // ===== 单张重新生成图片 =====
  const handleRegenerateImage = useCallback(async (cardIndex: number) => {
    if (!cards[cardIndex]?.prompt) return;
    setStatus(`正在重新生成第${cardIndex + 1}张图片...`);
    setErrorMsg('');
    try {
      imageServiceRef.current.updateConfig(aiConfig);
      const url = await imageServiceRef.current.generateFromVisualPrompt(
        cards[cardIndex].prompt!,
        (msg) => setStatus(msg),
      );
      const updatedCards = [...cards];
      updatedCards[cardIndex] = { ...updatedCards[cardIndex], imageUrl: url, imageStatus: 'done' };
      setCards(updatedCards);
      setStatus('图片重新生成完成');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '图片重新生成失败');
      setStatus('');
    }
  }, [cards, aiConfig]);

  // ============================================================
  // Stage 5: AI 卡片设计（Stage 4.5 — Vision API 分析图片后设计）
  // 核心：每张卡片基于图片构图自动生成唯一布局、配色、层次
  // ============================================================
  const handleDesignCards = useCallback(async () => {
    if (cards.length === 0) return;
    setStage('designing-card');
    setStatus('AI 正在分析每张图片构图并设计卡片布局...');
    setErrorMsg('');
    setDesignProgress({ current: 0, total: cards.length, msg: '开始设计...' });

    try {
      cardDesignServiceRef.current.updateConfig(aiConfig);
      const updatedCards = [...cards];
      const total = cards.length;

      for (let i = 0; i < total; i++) {
        const card = updatedCards[i];
        if (!card.imageUrl || card.imageStatus !== 'done') {
          updatedCards[i] = { ...card, designStatus: 'error', designError: '图片未就绪' };
          setCards([...updatedCards]);
          continue;
        }

        setDesignProgress({ current: i + 1, total, msg: `正在设计第${i + 1}/${total}张卡片...` });
        setStatus(`正在设计第${i + 1}/${total}张卡片...`);

        try {
          const design = await cardDesignServiceRef.current.designCard(
            card.imageUrl,
            card.knowledge!,
            card.content!,
            selectedStylePreset,
            i,
            total,
            (s, sn) => { /* 进度由 designProgress 管理 */ },
          );
          updatedCards[i] = { ...card, design, designStatus: 'done', designError: undefined };
        } catch (err) {
          console.warn(`[App] Card ${i + 1} design failed:`, err);
          updatedCards[i] = { ...card, designStatus: 'error', designError: err instanceof Error ? err.message : '设计失败' };
        }
        setCards([...updatedCards]);
      }

      setStage('review-design');
      setStatus(`卡片设计完成（${total}张），请审校每张卡片的 AI 设计`);
      setDesignProgress({ current: 0, total: 0, msg: '' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '卡片设计失败');
      setStage('review-image');
      setStatus('');
      setDesignProgress({ current: 0, total: 0, msg: '' });
    }
  }, [cards, aiConfig, selectedStylePreset]);

  // ===== 单张重新设计 =====
  const handleRegenerateDesign = useCallback(async (cardIndex: number) => {
    const card = cards[cardIndex];
    if (!card?.imageUrl) return;
    setStatus(`正在重新设计第${cardIndex + 1}张卡片...`);
    setErrorMsg('');
    try {
      cardDesignServiceRef.current.updateConfig(aiConfig);
      const design = await cardDesignServiceRef.current.designCard(
        card.imageUrl,
        card.knowledge!,
        card.content!,
        selectedStylePreset,
        cardIndex,
        cards.length,
        () => {},
      );
      const updatedCards = [...cards];
      updatedCards[cardIndex] = { ...card, design, designStatus: 'done', designError: undefined };
      setCards(updatedCards);
      setStatus('卡片设计重新完成');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '卡片设计失败');
      setStatus('');
    }
  }, [cards, aiConfig, selectedStylePreset]);

  // ============================================================
  // Stage 5: 导出PNG
  // ============================================================
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
      ExportService.download(dataUrl, `${activeContent.title || '信息图'}-${activeCardIndex + 1}-${Date.now()}.png`);
      setStatus('导出完成');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出失败');
    }
  }, [selectedTemplate, activeContent, activeCardIndex]);

  // ===== 批量导出进度状态 =====
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, msg: '', active: false });

  /**
   * 批量导出所有卡片为PNG并逐个下载
   * 原理：依次切换 activeCardIndex → 等待渲染 → 截图 → 下载
   */
  const handleExportBatch = useCallback(async () => {
    if (cards.length === 0) return;
    setExportProgress({ current: 0, total: cards.length, msg: '准备批量导出...', active: true });
    setErrorMsg('');
    const originalIndex = activeCardIndex;

    try {
      for (let i = 0; i < cards.length; i++) {
        setExportProgress({ current: i, total: cards.length, msg: `正在导出第 ${i + 1}/${cards.length} 张...`, active: true });
        // 切换到目标卡片
        setActiveCardIndex(i);
        // 等待 React 重新渲染 + 图片加载
        await new Promise(r => setTimeout(r, 400));

        if (!cardRef.current) continue;
        const content = cards[i]?.content || EMPTY_CONTENT;
        const dataUrl = await ExportService.exportAsPng(cardRef.current, {
          width: selectedTemplate.canvas.width,
          height: selectedTemplate.canvas.height,
          pixelRatio: 2,
          backgroundColor: selectedTemplate.canvas.backgroundColor,
        });
        const filename = `${content.title || '信息图'}-${i + 1}-${Date.now()}.png`;
        ExportService.download(dataUrl, filename);
        // 间隔避免浏览器拦截
        await new Promise(r => setTimeout(r, 250));
      }
      setExportProgress({ current: cards.length, total: cards.length, msg: `全部 ${cards.length} 张已导出`, active: false });
      setStatus(`批量导出完成，共 ${cards.length} 张`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '批量导出失败');
      setExportProgress({ current: 0, total: 0, msg: '', active: false });
    } finally {
      // 恢复原选中卡片
      setActiveCardIndex(originalIndex);
    }
  }, [cards, selectedTemplate, activeCardIndex]);

  /**
   * 批量导出所有卡片并打包为ZIP下载
   */
  const handleExportZip = useCallback(async () => {
    if (cards.length === 0) return;
    setExportProgress({ current: 0, total: cards.length, msg: '准备打包导出...', active: true });
    setErrorMsg('');
    const originalIndex = activeCardIndex;

    try {
      const exportCards: ExportCardParams[] = [];

      // 第一阶段：依次渲染并截图，收集所有 dataUrl
      for (let i = 0; i < cards.length; i++) {
        setExportProgress({ current: i, total: cards.length, msg: `正在生成第 ${i + 1}/${cards.length} 张...`, active: true });
        setActiveCardIndex(i);
        await new Promise(r => setTimeout(r, 400));

        if (!cardRef.current) continue;
        const content = cards[i]?.content || EMPTY_CONTENT;
        const dataUrl = await ExportService.exportAsPng(cardRef.current, {
          width: selectedTemplate.canvas.width,
          height: selectedTemplate.canvas.height,
          pixelRatio: 2,
          backgroundColor: selectedTemplate.canvas.backgroundColor,
        });
        exportCards.push({
          element: cardRef.current,
          filename: `${content.title || '信息图'}-${String(i + 1).padStart(2, '0')}.png`,
          width: selectedTemplate.canvas.width,
          height: selectedTemplate.canvas.height,
          pixelRatio: 2,
          backgroundColor: selectedTemplate.canvas.backgroundColor,
        });
        // 把 dataUrl 临时存储（因为 element 会随切换变化，需在切换前提取）
        // 直接用闭包存储 dataUrl
        (exportCards[exportCards.length - 1] as any)._dataUrl = dataUrl;
      }

      // 第二阶段：打包为 ZIP
      setExportProgress({ current: cards.length, total: cards.length, msg: '正在打包ZIP...', active: true });
      const zipName = `${topic || '知识卡片'}-${new Date().toISOString().slice(0, 10)}`;
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const folder = zip.folder(zipName) || zip;

      for (const card of exportCards) {
        const dataUrl = (card as any)._dataUrl as string;
        const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
        folder.file(card.filename, base64, { base64: true });
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.download = `${zipName}.zip`;
      link.href = zipUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);

      setExportProgress({ current: cards.length, total: cards.length, msg: `ZIP打包完成，共 ${cards.length} 张`, active: false });
      setStatus(`ZIP打包完成，共 ${cards.length} 张`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ZIP打包失败');
      setExportProgress({ current: 0, total: 0, msg: '', active: false });
    } finally {
      setActiveCardIndex(originalIndex);
    }
  }, [cards, selectedTemplate, activeCardIndex, topic]);

  // ============================================================
  // 项目保存/加载
  // ============================================================
  const handleSaveProject = useCallback(() => {
    if (!knowledge || cards.length === 0) return;
    const project = ProjectService.createProject(topic, selectedTemplate.id, selectedStylePreset.id, cards);
    ProjectService.save(project);
    setStatus('项目已保存');
  }, [topic, selectedTemplate, selectedStylePreset, knowledge, cards]);

  const handleLoadProject = useCallback(() => {
    const project = ProjectService.load();
    if (!project) { setErrorMsg('未找到已保存的项目'); return; }
    const tpl = getTemplateById(project.templateId);
    if (tpl) setSelectedTemplate(tpl);
    const sp = stylePresets.find(s => s.id === project.stylePresetId);
    if (sp) setSelectedStylePreset(sp);
    setTopic(project.topic);
    setCards(project.cards);
    if (project.cards[0]?.knowledge) setKnowledge(project.cards[0].knowledge);
    setActiveCardIndex(0);
    // 根据已有数据跳到合适阶段
    if (project.cards.every(c => c.imageUrl)) setStage('review-image');
    else if (project.cards.every(c => c.prompt)) setStage('review-prompt');
    else if (project.cards.every(c => c.content)) setStage('review-content');
    else if (project.cards[0]?.knowledge) setStage('review-knowledge');
    setStatus('项目已加载');
  }, []);

  const handleExportProject = useCallback(() => {
    if (cards.length === 0) return;
    const project = ProjectService.createProject(topic, selectedTemplate.id, selectedStylePreset.id, cards);
    ProjectService.downloadJSON(project);
    setStatus('项目JSON已下载');
  }, [topic, selectedTemplate, selectedStylePreset, cards]);

  // ===== 返回输入页（保留已生成数据） =====
  const handleBackToInput = useCallback(() => {
    setStage('input');
    setStatus('');
    setErrorMsg('');
    // 不清除 knowledge、cards 等数据，用户可修改模板/风格后继续
  }, []);

  // ===== 完全重新开始（清除所有数据） =====
  const handleClearAll = useCallback(() => {
    setStage('input');
    setTopic('');
    setKnowledge(null);
    setCards([]);
    setActiveCardIndex(0);
    setStatus('');
    setErrorMsg('');
  }, []);

  // ===== 更新当前卡片内容 =====
  const updateActiveCardContent = useCallback((content: CardContent) => {
    setCards(prev => prev.map((c, i) => i === activeCardIndex ? { ...c, content } : c));
  }, [activeCardIndex]);

  // ===== 更新当前卡片Prompt =====
  const updateActiveCardPrompt = useCallback((prompt: VisualPrompt) => {
    setCards(prev => prev.map((c, i) => i === activeCardIndex ? { ...c, prompt } : c));
  }, [activeCardIndex]);

  // ===== 渲染卡片 =====
  const renderCard = () => {
    if (activeCard && activeCard.design && activeCard.designStatus === 'done') {
      // AI 设计已就绪：使用自适应渲染器（传入 scale 和 innerRef 用于导出）
      return <AdaptiveCardRenderer card={activeCard} stylePreset={selectedStylePreset} cardIndex={activeCardIndex} cardTotal={cards.length} scale={previewScale} innerRef={cardRef} />;
    }
    // Fallback: 旧版渲染器（图片未设计时）
    const content = activeContent;
    const imageUrl = activeImageUrl;
    const tpl = selectedTemplate;
    if (tpl.renderer === 'knowledge' || tpl.renderer === 'lifecycle' || tpl.renderer === 'timeline' || tpl.renderer === 'process') {
      return <KnowledgeCardRenderer template={tpl} content={content} imageUrl={imageUrl} scale={previewScale} innerRef={cardRef} stylePreset={selectedStylePreset} cardIndex={activeCardIndex} />;
    }
    if (tpl.renderer === 'html') {
      return <RichCardRenderer template={tpl} content={content} imageUrl={imageUrl} scale={previewScale} innerRef={cardRef} />;
    }
    return <CardRenderer template={tpl} content={content} imageUrl={imageUrl} scale={previewScale} innerRef={cardRef} />;
  };

  // ===== 输入框组件 =====
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

  // ===== 步骤指示器 =====
  const StepIndicator: React.FC = () => {
    const num = currentStageNum();
    return (
      <div className="flex items-center gap-1 mb-4">
        {STAGES.map((s, i) => (
          <React.Fragment key={s.num}>
            <div className={`flex items-center gap-1.5 ${s.num <= num ? 'text-amber-600' : 'text-gray-400'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                s.num < num ? 'bg-amber-500 text-white' : s.num === num ? 'bg-amber-100 text-amber-600 border-2 border-amber-500' : 'bg-gray-100'
              }`}>
                {s.num < num ? '✓' : s.num}
              </span>
              <span className="text-xs font-medium hidden md:inline">{s.label}</span>
            </div>
            {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${s.num < num ? 'bg-amber-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ===== 卡片选择器（系列模板） =====
  const CardSelector: React.FC = () => {
    if (!isSeries || cards.length === 0) return null;
    return (
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {cards.map((c, i) => (
          <button key={c.id} onClick={() => setActiveCardIndex(i)}
            className={`px-2.5 py-1 text-xs rounded-full transition ${
              i === activeCardIndex ? 'bg-amber-500 text-white' : 'bg-gray-100 hover:bg-amber-100 text-gray-600'
            }`}>
            {String(i + 1).padStart(2, '0')} {c.stage?.slice(0, 6)}
          </button>
        ))}
      </div>
    );
  };

  // ===== 生成中遮罩 =====
  const isGenerating = stage.startsWith('generating-');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ====== 左侧控制面板 ====== */}
      <aside className="w-[540px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* 顶部标题 */}
        <div className="px-5 py-3.5 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              AI信息图工作室
            </h1>
            <div className="flex items-center gap-1.5">
              <button onClick={handleSaveProject} disabled={cards.length === 0}
                className="text-xs px-2 py-1 text-gray-500 hover:text-amber-600 disabled:opacity-30" title="保存项目">💾</button>
              <button onClick={handleLoadProject}
                className="text-xs px-2 py-1 text-gray-500 hover:text-amber-600" title="加载项目">📂</button>
              <button onClick={handleExportProject} disabled={cards.length === 0}
                className="text-xs px-2 py-1 text-gray-500 hover:text-amber-600 disabled:opacity-30" title="导出JSON">📤</button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">五阶段全链路：知识检索 → 内容生成 → Prompt → 出图 → 排版</p>
        </div>

        {/* 步骤指示器 */}
        {stage !== 'input' && (
          <div className="px-5 pt-4">
            <StepIndicator />
          </div>
        )}

        {/* 可滚动内容区 */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* ===== 输入阶段 ===== */}
          {stage === 'input' && (
            <section>
              {/* 已有数据提示栏 */}
              {knowledge && cards.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">📋</span>
                    <span className="text-xs font-medium text-green-700">已有项目数据：{topic}（{cards.length}张卡片）</span>
                  </div>
                  <p className="text-[11px] text-green-600 mb-2">
                    已生成：{knowledge.facts.length > 0 ? '知识库' : ''} {cards[0]?.content ? '· 内容' : ''} {cards[0]?.prompt ? '· Prompt' : ''} {cards[0]?.imageUrl ? '· 图片' : ''}
                  </p>
                  <div className="flex gap-2">
                    {cards[0]?.imageUrl ? (
                      <button onClick={() => setStage('review-image')}
                        className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition">继续排版导出 →</button>
                    ) : cards[0]?.prompt ? (
                      <button onClick={() => setStage('review-prompt')}
                        className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition">继续生成图片 →</button>
                    ) : cards[0]?.content ? (
                      <button onClick={() => setStage('review-content')}
                        className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition">继续生成Prompt →</button>
                    ) : (
                      <button onClick={() => setStage('review-knowledge')}
                        className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition">继续生成内容 →</button>
                    )}
                    <button onClick={handleClearAll}
                      className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">清空重来</button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">可修改模板/风格后点击下方"开始知识检索"重新生成</p>
                </div>
              )}

              <h2 className="text-sm font-semibold text-gray-700 mb-3">{knowledge && cards.length > 0 ? '修改设置' : '输入主题'}</h2>
              <div className="mb-3">
                <input type="text" className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  value={topic} onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  placeholder="输入主题，如：夜鹭、王安石变法、造纸术..." />
                <p className="text-xs text-gray-400 mt-1.5">AI将自动检索知识、生成内容、构建Prompt、生成图片</p>
              </div>

              {/* 快捷主题 */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">试试这些主题：</p>
                <div className="flex flex-wrap gap-1.5">
                  {['夜鹭', '向日葵', '大熊猫', '王安石变法', '丝绸之路', '造纸术', '立春', '敦煌', '人工智能', '量子计算'].map(t => (
                    <button key={t} onClick={() => setTopic(t)}
                      className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-amber-100 hover:text-amber-700 rounded-full transition">{t}</button>
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
                      <div className="flex items-center gap-1">
                        {tpl.cardCount && tpl.cardCount > 1 && <span className="text-[10px] text-blue-500">{tpl.cardCount}张</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          ['lifecycle','timeline','process'].includes(tpl.category) ? 'bg-purple-100 text-purple-700' :
                          ['quick','encyclopedia','compare'].includes(tpl.category) ? 'bg-teal-100 text-teal-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{tpl.category}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* 风格预设 */}
              <h2 className="text-sm font-semibold text-gray-700 mb-2 mt-4">选择风格</h2>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {stylePresets.map(sp => (
                  <button key={sp.id} onClick={() => setSelectedStylePreset(sp)}
                    className={`px-3 py-2 rounded-lg border-2 text-left transition ${
                      selectedStylePreset.id === sp.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ background: sp.palette[0] }} />
                      <span className="text-xs font-medium text-gray-700">{sp.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-400">{sp.nameEn}</p>
                  </button>
                ))}
              </div>

              {/* AI配置 — 仅展示模型信息，API Key 由服务端持有 */}
              <details className="mb-3">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">⚙️ AI模型配置</summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">文本模型</label>
                      <input type="text" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                        value={aiConfig.textModel} onChange={e => setAiConfig({ ...aiConfig, textModel: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">图片模型</label>
                      <input type="text" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                        value={aiConfig.imageModel} onChange={e => setAiConfig({ ...aiConfig, imageModel: e.target.value })} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    API Key 由服务端代理配置，前端不暴露密钥
                  </p>
                </div>
              </details>

              <button onClick={handleStart} disabled={!topic.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                <span>🔍</span> 开始知识检索
              </button>
            </section>
          )}

          {/* ===== Stage 1: 知识检索审校 ===== */}
          {(stage === 'review-knowledge' || stage === 'generating-content') && knowledge && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">阶段1：知识检索结果</h2>
                <button onClick={handleBackToInput} className="text-xs text-gray-400 hover:text-gray-600">← 重新输入</button>
              </div>

              <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">{knowledge.topic}</p>
                <p className="text-xs text-gray-500 mt-1">{knowledge.summary}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {knowledge.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">{t}</span>)}
                </div>
              </div>

              {knowledge.facts.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">关键事实</label>
                  <div className="space-y-1">
                    {knowledge.facts.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">{f.label}</span>
                        <input type="text" className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs"
                          value={f.value} onChange={e => {
                            const facts = [...knowledge.facts];
                            facts[i] = { ...f, value: e.target.value };
                            setKnowledge({ ...knowledge, facts });
                          }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {knowledge.keyPoints.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">核心要点</label>
                  {knowledge.keyPoints.map((p, i) => (
                    <input key={i} type="text" className="w-full px-2 py-1.5 mb-1 border border-gray-200 rounded text-xs"
                      value={p} onChange={e => {
                        const keyPoints = [...knowledge.keyPoints];
                        keyPoints[i] = e.target.value;
                        setKnowledge({ ...knowledge, keyPoints });
                      }} />
                  ))}
                </div>
              )}

              {knowledge.lifecycleStages && knowledge.lifecycleStages.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">生命周期阶段（{knowledge.lifecycleStages.length}个）</label>
                  <div className="space-y-1.5">
                    {knowledge.lifecycleStages.map((s, i) => (
                      <div key={s.id} className="p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-amber-600">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-xs text-gray-700">{s.name} · {s.period}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">{s.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {knowledge.timelineEvents && knowledge.timelineEvents.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">时间线事件（{knowledge.timelineEvents.length}个）</label>
                  <div className="space-y-1.5">
                    {knowledge.timelineEvents.map((e, i) => (
                      <div key={e.id} className="p-2 bg-gray-50 rounded">
                        <span className="text-xs font-medium text-amber-600">{e.year}</span>
                        <span className="text-xs text-gray-700 ml-2">{e.title}</span>
                        <p className="text-[11px] text-gray-500 mt-0.5">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleGenerateContent} disabled={stage === 'generating-content'}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {stage === 'generating-content' ? <><Spinner /> 生成中...</> : <><span>✍️</span> 生成卡片内容</>}
              </button>
            </section>
          )}

          {/* ===== Stage 2: 内容审校 ===== */}
          {(stage === 'review-content' || stage === 'generating-prompt') && activeCard && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">阶段2：内容审校</h2>
                <button onClick={() => setStage('review-knowledge')} className="text-xs text-gray-400 hover:text-gray-600">← 知识</button>
              </div>

              <CardSelector />

              <Field label="主标题" value={activeContent.title} onChange={v => updateActiveCardContent({ ...activeContent, title: v })} />
              <Field label="副标题" value={activeContent.subtitle} onChange={v => updateActiveCardContent({ ...activeContent, subtitle: v })} />
              <Field label="正文" value={activeContent.body} onChange={v => updateActiveCardContent({ ...activeContent, body: v })} multiline />
              <Field label="底部信息" value={activeContent.footer} onChange={v => updateActiveCardContent({ ...activeContent, footer: v })} />

              {/* 知识模块编辑 */}
              {activeContent.modules && activeContent.modules.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">知识模块（{activeContent.modules.length}个）</label>
                  {activeContent.modules.map((mod, i) => (
                    <div key={mod.id} className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-1.5">
                        <input type="text" className="w-10 px-1 py-1 border border-gray-300 rounded text-xs text-center"
                          value={mod.icon || ''} onChange={e => {
                            const modules = [...(activeContent.modules || [])];
                            modules[i] = { ...mod, icon: e.target.value };
                            updateActiveCardContent({ ...activeContent, modules });
                          }} />
                        <input type="text" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                          value={mod.title} onChange={e => {
                            const modules = [...(activeContent.modules || [])];
                            modules[i] = { ...mod, title: e.target.value };
                            updateActiveCardContent({ ...activeContent, modules });
                          }} />
                      </div>
                      {mod.bullets && mod.bullets.length > 0 ? (
                        <div className="space-y-1">
                          {mod.bullets.map((b, j) => (
                            <div key={j} className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">•</span>
                              <input type="text" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                                value={b} onChange={e => {
                                  const modules = [...(activeContent.modules || [])];
                                  const bullets = [...(mod.bullets || [])];
                                  bullets[j] = e.target.value;
                                  modules[i] = { ...mod, bullets };
                                  updateActiveCardContent({ ...activeContent, modules });
                                }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <textarea className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs resize-y" rows={2}
                          value={mod.content} onChange={e => {
                            const modules = [...(activeContent.modules || [])];
                            modules[i] = { ...mod, content: e.target.value };
                            updateActiveCardContent({ ...activeContent, modules });
                          }} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeContent.quote && (
                <Field label="金句" value={activeContent.quote} onChange={v => updateActiveCardContent({ ...activeContent, quote: v })} multiline />
              )}

              <button onClick={handleGeneratePrompts} disabled={stage === 'generating-prompt'}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {stage === 'generating-prompt' ? <><Spinner /> 生成中...</> : <><span>🎨</span> 生成Prompt</>}
              </button>
            </section>
          )}

          {/* ===== Stage 3: Prompt审校 ===== */}
          {(stage === 'review-prompt' || stage === 'generating-image') && activeCard?.prompt && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">阶段3：Prompt审校</h2>
                <button onClick={() => setStage('review-content')} className="text-xs text-gray-400 hover:text-gray-600">← 内容</button>
              </div>

              <CardSelector />

              {/* AI 改写说明横幅 */}
              <div className="mb-2 p-2 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-lg">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs">✨</span>
                  <span className="text-[11px] font-semibold text-violet-700">AI 已根据当前阶段内容改写 Prompt</span>
                </div>
                <p className="text-[10px] text-violet-600 leading-relaxed">
                  辅助元素已按阶段智能调整（成虫里不会再出现蛋），主视觉描述贴合当前阶段特征。如不满意可手动调整下方字段。
                </p>
              </div>

              {/* 当前阶段信息卡 */}
              <div className="mb-2 p-2 bg-amber-50 border-l-3 border-amber-400 rounded-r-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs">🎯</span>
                  <span className="text-[11px] font-semibold text-amber-700">当前阶段</span>
                </div>
                <p className="text-xs text-amber-900 font-medium">{activeCard.stage}</p>
                {activeCard.subtitle && (
                  <p className="text-[10px] text-amber-700 mt-0.5">{activeCard.subtitle}</p>
                )}
              </div>

              {/* 六段式Prompt编辑 —— 主视觉与辅助元素高亮 */}
              {([
                ['style', '1. 画面基调', false],
                ['layout', '2. 布局骨架', false],
                ['mainVisual', '3. 主视觉插画 ✨AI改写', true],
                ['auxiliary', '4. 辅助插画 ✨AI改写', true],
                ['whitespace', '5. 留白区定义', false],
                ['decoration', '6. 装饰收尾', false],
              ] as const).map(([key, label, isAI]) => (
                <div key={key} className={isAI ? 'mb-2 p-2 bg-violet-50/50 border border-violet-200 rounded-lg' : 'mb-2'}>
                  <Field
                    label={label}
                    value={activeCard.prompt![key]}
                    multiline
                    onChange={v => updateActiveCardPrompt({ ...activeCard.prompt!, [key]: v })}
                  />
                </div>
              ))}

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">负面提示词</label>
                <p className="text-xs text-gray-500 p-2 bg-gray-50 rounded break-all">{activeCard.prompt.negative}</p>
              </div>

              {/* 完整Prompt预览 */}
              <details className="mb-3">
                <summary className="text-xs text-gray-500 cursor-pointer">查看完整Prompt</summary>
                <pre className="mt-1 p-2 bg-gray-900 text-green-400 text-[10px] rounded overflow-x-auto whitespace-pre-wrap">
                  {PromptBuilder.toPromptString(activeCard.prompt)}
                </pre>
              </details>

              <button onClick={handleGenerateImages} disabled={stage === 'generating-image'}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {stage === 'generating-image' ? <><Spinner /> {imageProgress.msg || '生成中...'}</> : <><span>🖼️</span> 生成AI图片 ({cards.length}张)</>}
              </button>

              {imageProgress.total > 0 && stage === 'generating-image' && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(imageProgress.current / imageProgress.total) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 text-center">{imageProgress.current}/{imageProgress.total}</p>
                </div>
              )}
            </section>
          )}

          {/* ===== Stage 4: 图片审校 ===== */}
          {(stage === 'review-image' || stage === 'designing-card' || stage === 'review-design') && activeCard && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  {stage === 'review-image' ? '阶段4：图片审校' : stage === 'designing-card' ? '阶段4.5：AI卡片设计' : '阶段4.5：审校设计'}
                </h2>
                <button onClick={() => setStage('review-prompt')} className="text-xs text-gray-400 hover:text-gray-600">← Prompt</button>
              </div>

              <CardSelector />

              {/* 图片生成状态 */}
              {stage === 'review-image' && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">✓ 图片已生成</p>
                  {isSeries && <p className="text-xs text-green-600 mt-1">共{cards.length}张，当前第{activeCardIndex + 1}张</p>}
                </div>
              )}

              {/* 设计进度 */}
              {(stage === 'designing-card' || stage === 'review-design') && (
                <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-700 font-medium">
                    {designProgress.total > 0
                      ? `✨ 正在设计 (${designProgress.current}/${designProgress.total})`
                      : '✨ AI 卡片设计完成'}
                  </p>
                  {designProgress.msg && <p className="text-xs text-purple-500 mt-1">{designProgress.msg}</p>}
                  {designProgress.total > 0 && stage === 'designing-card' && (
                    <div className="mt-2">
                      <div className="w-full bg-purple-200 rounded-full h-1.5">
                        <div className="bg-purple-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${(designProgress.current / designProgress.total) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <button onClick={() => handleRegenerateImage(activeCardIndex)}
                className="w-full py-2 mb-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                🔄 重新生成此张图片
              </button>

              {stage === 'review-image' && (
                <button onClick={handleDesignCards} disabled={cards.some(c => c.imageStatus !== 'done')}
                  className="w-full py-2.5 mb-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  <span>✨</span> AI卡片设计（每张卡独一无二）
                </button>
              )}

              {stage === 'review-design' && (
                <>
                  <button onClick={() => handleRegenerateDesign(activeCardIndex)}
                    className="w-full py-2 mb-2 border border-purple-300 rounded-lg text-sm text-purple-700 hover:bg-purple-50 transition">
                    🔄 重新设计此张卡片
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setStage('review-image')}
                      className="py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                      ← 返回图片
                    </button>
                    <button onClick={() => setStage('typeset')}
                      className="py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition flex items-center justify-center gap-2">
                      <span>📐</span> 进入排版导出
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ===== Stage 5: 排版导出 ===== */}
          {stage === 'typeset' && activeCard && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">阶段5：排版导出</h2>
                <button onClick={() => setStage('review-image')} className="text-xs text-gray-400 hover:text-gray-600">← 图片</button>
              </div>

              <CardSelector />

              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700 font-medium">📐 排版预览</p>
                <p className="text-xs text-amber-600 mt-1">AI图做背景层，文字用HTML叠加，右侧实时预览</p>
              </div>

              {/* 快速编辑 */}
              <Field label="主标题" value={activeContent.title} onChange={v => updateActiveCardContent({ ...activeContent, title: v })} />
              <Field label="正文" value={activeContent.body} onChange={v => updateActiveCardContent({ ...activeContent, body: v })} multiline />

              {/* 单张导出 */}
              <button onClick={handleExport} disabled={exportProgress.active}
                className="w-full py-2.5 bg-gray-800 text-white rounded-lg font-medium text-sm hover:bg-gray-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>⬇</span> 导出当前PNG
              </button>

              {isSeries && (
                <p className="text-xs text-gray-400 mt-1.5 text-center">当前导出第{activeCardIndex + 1}张</p>
              )}

              {/* 批量导出 */}
              {isSeries && cards.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">批量导出（共{cards.length}张）</p>
                  <div className="flex gap-2">
                    <button onClick={handleExportBatch} disabled={exportProgress.active}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-xs hover:bg-blue-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <span>📥</span> 批量下载
                    </button>
                    <button onClick={handleExportZip} disabled={exportProgress.active}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium text-xs hover:bg-green-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <span>📦</span> ZIP打包
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 text-center">批量下载逐张保存，ZIP打包合为一个文件</p>
                </div>
              )}

              {/* 导出进度 */}
              {exportProgress.active && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-700">{exportProgress.msg}</span>
                    {exportProgress.total > 0 && (
                      <span className="text-xs text-blue-600">{exportProgress.current}/{exportProgress.total}</span>
                    )}
                  </div>
                  {exportProgress.total > 0 && (
                    <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                        style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
        </div>

        {/* 生成中状态条 */}
        {isGenerating && (
          <div className="px-5 py-2 border-t border-gray-200 bg-amber-50">
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <Spinner /> {status || '处理中...'}
            </p>
          </div>
        )}
      </aside>

      {/* ====== 右侧预览区 ====== */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-200">
        {stage === 'input' ? (
          /* 输入阶段：展示模板预览，点击模板即时切换 */
          <TemplatePreview template={selectedTemplate} stylePreset={selectedStylePreset} />
        ) : (
          <>
            <div className="px-6 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">预览</span>
                <span className="text-xs text-gray-400">{selectedTemplate.canvas.width}×{selectedTemplate.canvas.height}</span>
                {isSeries && activeCard && <span className="text-xs text-blue-500">第{activeCardIndex + 1}/{cards.length}张</span>}
              </div>
              <div className="flex items-center gap-3">
                {activeImageUrl && <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>底图已生成</span>}
                {knowledge && <span className="text-xs text-blue-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>知识库</span>}
                <span className="text-xs text-gray-400">{selectedStylePreset.name}</span>
              </div>
            </div>

            <div ref={previewContainerRef} className="flex-1 flex items-center justify-center overflow-auto p-6"
              style={{ background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%) 50% / 20px 20px' }}>
              {activeCard ? (
                <div style={{
                  width: selectedTemplate.canvas.width * previewScale,
                  height: selectedTemplate.canvas.height * previewScale,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  borderRadius: 8, overflow: 'hidden',
                }}>
                  {renderCard()}
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p className="text-4xl mb-3">🎨</p>
                  <p className="text-sm">输入主题后开始生成信息图</p>
                  <p className="text-xs mt-1">五阶段全链路自动化生产</p>
                </div>
              )}
            </div>

            <div className="px-6 py-2 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>模板: {selectedTemplate.name} · 缩放: {Math.round(previewScale * 100)}%</span>
              <span>{status || '就绪'}</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const Spinner: React.FC = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export default App;
