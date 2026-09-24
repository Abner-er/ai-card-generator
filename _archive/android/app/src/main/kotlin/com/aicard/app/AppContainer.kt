package com.aicard.app

import android.content.Context
import com.aicard.data.SecureKeyStore
import com.aicard.data.SettingsStore
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class AppContainer(context: Context) {
    val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    val settingsStore: SettingsStore by lazy { SettingsStore(context.applicationContext) }
    val keyStore: SecureKeyStore by lazy { SecureKeyStore(context.applicationContext) }
}
