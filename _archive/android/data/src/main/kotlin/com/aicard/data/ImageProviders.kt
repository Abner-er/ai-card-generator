package com.aicard.data

// 对应 src/blocks/imageProvider.ts —— 统一图像生成 Provider
//
// 与 Web 端的唯一形态差异：TS 把一切收敛成 data URL 字符串（浏览器 img src 用），
// Android 侧无 CORS，直接返回字节 GeneratedImage(bytes, mimeType)——
// /ai-image-proxy「远程图转 base64」那一跳被删掉，改为直接下载 URL 字节。
// 其余（请求体形状、429 退避、Key 错误不重试、extractImage 三种响应形态、mock 卡 SVG）逐分支镜像。

import com.aicard.domain.Ratio
import com.aicard.domain.trimTitle
import java.io.IOException
import java.util.Base64
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
private val jsonParser = Json { ignoreUnknownKeys = true }

/** 一张生成完成的图 */
data class GeneratedImage(
    val bytes: ByteArray,
    val mimeType: String,
    /** 远端原始 URL（若图来自 URL 下载）；便于上层展示「原图链接」或重新解码 */
    val sourceUrl: String? = null,
)

/** Mock 模式下要画进占位卡的文字（对应 TS mockText） */
data class MockCardText(
    val title: String? = null,
    val body: String? = null,
    val bullets: List<String>? = null,
)

data class GenerateImageOptions(
    /** 宽高比（决定生图尺寸） */
    val ratio: Ratio,
    /** 覆盖模型名 */
    val model: String? = null,
    /** 锚点参考图字节：发给模型时编码为 data URL 做 I2I，保证同系列配色/画风一致 */
    val refImage: ByteArray? = null,
    /** 参考图 MIME（编码 data URL 用），默认 image/png */
    val refImageMime: String = "image/png",
    /** 强制 Mock */
    val mock: Boolean? = null,
    val mockText: MockCardText? = null,
    val onProgress: ((String) -> Unit)? = null,
)

interface ImageProvider {
    val id: String
    val label: String

    /** 生成一张完整图文卡 */
    suspend fun generate(prompt: String, opts: GenerateImageOptions): GeneratedImage
}

/** ratio → DashScope size（总像素控制在 512²~2048²，且严格匹配比例） */
private val RATIO_SIZE: Map<Ratio, String> = mapOf(
    Ratio.R1X1 to "1024*1024",
    Ratio.R3X4 to "1152*1536",
    Ratio.R4X3 to "1536*1152",
    Ratio.R9X16 to "864*1536",
    Ratio.R16X9 to "1536*864",
    Ratio.R2X3 to "1024*1536",
    Ratio.R3X2 to "1536*1024",
)

fun ratioToSize(r: Ratio): String = RATIO_SIZE[r] ?: "1024*1024"

/** SenseNova 用 OpenAI 兼容的 x 分隔尺寸，DashScope 用 * 分隔 */
internal fun toSensenovaSize(r: Ratio): String = ratioToSize(r).replace("*", "x")

/** ratio → Mock SVG 像素尺寸（仅控制占位卡比例） */
private val RATIO_DIM: Map<Ratio, Pair<Int, Int>> = mapOf(
    Ratio.R1X1 to (1024 to 1024),
    Ratio.R3X4 to (864 to 1152),
    Ratio.R4X3 to (1152 to 864),
    Ratio.R9X16 to (736 to 1312),
    Ratio.R16X9 to (1312 to 736),
    Ratio.R2X3 to (832 to 1248),
    Ratio.R3X2 to (1248 to 832),
)

/** 从 DashScope 响应里抠出图片（兼容 base64 / http url / image-synthesis 的 results[].url） */
internal fun extractImage(root: kotlinx.serialization.json.JsonElement?): String? {
    root as? JsonObject ?: return null
    val output = root["output"] as? JsonObject ?: return null
    // 1) multimodal-generation/generation：output.choices[0].message.content[] 里找 image
    val choices = output["choices"]?.jsonArrayOrNull()
    val firstMessage = choices?.getOrNull(0)?.jsonObjectOrNull()?.get("message") as? JsonObject
    val content = firstMessage?.get("content")
    if (content is JsonArray) {
        for (part in content) {
            val obj = part as? JsonObject ?: continue
            (obj["image"] as? JsonPrimitive)?.takeIf { it.isString }?.let { return it.content }
            (obj["image_url"] as? JsonPrimitive)?.takeIf { it.isString }?.let { return it.content }
        }
    }
    // 2) image-synthesis 异步风格：output.results[0].url
    val results = output["results"] as? JsonArray
    val url = (results?.getOrNull(0) as? JsonObject)?.get("url") as? JsonPrimitive
    if (url != null && url.isString) return url.content
    // 3) 兜底：choices 文本里揪出图片链接
    val txt = (firstMessage?.get("content") as? JsonPrimitive)?.content
    if (txt != null) {
        Regex("""https?://\S+\.(?:png|jpe?g|webp)""", RegexOption.IGNORE_CASE)
            .find(txt)?.let { return it.value }
    }
    return null
}

