package com.aicard.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * API Key 安全存储——直译 Web 端 server 模式的 Key 管理（vite dev server /__settings PUT keys）。
 *
 * Web 端 Key 存在服务端 settings.json，前端只拿到脱敏值；
 * Android 无后端，Key 直接存本机 EncryptedSharedPreferences（Android Keystore 加密）。
 *
 * '__CLEAR__' 语义：TS saveKeys 传 '__CLEAR__' 表示清除该槽位；
 * 这里 save(slot, "__CLEAR__") 等价 remove(slot)。
 */
class SecureKeyStore(context: Context) {

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "aicard_keys",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    /** 读原始 Key（空槽位返回空串） */
    fun get(slot: KeySlot): String = prefs.getString(slot.storageName, "") ?: ""

    /** 写入；value == "__CLEAR__" 清除该槽位（对齐 TS saveKeys 语义） */
    fun save(slot: KeySlot, value: String) {
        val e = prefs.edit()
        if (value == "__CLEAR__") e.remove(slot.storageName)
        else e.putString(slot.storageName, value)
        e.apply()
    }

    /** 批量保存（对齐 TS saveKeys 接口）—— null 表示不动，"__CLEAR__" 清除 */
    fun saveKeys(values: Map<KeySlot, String?>) {
        val e = prefs.edit()
        for ((slot, v) in values) {
            if (v == null) continue
            if (v == "__CLEAR__") e.remove(slot.storageName)
            else e.putString(slot.storageName, v)
        }
        e.apply()
    }

    /** 脱敏视图（前端展示用）——复用 maskKey */
    fun masked(slot: KeySlot): String = maskKey(get(slot))

    /** 全部槽位脱敏快照 */
    fun maskedSnapshot(): Map<KeySlot, String> = KeySlot.values().associateWith { masked(it) }

    /** 清除全部 Key */
    fun clearAll() {
        prefs.edit().clear().apply()
    }
}
