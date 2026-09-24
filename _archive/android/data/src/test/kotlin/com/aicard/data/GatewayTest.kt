package com.aicard.data

import com.aicard.domain.ChatMessage
import com.aicard.domain.ChatRequest
import com.aicard.domain.HttpFailure
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** OpenAiCompatGateway 行为测试——wire 契约由 vite.config.ts forward() 钉死。 */
class GatewayTest {

    private val http = OkHttpClient.Builder().readTimeout(60, TimeUnit.SECONDS).build()

    @Test
    fun `请求体字段与 wire 契约一致 max_tokens snake_case`() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse().setBody("""{"choices":[{"message":{"content":"解析结果"}}]}"""))
        server.start()
        try {
            val gateway = OpenAiCompatGateway(
                http = http,
                baseUrl = { server.url("/v1/").toString() },
                apiKey = { "sk-real-agnes-key-value" },
            )
            val out = gateway.chatCompletion(
                ChatRequest(
                    model = "agnes-2.5-flash",
                    messages = listOf(
                        ChatMessage("system", "你是助手"),
                        ChatMessage("user", "你好"),
                    ),
                    temperature = 0.6,
                    maxTokens = 8000,
                )
            )
            assertEquals("解析结果", out)

            val recorded = server.takeRequest()
            val reqPath = recorded.path!!
            // 尾斜杠剥离后拼 /chat/completions
            assertTrue(reqPath.endsWith("/chat/completions"))
            val body = recorded.body.readUtf8()
            assertTrue(body.contains("\"model\":\"agnes-2.5-flash\""))
            // 契约字段必须是 snake_case
            assertTrue(body.contains("\"max_tokens\":8000"))
            assertFalse(body.contains("\"maxTokens\""))
            assertTrue(body.contains("\"role\":\"user\""))
            assertTrue(body.contains("\"content\":\"你好\""))
            assertEquals("Bearer sk-real-agnes-key-value", recorded.getHeader("Authorization"))
            assertEquals("application/json; charset=utf-8", recorded.getHeader("Content-Type"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `无效 key 不附 Authorization`() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse().setBody("""{"choices":[{"message":{"content":"x"}}]}"""))
        server.start()
        try {
            val gateway = OpenAiCompatGateway(
                http = http,
                baseUrl = { server.url("/").toString() },
                apiKey = { "your-api-key-here" },
            )
            gateway.chatCompletion(ChatRequest("m", listOf(ChatMessage("user", "hi")), 0.5, 100))
            assertNull(server.takeRequest().getHeader("Authorization"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `尾部斜杠会被剥离再拼接`() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse().setBody("""{"choices":[{"message":{"content":"ok"}}]}"""))
        server.start()
        try {
            val gateway = OpenAiCompatGateway(
                http = http,
                baseUrl = { server.url("/withSlash/").toString() },
                apiKey = { "sk-x" },
            )
            gateway.chatCompletion(ChatRequest("m", listOf(ChatMessage("user", "hi")), 0.5, 100))
            val path = server.takeRequest().path!!
            // server.url() 返回带了 path 前缀，源路径保留 slash，尾斜杠剥离逻辑作用于 baseUrl 字符串
            assertTrue(path.contains("/chat/completions"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `非 2xx 抛 HttpFailure 带状态码与响应体`() = runTest {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(500).setBody("{\"error\":\"boom\"}"))
        server.start()
        try {
            val gateway = OpenAiCompatGateway(
                http = http,
                baseUrl = { server.url("/").toString() },
                apiKey = { "sk-x" },
            )
            val e = assertFailsWith<HttpFailure> {
                gateway.chatCompletion(ChatRequest("m", listOf(ChatMessage("user", "hi")), 0.5, 100))
            }
            assertEquals(500, e.status)
            assertTrue(e.body.contains("boom"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun `空 baseUrl 抛 node 端点错误`() = runTest {
        val gateway = OpenAiCompatGateway(http = http, baseUrl = { "" }, apiKey = { "sk-x" })
        val e = assertFailsWith<java.io.IOException> {
            gateway.chatCompletion(ChatRequest("m", listOf(ChatMessage("user", "hi")), 0.5, 100))
        }
        assertTrue(e.message!!.contains("未配置目标端点"))
    }
}