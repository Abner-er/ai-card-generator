package com.aicard.data

import com.aicard.domain.Ratio
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * ImageProviders 行为测试——断言取真实响应形态（提取自 vite.config.ts / imageProvider.ts）。
 */
class ImageProviderTest {

    private fun qwenProvider(server: MockWebServer, settings: ImageSettings, mock: () -> Boolean = { false }): QwenImageProvider {
        return QwenImageProvider(
            http = OkHttpClient.Builder().readTimeout(60, TimeUnit.SECONDS).build(),
            baseUrl = { server.url("/").toString() },
            apiKey = { "ak-fake-key-value-123" },
            config = { settings },
            isMock = mock,
        )
    }

    private fun sensenovaProvider(server: MockWebServer, settings: ImageSettings): SensenovaImageProvider {
        return SensenovaImageProvider(
            http = OkHttpClient.Builder().readTimeout(60, TimeUnit.SECONDS).build(),
            baseUrl = { server.url("/").toString() },
            apiKey = { "sk-fake-key-value-456" },
            config = { settings },
            isMock = { false },
        )
    }

    @Test
    fun `Qwen 正常返回 base64 data url 时解码成字节`() = runTest {
        val server = MockWebServer()
        val pngB64 = java.util.Base64.getEncoder().encodeToString(byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 1, 2, 3))
        server.enqueue(
            MockResponse().setBody(
                """{"output":{"choices":[{"message":{"content":[{"text":"ok","image":"data:image/png;base64,$pngB64"}]}}]}}"""
            )
        )
        server.start()
        try {
            val img = qwenProvider(server, ImageSettings()).generate("一只猫", GenerateImageOptions(Ratio.R1X1))
            assertEquals("image/png", img.mimeType)
            assertEquals(7, img.bytes.size)
            assertEquals(1, server.requestCount)
            // 请求体校验
            val body = server.takeRequest().body.readUtf8()
            assertTrue(body.contains("\"model\":\"qwen-image-3.0\""))
            assertTrue(body.contains("1024*1024"))
            assertTrue(body.contains("\"prompt_extend\":true"))
            assertTrue(body.contains("一只猫"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `Qwen 429 首次即退避重试并成功，progress 提示重试句式`() = runTest {
        val server = MockWebServer()
        val pngB64 = java.util.Base64.getEncoder().encodeToString(byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 1, 2, 3))
        server.enqueue(MockResponse().setResponseCode(429).setBody("{}"))
        server.enqueue(
            MockResponse().setBody(
                """{"output":{"choices":[{"message":{"content":[{"image_url":"data:image/png;base64,$pngB64"}]}}]}}"""
            )
        )
        server.start()
        val progress = mutableListOf<String>()
        try {
            // retryBackoffMs 极短，避免测试卡死
            val provider = qwenProvider(server, ImageSettings(maxRetries = 3, retryBackoffMs = 10))
            provider.generate("猫", GenerateImageOptions(Ratio.R1X1, onProgress = { progress.add(it) }))
            assertEquals(2, server.requestCount) // 首次 429 + 重试成功
            assertEquals("正在生图…", progress[0])
            // TS 语义：attempt===0 显示"正在生图"，attempt=1（第1次重试）显示"重试生成 (2)"
            assertEquals("重试生成 (2)…", progress[1])
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `Qwen 429 超上限抛限流`() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(429).setBody("{}"))
        server.enqueue(MockResponse().setResponseCode(429).setBody("{}"))
        server.start()
        try {
            val provider = qwenProvider(server, ImageSettings(maxRetries = 1, retryBackoffMs = 10))
            val e = assertFailsWith<java.io.IOException> {
                provider.generate("猫", GenerateImageOptions(Ratio.R1X1))
            }
            assertTrue(e.message!!.contains("限流"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `Qwen 401 不重试直接抛 Key 错误`() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(401).setBody("{\"message\":\"invalid key\"}"))
        server.start()
        try {
            val provider = qwenProvider(server, ImageSettings())
            val e = assertFailsWith<java.io.IOException> {
                provider.generate("猫", GenerateImageOptions(Ratio.R1X1))
            }
            assertTrue(e.message!!.contains("DashScope API Key 无效"))
            assertEquals(1, server.requestCount) // 只请求一次
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `extractImage 支持三种响应形态`() {
        // 1) content[] 里 image 字段
        val a = extractImage(kSerialJson("""{"output":{"choices":[{"message":{"content":[{"image":"data:x"}]}}]}}"""))
        assertEquals("data:x", a)
        // 2) content[] 里 image_url 字段
        val b = extractImage(kSerialJson("""{"output":{"choices":[{"message":{"content":[{"image_url":"https://a.c/d.png"}]}}]}}"""))
        assertEquals("https://a.c/d.png", b)
        // 3) output.results[0].url
        val c = extractImage(kSerialJson("""{"output":{"results":[{"url":"https://x.y/z.webp"}]}}"""))
        assertEquals("https://x.y/z.webp", c)
        // 4) 无图返回 null
        val d = extractImage(kSerialJson("""{"output":{}}"""))
        assertNull(d)
    }

    @Test
    fun `Sensenova 走 generations 路径且 size 用 x 分隔`() = runTest {
        val server = MockWebServer()
        val b64 = java.util.Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3, 4))
        server.enqueue(MockResponse().setBody("""{"data":[{"b64_json":"$b64"}]}"""))
        server.start()
        try {
            val provider = sensenovaProvider(server, ImageSettings(providerId = ImageProviderId.SENSENOVA))
            provider.generate("夜景", GenerateImageOptions(Ratio.R1X1))
            val req = server.takeRequest()
            assertTrue(req.path!!.contains("/images/generations"))
            assertTrue(req.body.readUtf8().contains("\"size\":\"1024x1024\""))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `Sensenova 带 refImage 走 edits 路径`() = runTest {
        val server = MockWebServer()
        val b64 = java.util.Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3, 4))
        server.enqueue(MockResponse().setBody("""{"data":[{"b64_json":"$b64"}]}"""))
        server.start()
        try {
            val provider = sensenovaProvider(server, ImageSettings(providerId = ImageProviderId.SENSENOVA))
            provider.generate("改色", GenerateImageOptions(Ratio.R1X1, refImage = byteArrayOf(9, 9)))
            val req = server.takeRequest()
            assertTrue(req.path!!.contains("/images/edits"))
            assertTrue(req.body.readUtf8().contains("data:image/png;base64"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `Mock Provider 不发出任何网络请求`() = runTest {
        val provider = MockImageProvider()
        val img = provider.generate("任意提示", GenerateImageOptions(Ratio.R3X4, mockText = MockCardText("标题", "正文")))
        assertEquals("image/svg+xml", img.mimeType)
        assertTrue(String(img.bytes).contains("<svg"))
        assertTrue(String(img.bytes).contains("MOCK"))
    }

    /** 解析纯 JSON 成 JsonElement 的测试助手（用公开解析器） */
    private fun kSerialJson(raw: String) =
        kotlinx.serialization.json.Json.parseToJsonElement(raw)
}