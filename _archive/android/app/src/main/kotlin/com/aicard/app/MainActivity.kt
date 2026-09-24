package com.aicard.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.aicard.app.ui.nav.AppNav
import com.aicard.app.ui.theme.AiCardTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val container = AppContainer(this)
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            AiCardTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val viewModel = ViewModelProvider(this, AppViewModelFactory(container))[AppViewModel::class.java]
                    AppNav(viewModel)
                }
            }
        }
    }
}

class AppViewModelFactory(private val container: AppContainer) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AppViewModel::class.java)) {
            return AppViewModel(container) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