private fun kotlinx.serialization.json.JsonElement?.jsonArrayOrNull(): JsonArray? = this as? JsonArray
private fun kotlinx.serialization.json.JsonElement?.jsonObjectOrNull(): JsonObject? = this as? JsonObject

/**
 * 生图调用共用的重试循环骨架——逐分支镜像 TS：
 *  - 429 → retryBackoffMs 长退避（DashScope RPM 较低），超上限抛「限流」
 *  - 401/403 → 直接抛 Key 错误（消息含「Key」，靠重试判据跳出）
 *  - 其它非 2xx → 「生图失败: status + body 前 200 字」
 *  - 其它异常 → 3s 短退避重试；Key/限流/超上限不再盲目重试
 */
internal suspend fun runGenerateRetry(
    maxRetries: Int,
    attemptBody: suspend (attempt: Int) -> GeneratedImage,
): GeneratedImage {
    var attempt = 0
    var lastErr: Throwable? = null
    while (attempt <= maxRetries) {
        try {
            return attemptBody(attempt)
        } catch (e: Exception) {
            lastErr = e
            if (e is RateLimitRetry) {
                // 429 且未超上限：长退避已在 attemptBody 内完成，等价 TS 的 continue，不再叠加 3s 短退避
                attempt++
                continue
            }
            val msg = e.message ?: e.toString()
            // Key 错误 / 限流不再盲目重试
            if (msg.contains("Key") || msg.contains("限流") || attempt >= maxRetries) break
            delay(3000)
        }
        attempt++
    }
    throw lastErr ?: IOException("生图失败")
}

internal fun progressLabel(first: String, attempt: Int): String =
    if (attempt == 0) first else "重试生成 (${attempt + 1})…"

/** raw（data url / http url / 裸 base64）统一成图片字节 */
internal suspend fun resolveImage(
    http: OkHttpClient,
    raw: String,
): GeneratedImage {
    if (raw.startsWith("data:")) {
        val comma = raw.indexOf("base64,")
        val mime = raw.substringAfter("data:").substringBefore(";", "image/png")
        val payload = if (comma >= 0) raw.substring(comma + "base64,".length) else raw.substringAfter(",")
        return GeneratedImage(Base64.getDecoder().decode(payload), mime)
    }
    if (raw.startsWith("http")) {
        // TS 走 /ai-image-proxy 转 base64（绕 CORS）；Android 直连下载即可。
        // TS 代理失败会回退原始 URL 字符串，这里下载失败就是失败——抛错交给重试循环/UI。
        val req = Request.Builder().url(raw).get().build()
        http.newCall(req).awaitResponse().use { r ->
            if (!r.isSuccessful) throw IOException("图片下载失败: ${r.code}")
            val bytes = r.body?.bytes() ?: throw IOException("图片下载失败: 空响应体")
            val mime = r.header("Content-Type")?.substringBefore(";") ?: "image/png"
            return GeneratedImage(bytes, mime, sourceUrl = raw)
        }
    }
    // 裸 base64
    val payload = if (raw.contains("base64,")) raw.substringAfter("base64,") else raw
    return GeneratedImage(Base64.getDecoder().decode(payload), "image/png")
}

internal fun refImageDataUrl(opts: GenerateImageOptions): String? =
    opts.refImage?.let { "data:${opts.refImageMime};base64,${Base64.getEncoder().encodeToString(it)}" }

// ============ QwenImageProvider ============

