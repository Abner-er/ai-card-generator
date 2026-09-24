package com.aicard.domain

// 对齐 src/blocks/decompose.test.ts —— 钉死历史缺陷回归
//
// decompose.test.ts 用 vi.stubGlobal('fetch', ...) 拦截 HTTP；
// :domain 层不做 HTTP，这里改用可注入的 FakeGateway：
//  - 返回固定 content
//  - 抛 HttpFailure
//  - 捕获 ChatRequest（校验 max_tokens）

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking

private val STYLE = ModuleStyle(
    artStyle = "扁平矢量插画",
    palette = "明亮多彩、低饱和",
    mood = "轻松现代",
    typography = "粗体无衬线、高对比",
    lighting = "均匀漫射光、柔和无硬阴影",
    camera = "平视正面、居中构图",
    material = "干净矢量色块、平滑边缘、无纹理",
)

private class FakeGateway(
    private val content: String? = null,
    private val failure: HttpFailure? = null,
) : TextLlmGateway {
    var captured: ChatRequest? = null

    override suspend fun chatCompletion(request: ChatRequest): String {
        captured = request
        if (failure != null) throw failure
        return content ?: ""
    }
}

class DecomposeTest {

    @Test
    fun `B-1 回归 HTTP 5xx 抛知识拆解失败 而不是返回 mock 模板`() = runBlocking {
        val gw = FakeGateway(failure = HttpFailure(500, "Internal Server Error"))
        val e = assertFailsWith<RuntimeException> {
            KnowledgeDecomposer(gw).decompose("Transformer 入门", STYLE, DecomposeOptions(mock = false))
        }
        assertTrue("知识拆解失败" in (e.message ?: ""), "message was: ${e.message}")
    }

    @Test
    fun `B-1 回归 模型输出无法解析时抛无法解析 而不是静默给假结果`() = runBlocking {
        val gw = FakeGateway(content = "抱歉，我无法完成这个任务。")
        val e = assertFailsWith<RuntimeException> {
            KnowledgeDecomposer(gw).decompose("Transformer 入门", STYLE, DecomposeOptions(mock = false))
        }
        assertTrue("无法解析" in (e.message ?: ""), "message was: ${e.message}")
    }

    @Test
    fun `B-1 回归 解析出空模块列表同样抛错 modules 为空等于失败`() = runBlocking {
        val gw = FakeGateway(content = """{"seriesTitle":"X","modules":[]}""")
        val e = assertFailsWith<RuntimeException> {
            KnowledgeDecomposer(gw).decompose("Transformer 入门", STYLE, DecomposeOptions(mock = false))
        }
        assertTrue("知识拆解失败" in (e.message ?: ""), "message was: ${e.message}")
    }

    @Test
    fun `错误信息不被重复加前缀 内层已带知识拆解失败时不叠两层`() = runBlocking {
        val gw = FakeGateway(failure = HttpFailure(500, "boom"))
        val e = assertFailsWith<RuntimeException> {
            KnowledgeDecomposer(gw).decompose("x", STYLE, DecomposeOptions(mock = false))
        }
        assertTrue((e.message ?: "").startsWith("知识拆解失败: 500"), "message was: ${e.message}")
    }

    @Test
    fun `显式 mock true 才走 mock 结构 cover 打头加自动分页`() = runBlocking {
        val r = KnowledgeDecomposer(FakeGateway())
            .decompose("Transformer", STYLE, DecomposeOptions(mock = true))
        assertEquals(ModuleType.COVER, r.modules[0].type)
        assertTrue(r.pages.isNotEmpty())
        assertEquals("Transformer", r.seriesTitle)
    }

    @Test
    fun `D 回归 seriesTitle 超长英文按词边界回退 不腰斩单词`() = runBlocking {
        val longTitle = "Introduction to Transformer Architecture and Attention Mechanisms"
        val content = """{"seriesTitle":"$longTitle","modules":[{"id":"m1","type":"cover","title":"封面","body":"正文"}]}"""
        val gw = FakeGateway(content = content)
        val r = KnowledgeDecomposer(gw).decompose("任意输入", STYLE, DecomposeOptions(mock = false))
        // 默认上限 32：截断点落在 "Architecture" 中间 → 回退到 "Transformer"
        assertEquals("Introduction to Transformer", r.seriesTitle)
    }

    @Test
    fun `E 模型输出 JSON 字符串内含裸换行时仍能解析`() = runBlocking {
        // 模拟 3.0 在 string 值里直接塞真实换行（标准 JSON 非法），修复器应转义后解析成功
        val raw = """{
  "seriesTitle": "测试",
  "modules": [
    {"id":"m1","type":"cover","title":"封面","body":"第一行
第二行这里有个真实换行","bullets":["要点一","要点二
要点三"]}
  ],
  "pages": []
}"""
        val gw = FakeGateway(content = raw)
        val r = KnowledgeDecomposer(gw).decompose("任意输入", STYLE, DecomposeOptions(mock = false))
        assertEquals(1, r.modules.size)
        assertTrue("第二行" in r.modules[0].body, "body was: ${r.modules[0].body}")
    }

    @Test
    fun `F 回归 请求必须显式带 max tokens`() = runBlocking {
        val gw = FakeGateway(content = """{"seriesTitle":"X","modules":[{"id":"m1","type":"cover","title":"封面","body":"b"}]}""")
        val r = KnowledgeDecomposer(gw).decompose("任意输入", STYLE, DecomposeOptions(mock = false))
        assertEquals(1, r.modules.size)
        assertEquals(8000, gw.captured!!.maxTokens)
    }
}
