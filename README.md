# AI知识卡片生成器

> AI出底图 · HTML精确排版 · 一键导出

解决国内大模型直接渲染中文文字容易崩的问题：**AI负责视觉（底图），HTML负责排版（文字），截图引擎负责合成（成品）**。

## 核心特性

- **三套内置模板**：国风经典、现代科技、简约清新
- **AI底图生成**：支持通义万相、文心一格API，内置Mock模式免API即可体验
- **精确中文排版**：通过HTML/CSS控制字体、行高、字间距，文字渲染100%可控
- **提示词引擎**：自动根据内容和模板生成优化的AI绘图提示词，明确排除文字
- **一键导出**：支持PNG高清导出（2x像素密度）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

启动后访问 `http://localhost:5173`

## 使用流程

1. **选择模板** - 在左侧面板选择卡片风格
2. **编辑内容** - 填写标题、副标题、正文、标签
3. **生成底图** - 点击"生成AI底图"按钮（Mock模式无需API）
4. **导出图片** - 点击"导出PNG图片"下载成品

## 接入真实AI服务

### 通义万相

1. 在阿里云开通通义万相服务
2. 获取API Key
3. 在界面中选择"通义万相"，输入API Key
4. 需要配置后端代理转发请求（避免API Key暴露）

后端代理示例（Node.js Express）：

```javascript
app.post('/api/generate-image/tongyi', async (req, res) => {
  const { prompt, negative_prompt, apiKey } = req.body;
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'wanx-v1',
      input: { prompt },
      parameters: { n: 1, size: '1024*1024', negative_prompt },
    }),
  });
  const data = await response.json();
  res.json(data);
});
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 样式方案 | Tailwind CSS 3 |
| 截图导出 | html-to-image |
| AI服务 | 通义万相 / 文心一格 / Mock |

## 项目结构

```
src/
├── components/
│   └── CardRenderer.tsx      # 卡片渲染器组件
├── services/
│   ├── promptBuilder.ts       # 提示词引擎
│   ├── imageService.ts        # AI图片生成服务
│   └── exportService.ts       # 导出工具
├── templates/
│   └── index.ts               # 模板配置（3套内置模板）
├── types.ts                   # 核心类型定义
├── App.tsx                    # 主界面
├── main.tsx                   # 入口文件
└── style.css                  # 全局样式
```

## 扩展模板

模板采用JSON Schema驱动，添加新模板只需在 `src/templates/index.ts` 中添加配置：

```typescript
{
  id: 'my-template',
  name: '我的模板',
  category: 'minimal',
  canvas: { width: 1080, height: 1440, backgroundColor: '#ffffff' },
  promptTemplate: { /* AI提示词配置 */ },
  layers: [
    { type: 'image', id: 'bg', x: 0, y: 0, width: 1080, height: 900 },
    { type: 'text', id: 'title', content: '{{title}}', x: 80, y: 1000, ... },
    // 更多图层...
  ],
}
```

## License

MIT