class QwenImageProvider(
    private val http: OkHttpClient,
    private val baseUrl: () -> String,
    private val apiKey: () -> String,
    private val config: () -> ImageSettings,
    private val isMock: () -> Boolean,
) : ImageProvider {
    override val id = "qwen"
    override val label = "通义千问 Qwen-Image-3"

    override suspend fun generate(prompt: String, opts: GenerateImageOptions): GeneratedImage {
        if (opts.mock == true || isMock()) {
            return mockCard(opts.ratio, opts.mockText)
        }

        val cfg = config()
        val size = ratioToSize(opts.ratio)
        val content = buildJsonArray {
            add(buildJsonObject { put("text", JsonPrimitive(prompt)) })
            refImageDataUrl(opts)?.let { add(buildJsonObject { put("image", JsonPrimitive(it)) }) }
        }
        val body = buildJsonObject {
            put("model", JsonPrimitive(opts.model ?: cfg.model))
            put(
                "input",
                buildJsonObject {
                    put(
                        "messages",
                        buildJsonArray {
                            add(
                                buildJsonObject {
                                    put("role", JsonPrimitive("user"))
                                    put("content", content)
                                }
                            )
                        }
                    )
                }
            )
            put(
                "parameters",
                buildJsonObject {
                    put("prompt_extend", JsonPrimitive(cfg.promptExtend))
                    put("size", JsonPrimitive(size))
                }
            )
        }

        return runGenerateRetry(cfg.maxRetries) { attempt ->
            opts.onProgress?.invoke(progressLabel("正在生图…", attempt))
            val req = Request.Builder()
                .url(baseUrl().trimEnd('/') + "/services/aigc/multimodal-generation/generation")
                .post(body.toString().toRequestBody(JSON_MEDIA))
                .header("X-DashScope-Async", "disable")
                .apply {
                    val key = apiKey()
                    if (placeholderOk(key)) header("Authorization", "Bearer $key")
                }
                .build()
            http.newCall(req).awaitResponse().use { r ->
                when {
                    r.code == 429 -> {
                        if (attempt < cfg.maxRetries) {
                            delay(cfg.retryBackoffMs)
                            throw RateLimitRetry()
                        }
                        throw IOException("Qwen 限流，请稍后重试")
                    }
                    r.code == 401 || r.code == 403 ->
                        throw IOException("DashScope API Key 无效或未配置（请在 后台管理 ⚙ 中配置生图 Key）")
                    !r.isSuccessful ->
                        throw IOException("生图失败: ${r.code} ${r.body?.string().orEmpty().take(200)}")
                }
                val text = r.body?.string().orEmpty()
                val raw = extractImage(jsonParser.parseToJsonElement(text))
                    ?: throw IOException("生图返回异常: ${text.take(200)}")
                resolveImage(http, raw)
            }
        }
    }
}

// ============ SensenovaImageProvider ============

/**
 * 商汤 SenseNova U1.5 Lite（OpenAI 兼容接口）：
 *  - 文生图：POST /images/generations
 *  - 参考图编辑（I2I）：POST /images/edits，images[0].image_url 支持 data URL
 * 响应 data[0].b64_json / data[0].url；watermark=false 公测免费无水印。
 */
class SensenovaImageProvider(
    private val http: OkHttpClient,
    private val baseUrl: () -> String,
    private val apiKey: () -> String,
    private val config: () -> ImageSettings,
    private val isMock: () -> Boolean,
) : ImageProvider {
    override val id = "sensenova"
    override val label = "商汤 SenseNova U1.5 Lite"

    override suspend fun generate(prompt: String, opts: GenerateImageOptions): GeneratedImage {
        if (opts.mock == true || isMock()) {
            return mockCard(opts.ratio, opts.mockText)
        }

        val cfg = config()
        val ref = refImageDataUrl(opts)
        val useEdits = ref != null
        val body = buildJsonObject {
            put("model", JsonPrimitive(opts.model ?: cfg.model))
            put("prompt", JsonPrimitive(prompt))
            put("n", JsonPrimitive(1))
            put("size", JsonPrimitive(toSensenovaSize(opts.ratio)))
            put("watermark", JsonPrimitive(false))
            put("prompt_extend", JsonPrimitive(cfg.promptExtend))
            put("response_format", JsonPrimitive("b64_json"))
            if (useEdits) {
                put(
                    "images",
                    buildJsonArray {
                        add(buildJsonObject { put("image_url", JsonPrimitive(ref)) })
                    }
                )
            }
        }
        val path = if (useEdits) "/images/edits" else "/images/generations"

        return runGenerateRetry(cfg.maxRetries) { attempt ->
            opts.onProgress?.invoke(progressLabel("正在生图（SenseNova）…", attempt))
            val req = Request.Builder()
                .url(baseUrl().trimEnd('/') + path)
                .post(body.toString().toRequestBody(JSON_MEDIA))
                .apply {
                    val key = apiKey()
                    if (placeholderOk(key)) header("Authorization", "Bearer $key")
                }
                .build()
            http.newCall(req).awaitResponse().use { r ->
                when {
                    r.code == 429 -> {
                        if (attempt < cfg.maxRetries) {
                            delay(cfg.retryBackoffMs)
                            throw RateLimitRetry()
                        }
                        throw IOException("SenseNova 限流，请稍后重试")
                    }
                    r.code == 401 || r.code == 403 ->
                        throw IOException("SenseNova API Key 无效或未配置（请在 后台管理 ⚙ 中配置生图 Key）")
                    !r.isSuccessful ->
                        throw IOException("生图失败: ${r.code} ${r.body?.string().orEmpty().take(200)}")
                }
                val text = r.body?.string().orEmpty()
                val dataArr = (jsonParser.parseToJsonElement(text) as? JsonObject)?.get("data") as? JsonArray
                val first = dataArr?.getOrNull(0) as? JsonObject
                val raw = ((first?.get("b64_json") ?: first?.get("url")) as? JsonPrimitive)?.content
                    ?: throw IOException("生图返回异常: ${text.take(200)}")
                resolveImage(http, raw)
            }
        }
    }
}

