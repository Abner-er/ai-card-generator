package com.aicard.domain

// 对齐 src/blocks/textUtil.test.ts —— 钉死 [D-1][D-2][A-1] 历史缺陷回归

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TextUtilTest {

    @Test
    fun `D-1 切断点落在英文单词中间时回退到词边界`() {
        val t = "Wi-Fi 8 vs Wi-Fi 7 version comparison guide for everyone"
        assertEquals("Wi-Fi 8 vs Wi-Fi 7", trimTitle(t, "", 20))
    }

    @Test
    fun `D-1 版本号含空格-&-点-的词组不被拆散`() {
        val t = "R&D budget for Q3 hit 2.5 billion dollars last fiscal year"
        val cut = trimTitle(t, "", 13)
        assertEquals("R&D budget", cut)
    }

    @Test
    fun `中文标题按长度截断即可`() {
        val t = "这是一段非常长的中文标题用来测试截断行为是否符合预期应该没问题吧"
        val expected = t.substring(0, 20).replace(Regex("[，。]+$"), "")
        assertEquals(expected, trimTitle(t, "", 20))
    }

    @Test
    fun `D-2 截断后结尾悬挂的标点空格被清掉`() {
        val t = "为什么工作越久，赚钱越难？这是正文的更多内容，远超截断上限了还有一堆"
        val cut = trimTitle(t, "", 13)
        assertEquals("为什么工作越久，赚钱越难", cut)
        assertTrue(!cut.matches(Regex("[，。、,;；:：!！？\\s]$")))
    }

    @Test
    fun `未超上限的标题原样返回`() {
        assertEquals("Wi-Fi 8 开卖", trimTitle("Wi-Fi 8 开卖"))
        assertEquals("Transformer", trimTitle("Transformer"))
    }

    @Test
    fun `空值全空格返回 fallback`() {
        assertEquals("知识图解", trimTitle(null, "知识图解"))
        assertEquals("知识图解", trimTitle("   ", "知识图解"))
        assertEquals("FB", trimTitle(null, "FB"))
    }

    @Test
    fun `截断后只剩标点时返回 fallback 而不是空串`() {
        assertEquals("FB", trimTitle("，。、，。、abcdef", "FB", 3))
    }
}

class CountCharsTest {

    @Test
    fun `A-1 纯中文文章字数按字符计`() {
        val cn = "职场沟通需要掌握很多技巧"
        assertEquals(12, countChars(cn))
    }

    @Test
    fun `空白字符不计入`() {
        assertEquals(12, countChars("hello world 你好"))
    }

    @Test
    fun `空串为 0`() {
        assertEquals(0, countChars(""))
    }
}
