package com.aicard.data

// 对应 src/blocks/settings.ts 的数据形状（ENV_DEFAULTS + ProxySettings 默认值 + maskKey/PLACEHOLDER_OK）。
//
// Web 端差异说明：
// - server/local 双模式（/__settings API + localStorage）不复存在——Android 上只有一套：
//   DataStore 持久化 AppSettings（见 SettingsStore），Key 走 EncryptedSharedPreferences（见 SecureKeyStore）。
// - study/quiz 段按「学习另立 App」的切割方案不迁移。
// - TS 的 deepMerge(partial JSON patch) 不直译：Kotlin 侧类型化 copy/整档写入即可，无 untyped patch 合并需求。

import kotlinx.serialization.Serializable

/** 生图服务商：qwen=通义千问 / sensenova=商汤（对应 TS ImageSettings.providerId） */
@Serializable
enum class ImageProviderId(val raw: String) {
    QWEN("qwen"),
    SENSENOVA("sensenova");

    companion object {
        fun fromRaw(v: String?): ImageProviderId? = entries.firstOrNull { it.raw == v }
    }
}

@Serializable
data class TextSettings(
    val model: String = "agnes-2.5-flash",
    /** 质检模型（B 模型）：留空 = 回退到 model。用不同家族的模型可规避自我偏好偏差 */
    val checkModel: String = "",
    /** 内容提取模型：留空 = 回退到 model */
    val extractModel: String = "",
    val temperature: Double = 0.6,
    val selfCheckTemperature: Double = 0.0,
    val extractTemperature: Double = 0.3,
)

@Serializable
data class ImageSettings(
    val providerId: ImageProviderId = ImageProviderId.QWEN,
    val model: String = "qwen-image-3.0",
    val promptExtend: Boolean = true,
    val maxRetries: Int = 3,
    val retryBackoffMs: Long = 20000,
)

@Serializable
data class ProxySettings(
    val textBaseUrl: String = "https://api.agnes-ai.cn/v1",
    val dashBaseUrl: String = "https://dashscope.aliyuncs.com",
    /** 质检模型（B）独立端点：留空 = 回退 textBaseUrl */
    val checkBaseUrl: String = "",
    /** 商汤 SenseNova 生图端点 */
    val sensenovaBaseUrl: String = "https://token.sensenova.cn/v1",
)

@Serializable
data class AppSettings(
    val mock: Boolean = false,
    val text: TextSettings = TextSettings(),
    val image: ImageSettings = ImageSettings(),
    val proxy: ProxySettings = ProxySettings(),
)

/** 对应 vite.config.ts / settings.ts 的 PLACEHOLDER_OK：空串或含占位符的 key 视为未配置 */
fun placeholderOk(v: String?): Boolean =
    !v.isNullOrEmpty() && !v.contains("your-api-key-here")

/** 对应 vite.config.ts maskKey：≤10 位全打点，否则前6…后3 */
fun maskKey(k: String?): String {
    if (!placeholderOk(k)) return ""
    val v = k!!
    if (v.length <= 10) return "•••"
    return v.take(6) + "…" + v.takeLast(3)
}

/** Key 槽位（对应 cfg.keys 的四字段） */
enum class KeySlot(val storageName: String) {
    AGNES("agnes"),
    DASHSCOPE("dashscope"),
    CHECK("check"),
    SENSENOVA("sensenova"),
}
