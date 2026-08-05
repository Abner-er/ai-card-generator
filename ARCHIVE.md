# AI Knowledge Card Generator — 项目归档文档

## 一、项目概述

**AI知识卡片生成器**是一个基于 React + TypeScript + Vite 的 Web 应用，实现了五阶段全链路自动化生产：知识检索 → 内容生成 → Prompt工程 → AI出图 → HTML排版导出。

核心创新：六段式纯画面 Prompt 构建引擎，配合内容关系判定（P0）和可解释性改写（P3）。

**技术栈：**
- 前端：React 19 + TypeScript 6 + Vite 8
- 样式：Tailwind CSS 3（CDN 引入，无构建时依赖）
- 工具库：html-to-image（截图）、jszip（打包）
- AI 服务：通过 `/ai-api` 服务端代理访问

**仓库位置：** `d:\Documents\Trae Work\Tools\ai-card-generator`
**启动方式：** `npm run dev` → http://localhost:5173/

---

## 二、五阶段工作流

```
输入主题 → 知识检索(STG1) → 内容生成(STG2) → Prompt工程(STG3) → AI出图(STG4) → AI卡片设计(STG4.5) → 排版导出(STG5)
```

### Stage 1 — 知识检索
调用 LLM（文本模型）检索主题知识，输出 `KnowledgeBase`：
- 主题概述、分类、标签、关键事实
- 模板专用结构化数据：`lifecycleStages` / `timelineEvents` / `processSteps` / `compareData`
- 英文主题翻译（`englishTopic`，用于后续 Prompt）

### Stage 2 — 内容生成
基于 `KnowledgeBase` + `CardTemplate` 为每张卡片生成 `CardContent`：
- 标题、副标题、正文、底部信息
- 结构化知识模块（概念/要点/示例/适用场景等）
- 系列卡片的章节号、英文副标题

### Stage 3 — Prompt工程（核心引擎）
基于 `KnowledgeBase` + `CardContent` + `StylePreset` + `CardTemplate` 构建六段式 `VisualPrompt`：

**P0 新增 — Stage 0 内容关系判定：**
```
analyzeContentRelation() → ContentAnalysis
  ├── lifecycle → analyzeLifecycleRelation()
  │   ├── 新生/萌芽 (seed/egg/neonatal/birth) → birth: 脆弱、温暖、俯视保护
  │   ├── 成长/发育 (growth/juvenile/nestling) → growth: 进取、动态、侧面视角
  │   ├── 巅峰/繁盛 (peak/adult/mature) → peak: 壮观、高对比、环境全景
  │   └── 衰退/衰老 (decline/elderly/wither) → decline: 沉稳、暮色、大远景
  ├── timeline → analyzeTimelineRelation()
  │   ├── 开端 (ratio < 0.25) → event: 庄重历史氛围
  │   ├── 中段 (0.25-0.75) → event: 清晰叙事氛围
  │   └── 尾声 (ratio > 0.75) → event: 深沉反思氛围
  └── process → analyzeProcessRelation()
      ├── 第一步 → action: 准备阶段
      ├── 中段 → process: 执行阶段
      └── 最后一步 → action: 完成阶段
```

**六段 Prompt 结构：**
1. `style` — 画面基调（风格预设的 stylePrompt）
2. `layout` — 布局骨架（按模板和卡片序号构建，融合 contentRelation.compositionHint）
3. `mainVisual` — 主视觉插画（融合内容正文 + 阶段名称 + 解剖学约束）
4. `auxiliary` — 辅助插画（按阶段智能判断，成虫不画蛋，幼虫不画翅膀）
5. `whitespace` — 留白区定义（百分比位置，用于HTML叠文字）
6. `decoration` — 装饰收尾（边框、印章、底部元素）
7. `atmosphere` — 氛围描述（融合 contentRelation.sceneMood，按卡片序号轮换）
8. `safetyZone` — 信息预算安全区（P1新增，量化文字叠加区域约束）

**P3 新增 — AI 改写可解释性：**
- `AIPromptRewriter.rewrite()` 返回 `{ mainVisual, auxiliary, reason, visualFocus }`
- 改写理由和画面焦点嵌入 `contentRelation.reason`
- 失败时自动 fallback 到模板版

**负面提示词**（`getNegativePrompt()` 方法保留，供 imageService.ts 拼接使用）：
- 文字类：text, words, Chinese characters, watermark, signature 等
- 质量类：blurry, low quality, poorly drawn 等
- 解剖学类：extra limbs, multiple heads, duplicate animals 等
- 面部类：bad face, disfigured face 等
- 肢体类：extra fingers, fused fingers 等
- 现实感类：cartoonish, CGI, plastic look 等

### Stage 4 — AI出图
调用图像生成 API，将 `VisualPrompt` 转为图片：
- 支持 Mock 模式（`VITE_USE_MOCK=true`）：根据 prompt 关键词生成 SVG 占位图
- AI 模式：调用 `/ai-api/images/generations`，含 429/503 限流重试逻辑
- 返回 base64 data URL 或代理下载 URL

