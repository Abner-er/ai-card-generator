package com.aicard.domain

// 对齐 src/blocks/textDiff.test.ts

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TextDiffTest {

    private fun List<DiffToken>.textOf(vararg kinds: DiffKind) =
        filter { it.kind in kinds }.joinToString("") { it.text }

    @Test
    fun `D-diff-1 完全相同时全部 same 且从左到右贯通`() {
        val toks = diffTokens("WiFi 7", "WiFi 7")
        assertTrue(toks.all { it.kind == DiffKind.SAME })
        assertEquals("WiFi 7", toks.joinToString("") { it.text })
    }

    @Test
    fun `D-diff-2 全书替换时删增分别在各自一侧`() {
        val toks = diffTokens("abc def", "xyz")
        assertEquals("abc def", toks.textOf(DiffKind.SAME, DiffKind.DEL))
        assertEquals("xyz", toks.textOf(DiffKind.SAME, DiffKind.ADD))
        assertTrue(toks.any { it.kind == DiffKind.DEL })
        assertTrue(toks.any { it.kind == DiffKind.ADD })
    }

    @Test
    fun `D-diff-3 知识订正时旧值标 del 新值标 add 公共部分保留 same`() {
        val toks = diffTokens("Wi-Fi 7: 36 GHz 频谱", "Wi-Fi 7: 2.4/5/6 GHz 频段")
        val delText = toks.textOf(DiffKind.DEL)
        val addText = toks.textOf(DiffKind.ADD)
        assertTrue(delText.contains("36"))
        assertTrue(delText.contains("谱"))
        assertTrue(addText.contains("2.4"))
        assertTrue(addText.contains("段"))
        assertTrue(toks.none { it.kind == DiffKind.DEL && it.text.contains("GHz") })
    }

    @Test
    fun `D-diff-4 中文改写既有词变化`() {
        val toks = diffTokens("支持 320MHz 信道", "支持 320MHz 信道和 4K-QAM")
        assertTrue(toks.textOf(DiffKind.ADD).contains("4K-QAM"))
        assertEquals("", toks.textOf(DiffKind.DEL))
    }

    @Test
    fun `D-diff-5 空串安全`() {
        assertEquals(0, diffTokens("", "").size)
        val toks = diffTokens("", "新增内容")
        assertTrue(toks.all { it.kind == DiffKind.ADD })
    }

    @Test
    fun `D-diff-6 英文数字连写词不被拆碎`() {
        val toks = diffTokens("4K-QAM", "4K-QAM")
        assertEquals("4K-QAM", toks.textOf(DiffKind.SAME))
    }
}