// ============ MockImageProvider ============

class MockImageProvider : ImageProvider {
    override val id = "mock"
    override val label = "占位预览 (Mock)"

    override suspend fun generate(prompt: String, opts: GenerateImageOptions): GeneratedImage =
        mockCard(opts.ratio, opts.mockText)
}

/**
 * 画一张占位卡：把标题/正文画进 SVG，方便无 key 时预览版式与流程。
 * 返回 image/svg+xml 字节；:app 侧用 SVG decoder（Coil ImageDecoderDrawable）或降级为文本占位渲染。
 */
internal fun mockCard(ratio: Ratio, text: MockCardText?): GeneratedImage {
    val (rw, rh) = RATIO_DIM[ratio] ?: (1024 to 1024)
    val cx = rw / 2.0
    val title = trimTitle(text?.title ?: "图文卡", "图文卡", 16)
    val body = (text?.body ?: "").take(40)

    val svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"$rw\" height=\"$rh\" viewBox=\"0 0 $rw $rh\">\n" +
        "    <defs>\n" +
        "      <linearGradient id=\"bg\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n" +
        "        <stop offset=\"0%\" stop-color=\"#fbf7ef\"/>\n" +
        "        <stop offset=\"100%\" stop-color=\"#f1e7d6\"/>\n" +
        "      </linearGradient>\n" +
        "    </defs>\n" +
        "    <rect width=\"$rw\" height=\"$rh\" fill=\"url(#bg)\"/>\n" +
        "    <rect x=\"${rw * 0.06}\" y=\"${rh * 0.06}\" width=\"${rw * 0.88}\" height=\"${rh * 0.88}\" rx=\"24\" fill=\"#ffffff\" stroke=\"#d8c4a4\" stroke-width=\"2\" opacity=\"0.9\"/>\n" +
        "    <g transform=\"translate($cx ${rh * 0.36})\">\n" +
        "      <circle r=\"${minOf(rw, rh) * 0.16}\" fill=\"#f3d9a8\" stroke=\"#c97b3c\" stroke-width=\"6\"/>\n" +
        "      <circle r=\"${minOf(rw, rh) * 0.09}\" fill=\"#e8b04e\"/>\n" +
        "    </g>\n" +
        "    <text x=\"$cx\" y=\"${rh * 0.62}\" text-anchor=\"middle\" font-size=\"${maxOf(28, rw / 14)}\" font-weight=\"800\" fill=\"#5a3a2a\" font-family=\"sans-serif\">${escapeXml(title)}</text>\n" +
        "    <text x=\"$cx\" y=\"${rh * 0.7}\" text-anchor=\"middle\" font-size=\"${maxOf(18, rw / 22)}\" fill=\"#7a5a4a\" font-family=\"sans-serif\">${escapeXml(body)}</text>\n" +
        "    <text x=\"${rw - 40}\" y=\"${rh - 24}\" text-anchor=\"end\" font-size=\"${maxOf(20, rw / 22)}\" fill=\"#b08040\" opacity=\"0.6\" font-family=\"sans-serif\">MOCK · Qwen</text>\n" +
        "  </svg>"
    return GeneratedImage(svg.toByteArray(Charsets.UTF_8), "image/svg+xml")
}

internal fun escapeXml(s: String): String = s
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace("\"", "&quot;")
    .replace("'", "&apos;")

// ============ 注册表 ============

/** 按运行时配置/开关解析当前 Provider（对应 getImageProvider） */
fun resolveImageProvider(
    settings: AppSettings,
    keys: (KeySlot) -> String,
    http: OkHttpClient,
    forceMock: Boolean = false,
): ImageProvider {
    val useMock = forceMock || settings.mock
    if (useMock) return MockImageProvider()
    return when (settings.image.providerId) {
        ImageProviderId.SENSENOVA -> SensenovaImageProvider(
            http,
            { settings.proxy.sensenovaBaseUrl },
            { keys(KeySlot.SENSENOVA) },
            { settings.image },
            { settings.mock },
        )
        ImageProviderId.QWEN -> QwenImageProvider(
            http,
            { settings.proxy.dashBaseUrl },
            { keys(KeySlot.DASHSCOPE) },
            { settings.image },
            { settings.mock },
        )
    }
}

/** 429 且未超上限时的「退避后重试」信号——仅用于跳出 attemptBody 回到外层循环 */
internal class RateLimitRetry : Exception("429-retry")
