package com.aicard.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json

/**
 * 设置持久化——直译 settings.ts 的 localStorage 子集（L90 LS_KEY / persistable / loadFromLocalStorage / saveToLocalStorage / resetSettings local 分支）。
 *
 * Web 端可持久化子集是 { mock, text, image, study, quiz }，端点放服务端，local 模式禁用端点管理；
 * Android 无服务端，直接把整档 AppSettings（含 proxy）作为一份 JSON 存 DataStore，Key 仍走 SecureKeyStore。
 *
 * 与 TS 的差异：
 * - 单键存整档 JSON（TS 也存 JSON 字符串，等价）；旧版本兼容用默认字段值兜底。
 * - reset() 等价 TS resetSettings 的 local 分支（清 localStorage → 恢复 ENV_DEFAULTS）；
 *   TS server 分支（服务端重置）不存在。
 */
class SettingsStore(private val context: Context) {

    private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "aicard_settings")

    private val json = Json { ignoreUnknownKeys = true }

    private val key = stringPreferencesKey("settings_json")

    /** 当前设置流；首次读取为 ENV_DEFAULTS */
    val settings: Flow<AppSettings> = context.dataStore.data.map { prefs ->
        val raw = prefs[key]
        if (raw.isNullOrEmpty()) AppSettings()
        else runCatching { json.decodeFromString<AppSettings>(raw) }.getOrElse { AppSettings() }
    }

    /** 整档保存（类型化 copy 替代 TS deepMerge untyped patch） */
    suspend fun save(updated: AppSettings) {
        context.dataStore.edit { it[key] = json.encodeToString(AppSettings.serializer(), updated) }
    }

    /** 部分更新：传字段级 patch，保留其余字段——替代 TS saveSettings(partial) */
    suspend fun update(
        mock: Boolean? = null,
        text: TextSettings? = null,
        image: ImageSettings? = null,
        proxy: ProxySettings? = null,
    ) {
        val current = settings.first()
        save(
            current.copy(
                mock = mock ?: current.mock,
                text = text ?: current.text,
                image = image ?: current.image,
                proxy = proxy ?: current.proxy,
            )
        )
    }

    /** 恢复默认（等价 TS resetSettings local 分支 + ENV_DEFAULTS） */
    suspend fun reset() = save(AppSettings())
}