### Stage 5 — 排版导出
基于 React 组件渲染 HTML 排版卡片，使用 `html-to-image` 截图：
- 单张 PNG 导出
- 批量 PNG 逐个下载（间隔 250ms 防浏览器拦截）
- ZIP 打包下载（JSZip）

---

## 三、核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| **Prompt 引擎** | `services/promptBuilder.ts` | 六段式 Prompt 构建 + P0内容分析 + P1安全区 + P3改写 |
| **AI 改写器** | `services/aiPromptRewriter.ts` | 调用 LLM 改写主视觉/辅助元素，返回 reason/visualFocus |
| **知识服务** | `services/knowledgeService.ts` | 调用 LLM 检索主题知识，结构化输出 |
| **内容服务** | `services/contentService.ts` | 基于知识生成每张卡片的内容数据 |
| **图片服务** | `services/imageService.ts` | 调用图像 API 生成图片，含限流重试 |
| **导出服务** | `services/exportService.ts` | PNG/JPEG 导出 + ZIP 打包 |
| **项目服务** | `services/projectService.ts` | localStorage 保存/加载，JSON 下载 |
| **风格引擎** | `services/styleEngine.ts` | 将 StylePreset 应用到卡片视觉 |
| **类型定义** | `types.ts` | 全部 TypeScript 类型（10个Part） |
| **V2 模板** | `templates/v2Templates.ts` | 卡片模板定义（lifecycle/timeline/process/quick等） |
| **风格预设** | `templates/stylePresets.ts` | 5种风格（水彩/粘土/赛博/极简/水墨）含 P2 fixedConstraints |

---

## 四、数据模型

### KnowledgeBase（Stage 1 输出）
```typescript
{
  topic, summary, category, tags, facts, keyPoints,
  englishTopic,  // 英文主题，用于 Prompt
  lifecycleStages?, timelineEvents?, processSteps?, compareData?
}
```

### CardContent（Stage 2 输出）
```typescript
{
  title, subtitle, body, footer, tags,
  seriesName, episode, topicNumber, englishSubtitle,
  definition, modules, processSteps, compareItems,
  highlights, chapter, quote, handwrittenNote
}
```

### VisualPrompt（Stage 3 输出）
```typescript
{
  style, layout, mainVisual, auxiliary, whitespace, decoration,
  atmosphere?, safetyZone?, contentRelation?, negative
}
```

### CardData（贯穿全链路）
```typescript
{
  id, stage, subtitle,
  knowledge?, content?, prompt?, imageUrl?, imageStatus?
}
```

---

## 五、模板系统

### 模板分类
| 类别 | 模板ID | 卡片数 | 说明 |
|------|--------|--------|------|
| **系列模板** | lifecycle | 6 | 生命周期，按阶段轮换氛围 |
| | timeline | 6 | 历史时间线 |
| | process | 6 | 操作流程 |
| **单卡模板** | quick-knowledge | 1 | 快速知识卡 |
| | encyclopedia | 1 | 百科卡片 |
| | compare-card | 2 | 对比分析卡 |

### 渲染器类型
- `lifecycle` / `timeline` / `process` → `KnowledgeCardRenderer`
- `html` → `RichCardRenderer`
- 默认 → `CardRenderer`

---

## 六、风格预设

| 风格 | baseColor | 特点 | P2 fixedConstraints |
|------|-----------|------|---------------------|
| 水彩自然 | #f9f6f0 | 柔和晕染、笔触细腻 | 有机纹理、无几何硬边 |
| 粘土风 | #f5f0e6 | 哑光质感、雕塑感 | 圆润形态、无数字效果 |
| 赛博霓虹 | #0f0f1a | 暗色背景、霓虹发光 | 高对比度、无自然光 |
| 极简扁平 | #f0f4f8 | 几何形状、留白多 | 无摄影纹理、无笔触 |
| 中国水墨 | #f5f0e6 | 宣纸纹理、水墨渐变 | 无霓虹、无光泽表面 |

---

## 七、P0-P3 改进总结

### P0 — 内容关系判定前置
- 新增 `ContentAnalysis` 类型和 `ContentRelationType` 枚举
- 新增 `analyzeContentRelation()` 及 3 个细分方法
- 13种内容关系类型映射到视觉策略
- `buildAtmosphere()` 优先使用 `contentRelation.sceneMood`
- `buildLayout()` 融合 `contentRelation.compositionHint`

### P1 — 信息预算硬约束
- 新增 `buildSafetyZone()` 方法，为每种模板定义量化安全区
- 嵌入 `VisualPrompt.safetyZone` 字段
- 包含字体大小、边距、区域比例等量化约束

### P2 — StylePreset 固定/动态边界
- `StylePreset` 新增 `fixedConstraints` 和 `dynamicSlots` 字段
- 5种风格预设全部填充
- 明确品牌一致性约束和动态填充维度

### P3 — 改写器可解释性
- `AIPromptRewriter.rewrite()` 返回 `reason` 和 `visualFocus`
- 改写理由嵌入 `contentRelation.reason`
- `toPromptString()` 输出纯净正向提示词（无负面词）

