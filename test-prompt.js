// 测试脚本：直接调用拆解和提示词生成
const { decomposeKnowledge } = require('./src/blocks/decompose.ts');
const { buildPagePrompt, recommendStyle } = require('./src/blocks/styleEngine.ts');

async function main() {
  const input = '古法豆腐制作流程';
  
  // 1. 推荐风格
  const rec = recommendStyle(input);
  console.log('推荐风格:', rec.presetId, '-', rec.reason);
  
  // 2. 拆解知识（用 mock 模式可能返回假数据，不用 mock 需要 API key）
  // 这里我们手动构造一个示例结果来展示
  const mockResult = {
    seriesTitle: '古法豆腐制作',
    seriesStyle: {
      artStyle: '国风水墨，留白意境，工笔兼写意',
      palette: '宣纸白、墨色、赭石、石绿、花青',
      mood: '宁静、古朴、典雅',
      typography: '书法字体、竖排、印章点缀',
      lighting: '柔和自然光、宣纸质感',
      camera: '平视或微俯，构图留白',
      material: '水墨晕染、笔触飞白、宣纸纹理'
    },
    modules: [
      { id: 'm1', type: 'cover', title: '古法豆腐制作', body: '传统豆制品工艺，千年传承', bullets: ['泡豆', '磨浆', '点卤'], icon: '', visualHint: '石磨、豆浆、豆腐模具、柴火灶台', ratio: '3:4' },
      { id: 'm2', type: 'step', title: '泡豆磨浆', body: '黄豆浸泡8小时，石磨慢磨出浆', bullets: ['黄豆泡发至两倍大', '石墨顺时针研磨'], icon: '', visualHint: '饱满黄豆、石磨转动、乳白豆浆', ratio: '9:16' },
      { id: 'm3', type: 'step', title: '过滤煮浆', body: '纱布过滤豆渣，柴火煮沸生豆浆', bullets: ['纱布过滤去渣', '大火煮沸、撇沫'], icon: '', visualHint: '纱布过滤、大灶铁锅、沸腾豆浆', ratio: '9:16' },
      { id: 'm4', type: 'step', title: '点卤成花', body: '盐卤或石膏点入，豆浆凝结成豆花', bullets: ['卤水缓慢滴入', '静置15分钟凝固'], icon: '', visualHint: '卤水点入豆浆、豆花凝结', ratio: '9:16' },
      { id: 'm5', type: 'step', title: '压制成型', body: '豆花入模压榨，去水成型为豆腐', bullets: ['纱布包裹入模', '重物压制1小时'], icon: '', visualHint: '木制豆腐盒、纱布、石块压制', ratio: '9:16' }
    ],
    pages: [
      { id: 'p1', title: '封面与简介', moduleIds: ['m1'], ratio: '3:4', visualHint: '大标题居中，背景为豆腐作坊全景，石磨、灶台、木模具等元素隐约可见' },
      { id: 'p2', title: '泡豆与磨浆', moduleIds: ['m2'], ratio: '3:4', visualHint: '上方标题，中部泡豆场景和石磨场景左右排列，下方步骤说明' },
      { id: 'p3', title: '过滤与煮浆', moduleIds: ['m3'], ratio: '3:4', visualHint: '左侧纱布过滤特写，右侧灶台煮浆场景，箭头连接' },
      { id: 'p4', title: '点卤与压制', moduleIds: ['m4', 'm5'], ratio: '3:4', visualHint: '上半部分点卤凝结特写，下半部分压制成型模具，竖向排列' }
    ]
  };
  
  // 3. 生成各页提示词
  console.log('\n=== 各页提示词 ===\n');
  mockResult.pages.forEach((page, i) => {
    const mods = page.moduleIds.map(id => mockResult.modules.find(m => m.id === id)).filter(Boolean);
    const prompt = buildPagePrompt(page, mods, mockResult.seriesStyle);
    console.log(`--- 第${i+1}页：${page.title} (${page.ratio}) ---`);
    console.log(prompt);
    console.log('');
  });
}

main().catch(console.error);
