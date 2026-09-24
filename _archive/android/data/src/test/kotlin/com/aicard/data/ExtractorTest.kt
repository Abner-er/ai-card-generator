package com.aicard.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** 正文/格式解析纯函数测试——逐函数直译 vite.config.ts / contentExtractor.ts 的正则链路。 */
class ExtractorTest {

    @Test
    fun `decodeEntities 全量实体`() {
        assertEquals(
            " " + "<" + ">" + "\"" + "'" + "&" + "中中",
            decodeEntities("&nbsp;&lt;&gt;&quot;&#39;&amp;&#20013;&#x4e2d;")
        )
    }

    @Test
    fun `stripTags 去标签并折叠空白`() {
        assertEquals("hello world", stripTags("<p>   hello <b>world</b>  </p>"))
        // 实体先解码再折叠
        assertEquals("a & b", stripTags("a &amp; b"))
    }

    @Test
    fun `htmlToText 保留段落换行并过滤短行`() {
        val html = """
            <div><h1>标题</h1><p>第一段文字内容足够长</p><p>第二段内容也足够长</p></div>
        """.trimIndent()
        val text = htmlToText(html)
        // 只保留 >=2 字的行
        assertEquals(listOf("标题", "第一段文字内容足够长", "第二段内容也足够长"), text.split("\n"))
    }

    @Test
    fun `pickTitle 三层兜底 og-title`() {
        val html = """<html><head><meta property="og:title" content="  我的 标题 "><title>旧标题</title></head></html>"""
        assertEquals("我的 标题", pickTitle(html))
    }

    @Test
    fun `pickTitle 兜底 msg_title`() {
        val html = """<script>var msg_title = '微信标题abc';</script>"""
        assertEquals("微信标题abc", pickTitle(html))
    }

    @Test
    fun `pickTitle 兜底 title 标签`() {
        assertEquals("页面标题", pickTitle("<html><title>  页面标题</title></html>"))
        assertEquals("", pickTitle("<html><body>没有标题</body></html>"))
    }

    @Test
    fun `extractArticle 优先 js_content 容器`() {
        val html = """
            <div id="js_content"><p>微信文章第一段内容足够长描述。</p><p>第二段也是有效内容。</p></div>
            <div id="js_tags"></div>
        """.trimIndent()
        val (title, content) = extractArticle(html)
        assertTrue(content.contains("微信文章第一段"))
        assertTrue(content.contains("第二段也是有效"))
        // 截断 40 字门槛内命中
        assertTrue(content.length >= 1)
        assertEquals("", title) // 无标题时为空
    }

    @Test
    fun `extractArticle 通用段落标签兜底`() {
        val html = "<article><h2>章节一</h2><p>通用段落内容足够长度通过门槛。</p></article>"
        val (_, content) = extractArticle(html)
        assertTrue(content.contains("通用段落"))
    }

    @Test
    fun `parseMarkdownContent image-after-link quirk 原样保留`() {
        // 已知 quirk：image 规则排在 link 之后。
        // 带 alt 的 ![alt](url) 会被 link 规则先吃掉 → 变 !alt；
        // 仅空 alt 的 ![](url)（link 规则要求 alt 至少 1 字符，匹配不到）才命中 image 规则 → 变 [图片]
        val out = parseMarkdownContent("## 标题\n\n![一张图](https://a.com/x.png)\n\n正文", "test.md")
        assertEquals("!一张图\n\n正文", out.content)
        assertEquals(SourceType.MARKDOWN, out.sourceType)
        // 空 alt 才走 image 规则
        val out0 = parseMarkdownContent("![](http://b.png)\n正文", null)
        assertEquals("[图片]\n正文", out0.content)
    }

    @Test
    fun `detectTitle h1 优先`() {
        assertEquals("主标题 A", detectTitle("# 主标题 A\n正文"))
        assertEquals("副标题", detectTitle("## 副标题\n正文"))
        // 首行兜底
        assertEquals("这是一段足够长的内容", detectTitle("这是一段足够长的内容\n第二行"))
    }

    @Test
    fun `detectSourceType markdown`() {
        assertEquals(SourceType.MARKDOWN, detectSourceType("# 标题\n- 列表项"))
        assertEquals(SourceType.TEXT, detectSourceType("纯文本\n没有标记"))
    }
}