---

## 八、环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE_URL` | `/ai-api` | AI API 基础路径 |
| `VITE_TEXT_MODEL` | `agnes-2.5-flash` | 文本模型名称 |
| `VITE_IMAGE_MODEL` | `agnes-image-2.1-flash` | 图像模型名称 |
| `VITE_IMAGE_SIZE` | `1024x1536` | 图片尺寸 |
|- `VITE_USE_MOCK` | `false` | 是否启用 Mock 模式

---

## 九、P4 — AI原生卡片设计架构（Stage 4.5）

### 背景
旧方案使用固定 TemplateLayer + 绝对定位，卡片排版千篇一律，无法根据生成图片的构图做差异化设计。

### 新架构
**两阶段设计流程：**
1. **Vision API 分析构图**（`analyzeComposition()`）：
   - 主体位置（left/right/center/top/bottom/scattered）
   - 留白区域（top/left/right/bottom/center）
   - 主色调（dominantColor）
   - 氛围（mood）
   - 光线方向（lightDirection）
   - 构图风格（compositionStyle）

2. **AI 生成自适应 HTML 卡片**（`generateCardDesign()`）：
   - 根据留白区域决定布局类型（left-text / right-text / bottom-text / floating / split）
   - 根据主色调和风格预设生成配色
   - 根据内容和知识数据生成完整 HTML（含图片、标题、正文、标签、页脚）
   - 使用 Tailwind CSS 类，输出干净的卡片 div

### 核心文件
| 文件 | 说明 |
|------|------|
| `src/services/cardDesignService.ts` | CardDesignService 核心服务 |
| `src/components/AdaptiveCardRenderer.tsx` | 自适应渲染器（AI设计优先） |
| `src/types.ts` | CardDesignOutput / designStatus / StageNumber 4.5 |

### 类型定义
```typescript
interface CardDesignOutput {
  layout: 'left-text' | 'right-text' | 'bottom-text' | 'center-text' | 'split' | 'floating';
  colors: { bg: string; text: string; accent: string; secondary: string; };
  html: string;
  designDescription: string;
}
```

### 降级策略
- AI 设计失败 → 自动生成 fallback HTML（基于留白区域判断基础布局）
- 无 design 数据 → fallback 到旧模板渲染器（TemplateLayer）

---

## 十、环境变量

```bash
# 安装依赖
npm install

# 开发模式
npm run dev  # http://localhost:5173/

# 构建
npm run build

# 预览构建产物
npm run preview
```

---

## 十、API 接口

| 端点 | 方法 | 用途 |
|------|------|------|
| `/ai-api/chat/completions` | POST | 文本生成（知识检索、内容生成、Prompt改写） |
| `/ai-api/images/generations` | POST | 图像生成 |
| `/ai-image-proxy` | GET | 图片代理下载（解决跨域） |

---

## 十二、文件结构

```
ai-card-generator/
├── src/
│   ├── App.tsx                    # 主应用：六阶段工作流状态管理（含 Stage 4.5）
│   ├── main.tsx                   # 入口
│   ├── style.css                  # Tailwind 指令 + 全局样式
│   ├── types.ts                   # 全部 TypeScript 类型定义
│   ├── components/
│   │   ├── CardRenderer.tsx       # 默认渲染器
│   │   ├── KnowledgeCardRenderer.tsx  # 系列模板渲染器（lifecycle/timeline/process）
│   │   ├── RichCardRenderer.tsx   # HTML 模板渲染器
│   │   ├── TemplatePreview.tsx    # 模板预览组件
│   │   └── AdaptiveCardRenderer.tsx  # ★ P4 自适应渲染器（AI设计优先）
│   ├── services/
│   │   ├── promptBuilder.ts       # ★ 六段式 Prompt 引擎（P0-P3）
│   │   ├── aiPromptRewriter.ts    # ★ AI 改写器（P3）
│   │   ├── knowledgeService.ts    # 知识检索服务
│   │   ├── contentService.ts      # 内容生成服务
│   │   ├── imageService.ts        # 图像生成服务
│   │   ├── cardDesignService.ts   # ★ P4 AI卡片设计服务（Vision API）
│   │   ├── exportService.ts       # PNG/ZIP 导出服务
│   │   ├── projectService.ts      # 项目保存/加载
│   │   └── styleEngine.ts         # 视觉风格引擎
│   └── templates/
│       ├── v2Templates.ts         # 卡片模板定义
│       ├── stylePresets.ts        # 风格预设（含 P2 字段）
│       ├── knowledgeTemplates.ts  # 知识模板
│       ├── richTemplates.ts       # 富卡片模板
│       └── index.ts               # 导出入口
└── package.json
```

---

*归档日期：2026-08-05*
*Git Tag：v3.0.0 | Commit：aecd5a8*
*最后更新：P4 AI原生卡片设计架构（Stage 4.5）实现完成，Vision API 分析构图 + AI生成自适应HTML卡片*
