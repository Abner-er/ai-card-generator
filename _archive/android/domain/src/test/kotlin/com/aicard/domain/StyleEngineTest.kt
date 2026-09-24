package com.aicard.domain

// 对齐 src/blocks/styleEngine.test.ts —— 钉死「副标题漂移」历史缺陷回归
//
// 历史缺陷：生图 prompt 里副标题只写「下方一行副标题」抽象占位、不给具体文字，
// 生图模型每次自行发挥 → 同一张多次生成副标题漂移。
//
// 额外守卫（TS 侧未覆盖、但属同一批踩坑逻辑）：sanitizeLayoutHint / recommendStyle / stripPageRoleWord。

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** 与 TS 测试里的 style 完全一致：无 background、无 textTheme */
private fun testStyle() = ModuleStyle(
    artStyle = "扁平插画",
    palette = "蓝灰",
    mood = "专业",
    typography = "圆润手写",
    lighting = "柔和",
    camera = "平视",
    material = "手绘线"
)

/** TS 侧 page 形参只用到 title / ratio / visualHint，CardPage 的 id、moduleIds 用占位值 */
private fun testPage(title: String, ratio: Ratio = Ratio.R3X4, visualHint: String = "") = CardPage(
    id = "p1",
    title = title,
    moduleIds = emptyList(),
    ratio = ratio,
    visualHint = visualHint
)

/** TS 侧 modules 形参只用到 type / title / body / bullets / icon，DecomposedModule 必填字段给占位值 */
private fun testModule(
    type: ModuleType,
    title: String,
    body: String = "",
    bullets: List<String> = emptyList(),
    icon: String = ""
) = DecomposedModule(
    id = "m1",
    type = type,
    title = title,
    body = body,
    bullets = bullets,
    icon = icon,
    ratio = Ratio.R3X4,
    layout = DEFAULT_LAYOUT.getValue(type)
)

class 生图提示词标题固定防副标题漂移回归 {

    @Test
    fun `内容页 副标题固定为系列标题 且带不得更改约束`() {
        val p = buildPagePrompt(
            testPage("注意力机制"),
            listOf(testModule(ModuleType.DEFINITION, "注意力", "正文")),
            testStyle(),
            PagePromptOptions(seriesTitle = "Transformer 图解")
        )
        assertContainsText(p, "大号主标题「注意力机制」")
        assertContainsText(p, "下方一行副标题「Transformer 图解」")
        assertContainsText(p, "此副标题文字为固定内容")
    }

    @Test
    fun `封面页 副标题用固定定位文案 不与系列主标题重复`() {
        val p = buildPagePrompt(
            testPage("封面"),
            listOf(testModule(ModuleType.COVER, "封面", "正文")),
            testStyle(),
            PagePromptOptions(seriesTitle = "Transformer 图解", totalPages = 4)
        )
        assertContainsText(p, "大号主标题「Transformer 图解」")
        assertContainsText(p, "下方一行副标题「知识图解 · 4 页」")
    }

    @Test
    fun `风格锚点图 副标题固定为系列定位文案并约束不得改字`() {
        val p = buildAnchorPrompt("Transformer 图解", testStyle())
        assertContainsText(p, "下方一行副标题「知识图解 · 全系列」")
        assertContainsText(p, "不得更改或临场发挥")
    }

    @Test
    fun `页面与锚点底部总结 须带固定格式约束 防悬空占位`() {
        val page = buildPagePrompt(
            testPage("注意力机制"),
            listOf(testModule(ModuleType.DEFINITION, "注意力", "正文")),
            testStyle(),
            PagePromptOptions(seriesTitle = "Transformer 图解")
        )
        assertContainsText(page, "固定格式：只能是一句连贯的话")
        assertContainsText(page, "不得写成列表")

        val anchor = buildAnchorPrompt("Transformer 图解", testStyle())
        assertContainsText(anchor, "固定格式：只能是一句连贯的话")
    }

    private fun assertContainsText(actual: String, needle: String) {
        assertTrue(actual.contains(needle), "提示词应包含「$needle」，实际：$actual")
    }
}

class 版式描述清洗守卫 {

    @Test
    fun `剔除留白与轻微纹理段并以顿号重组`() {
        assertEquals("主体居中", sanitizeLayoutHint("主体居中，底部留白，四周轻微纹理"))
    }

    @Test
    fun `切分符覆盖句号分号顿号 重组后统一为逗号`() {
        // TS 行为：split(/[，。；、]/) 丢弃原标点，join('，') 统一补回
        assertEquals("开阔构图，主体突出", sanitizeLayoutHint("开阔构图。留白若干、主体突出"))
    }

    @Test
    fun `全部为空白描述时返回空串`() {
        assertEquals("", sanitizeLayoutHint("大面积留白，底部空白"))
    }
}

class 风格推荐守卫 {

    @Test
    fun `甜品命中 watercolor 预设并带回推荐语`() {
        val r = recommendStyle("甜品")
        assertTrue(r != null, "「甜品」应命中 watercolor")
        assertEquals("watercolor", r.presetId)
        assertEquals("甜品饮品适合水彩风格，柔和精致", r.reason)
    }

    @Test
    fun `同一预设多条规则命中时分数累加且 reason 取最后命中项`() {
        // TS 计分细节：cur 存在时 newScore 必大于 cur.score，故 reason 被最后命中的规则覆盖
        val r = recommendStyle("蛋糕和自然")
        assertTrue(r != null)
        assertEquals("watercolor", r.presetId)
        assertEquals("自然主题适合水彩风格，柔和灵动", r.reason)
    }

    @Test
    fun `词表未收录的风格名不产生推荐`() {
        // 「水彩」二字并不在任何 keywords 列表里（词表只有品类/主题词），源码实际返回 null
        assertNull(recommendStyle("水彩"))
        assertNull(recommendStyle("无意义输入"))
    }
}

class 页面结构词剥离守卫 {

    @Test
    fun `剥掉封面顿号前缀只留内容主题`() {
        assertEquals("注意力机制", stripPageRoleWord("封面、注意力机制"))
    }

    @Test
    fun `标题恰为结构词时返回空串`() {
        assertEquals("", stripPageRoleWord("封面"))
        assertEquals("", stripPageRoleWord("总结"))
    }

    @Test
    fun `剥离后残留连接词也一并剥掉`() {
        assertEquals("定义", stripPageRoleWord("封面与定义"))
    }

    @Test
    fun `英文结构词与多轮剥离`() {
        assertEquals("定义", stripPageRoleWord("intro、封面与定义"))
    }
}
