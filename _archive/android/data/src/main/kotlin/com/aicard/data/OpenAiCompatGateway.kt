package com.aicard.data

// 对应 vite.config.ts 的 /ai-api 与 /ai-check-api 网关 + src/blocks/decompose.ts 的 fetch 语义。
//
// Web 端 fetch('/ai-api/chat/completions') 由 vite 中间件转发并注入 Authorization；
// Android 无 CORS，直连 {textBaseUrl}/chat/completions 并自带头部——
// forward() 里的三条规则原样保留：
//  1. baseUrl 尾部斜杠剥掉再拼路径
//  2. Content-Type: application/json
//  3. 仅当 key 通过 placeholderOk 才附 Authorization（无效 key 宁可不带，让上游返回鉴权错误）

import com.aicard.domain.ChatRequest
import com.aicard.domain.HttpFailure
import com.aicard.domain.TextLlmGateway
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

private val jsonParser = Json { ignoreUnknownKeys = true }

/**
 * OpenAI 兼容 /chat/completions 直连实现（Agnes 与 B 质检模型共用，端点/Key 由构造方决定）。
 * baseUrl/key 用 supplier 传入：对应 TS「模型/端点/key 改了立即生效，无需重启」的动态读取。
 */
class OpenAiCompatGateway(
    private val http: OkHttpClient,
    private val baseUrl: () -> String,
    private val apiKey: () -> String,
) : TextLlmGateway {

    override suspend fun chatCompletion(request: ChatRequest): String = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("model", JsonPrimitive(request.model))
            put(
                "messages",
                buildJsonArray {
                    request.messages.forEach { m ->
                        add(
                            buildJsonObject {
                                put("role", JsonPrimitive(m.role))
                                put("content", JsonPrimitive(m.content))
                            }
                        )
                    }
                }
            )
            put("temperature", JsonPrimitive(request.temperature))
            // 字段名必须是 max_tokens（wire 契约，:domain 测试钉死 8000 的场景由这里发出）
            put("max_tokens", JsonPrimitive(request.maxTokens))
        }

        val cleanBase = baseUrl().trimEnd('/')
        if (cleanBase.isEmpty()) throw IOException("未配置目标端点（检查后台管理 → 端点设置）")

        val req = Request.Builder()
            .url("$cleanBase/chat/completions")
            .post(payload.toString().toRequestBody(JSON_MEDIA))
            .apply {
                val key = apiKey()
                if (placeholderOk(key)) header("Authorization", "Bearer $key")
            }
            .build()

        val resp = http.newCall(req).awaitResponse()
        resp.use { r ->
            val bodyText = r.body?.string().orEmpty()
            if (!r.isSuccessful) throw HttpFailure(r.code, bodyText)
            // TS: data?.choices?.[0]?.message?.content ?? ''
            return@use extractContent(jsonParser.parseToJsonElement(bodyText))
        }
    }

    private fun extractContent(root: kotlinx.serialization.json.JsonElement): String {
        val choices = (root as? JsonObject)?.get("choices") as? JsonArray ?: return ""
        val first = choices.getOrNull(0) as? JsonObject ?: return ""
        val message = first["message"] as? JsonObject ?: return ""
        return (message["content"] as? JsonPrimitive)?.content ?: ""
    }
}

/**
 * B 模型（质检）网关端点/Key 协商——对应 vite.config.ts /ai-check-api 的转发规则：
 * 配了独立端点/Key 就走独立的，否则回退 A 端点。
 */
fun checkGatewayPlan(settings: AppSettings, keys: (KeySlot) -> String): Pair<String, String> {
    val base = settings.proxy.checkBaseUrl.ifBlank { settings.proxy.textBaseUrl }
    val key = keys(KeySlot.CHECK).ifBlank { keys(KeySlot.AGNES) }
    return base to key
}

/** 模型名协商：checkModel 留空回退 model（对应 selfCheck.ts 的 `text.checkModel.trim() || text.model`） */
fun checkModelName(settings: AppSettings): String =
    settings.text.checkModel.trim().ifEmpty { settings.text.model }

/** 提取模型名协商：extractModel 留空回退 model（对应 settings.ts ENV_DEFAULTS 注释语义） */
fun extractModelName(settings: AppSettings): String =
    settings.text.extractModel.trim().ifEmpty { settings.text.model }

/** okhttp Call → suspend（可取消）；对应 fetch 的 abort 语义 */
internal suspend fun Call.awaitResponse(): Response = suspendCancellableCoroutine { cont ->
    enqueue(
        object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (!cont.isCancelled) cont.resumeWithException(e)
            }

            override fun onResponse(call: Call, response: Response) {
                cont.resume(response)
            }
        }
    )
    cont.invokeOnCancellation { cancel() }
}
