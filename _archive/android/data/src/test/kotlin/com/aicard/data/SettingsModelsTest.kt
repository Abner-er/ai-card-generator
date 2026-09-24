package com.aicard.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** SettingsModels 行为测试——直译 settings.ts 的默认值/maskKey/placeholderOk。 */
class SettingsModelsTest {

    @Test
    fun `默认参数对齐 ENV_DEFAULTS`() {
        val s = AppSettings()
        assertEquals("agnes-2.5-flash", s.text.model)
        assertEquals("", s.text.checkModel)
        assertEquals("", s.text.extractModel)
        assertEquals(0.6, s.text.temperature)
        assertEquals(0.0, s.text.selfCheckTemperature)
        assertEquals(0.3, s.text.extractTemperature)
        assertEquals(ImageProviderId.QWEN, s.image.providerId)
        assertEquals("qwen-image-3.0", s.image.model)
        assertEquals(true, s.image.promptExtend)
        assertEquals(3, s.image.maxRetries)
        assertEquals(20000L, s.image.retryBackoffMs)
        assertEquals("https://api.agnes-ai.cn/v1", s.proxy.textBaseUrl)
        assertEquals("https://dashscope.aliyuncs.com", s.proxy.dashBaseUrl)
        assertEquals("", s.proxy.checkBaseUrl)
        assertEquals("https://token.sensenova.cn/v1", s.proxy.sensenovaBaseUrl)
        assertEquals(false, s.mock)
    }

    @Test
    fun `maskKey 三态`() {
        // 未配置/占位符 → 空
        assertEquals("", maskKey(""))
        assertEquals("", maskKey(null))
        assertEquals("", maskKey("your-api-key-here"))
        // ≤10 位 → 全打点
        assertEquals("•••", maskKey("1234567890"))
        assertEquals("•••", maskKey("abc"))
        // >10 位 → 前6…后3
        assertEquals("123456…abc", maskKey("1234567890abc"))
        assertEquals("123456…987", maskKey("1234567890987"))
    }

    @Test
    fun `placeholderOk 边界`() {
        assertFalse(placeholderOk(""))
        assertFalse(placeholderOk(null))
        assertFalse(placeholderOk("your-api-key-here"))
        assertFalse(placeholderOk("sk-xxx-your-api-key-here"))
        assertTrue(placeholderOk("sk-real-key"))
    }

    @Test
    fun `ImageProviderId fromRaw 映射`() {
        assertEquals(ImageProviderId.QWEN, ImageProviderId.fromRaw("qwen"))
        assertEquals(ImageProviderId.SENSENOVA, ImageProviderId.fromRaw("sensenova"))
        assertEquals(null, ImageProviderId.fromRaw("dall-e"))
    }

    @Test
    fun `模型名与端点协商`() {
        val s = AppSettings()
        // checkModel 留空回退 model
        assertEquals("agnes-2.5-flash", checkModelName(s))
        assertEquals("agnes-2.5-flash", extractModelName(s))
        val s2 = s.copy(text = s.text.copy(checkModel = "  deepseek-r1  ", extractModel = "qwen-long"))
        assertEquals("deepseek-r1", checkModelName(s2))
        assertEquals("qwen-long", extractModelName(s2))
        // checkBaseUrl 留空回退 textBaseUrl；check key 留空回退 agnes key
        val (base, key) = checkGatewayPlan(
            s.copy(proxy = s.proxy.copy(checkBaseUrl = "")),
            { slot ->
                when (slot) {
                    KeySlot.AGNES -> "agnes-key"
                    KeySlot.CHECK -> ""
                    else -> ""
                }
            }
        )
        assertEquals("https://api.agnes-ai.cn/v1", base)
        assertEquals("agnes-key", key)
    }
}