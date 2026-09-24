package com.aicard.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aicard.app.AppViewModel
import com.aicard.data.AppSettings
import com.aicard.data.ImageProviderId
import com.aicard.data.ImageSettings
import com.aicard.data.KeySlot
import com.aicard.data.ProxySettings
import com.aicard.data.TextSettings
import com.aicard.data.maskKey

@Composable
fun SettingsScreen(
    viewModel: AppViewModel,
    modifier: Modifier = Modifier,
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val keyMasks = remember(settings) { viewModel.keyMasks() }

    var text by remember(settings) { mutableStateOf(settings.text) }
    var image by remember(settings) { mutableStateOf(settings.image) }
    var proxy by remember(settings) { mutableStateOf(settings.proxy) }
    var mock by remember(settings) { mutableStateOf(settings.mock) }
    var keyDrafts by remember(settings) { mutableStateOf(KeySlot.entries.associate { it to "" }) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("设置", style = MaterialTheme.typography.headlineMedium)
            Text(
                "模型、密钥与端点，保存后生效",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // ===== 文本模型 =====
        SectionCard("文本模型（生成 A）", Icons.Filled.AutoAwesome) {
            OutlinedTextField(
                value = text.model,
                onValueChange = { text = text.copy(model = it) },
                label = { Text("模型名") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedTextField(
                value = text.temperature.toString(),
                onValueChange = { text = text.copy(temperature = it.toDoubleOrNull() ?: text.temperature) },
                label = { Text("温度") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedTextField(
                value = text.checkModel,
                onValueChange = { text = text.copy(checkModel = it) },
                label = { Text("质检模型（B，留空回退 A）") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedTextField(
                value = text.extractModel,
                onValueChange = { text = text.copy(extractModel = it) },
                label = { Text("提取模型（留空回退 A）") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
        }

        // ===== 生图模型 =====
        SectionCard("生图模型", Icons.Filled.Psychology) {
            ImageProviderDropdown(image.providerId) { image = image.copy(providerId = it) }
            OutlinedTextField(
                value = image.model,
                onValueChange = { image = image.copy(model = it) },
                label = { Text("生图模型名") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
            SwitchRow(
                title = "prompt_extend",
                support = "让 AI 润色提示词，出图更稳但可能偏离原意",
                checked = image.promptExtend,
                onCheckedChange = { image = image.copy(promptExtend = it) },
            )
            OutlinedTextField(
                value = image.maxRetries.toString(),
                onValueChange = { image = image.copy(maxRetries = it.toIntOrNull() ?: image.maxRetries) },
                label = { Text("最大重试次数") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
        }

        // ===== API Key =====
        SectionCard("API Key", Icons.Filled.Key) {
            KeySlot.entries.forEach { slot ->
                KeyInputField(
                    label = slotLabel(slot),
                    value = keyDrafts[slot] ?: "",
                    onValueChange = { keyDrafts = keyDrafts + (slot to it) },
                    mask = keyMasks[slot] ?: "",
                )
            }
        }

        // ===== 端点 =====
        SectionCard("端点", Icons.Filled.Settings) {
            OutlinedTextField(
                value = proxy.textBaseUrl,
                onValueChange = { proxy = proxy.copy(textBaseUrl = it) },
                label = { Text("文本端点") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedTextField(
                value = proxy.dashBaseUrl,
                onValueChange = { proxy = proxy.copy(dashBaseUrl = it) },
                label = { Text("DashScope 端点") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedTextField(
                value = proxy.checkBaseUrl,
                onValueChange = { proxy = proxy.copy(checkBaseUrl = it) },
                label = { Text("质检端点（留空回退文本端点）") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedTextField(
                value = proxy.sensenovaBaseUrl,
                onValueChange = { proxy = proxy.copy(sensenovaBaseUrl = it) },
                label = { Text("SenseNova 端点") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
            )
        }

        // ===== Mock =====
        SectionCard("开发选项", Icons.Filled.Visibility) {
            SwitchRow(
                title = "Mock 模式",
                support = "用占位内容跑通全流程，不发任何网络请求",
                checked = mock,
                onCheckedChange = { mock = it },
            )
        }

        // ===== 保存 =====
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Button(
                onClick = {
                    viewModel.saveSettings(
                        AppSettings(
                            mock = mock,
                            text = text,
                            image = image,
                            proxy = proxy,
                        ),
                    )
                    keyDrafts.forEach { (slot, v) -> if (v.isNotEmpty()) viewModel.saveKey(slot, v) }
                    keyDrafts = KeySlot.entries.associate { it to "" }
                },
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp),
                shape = MaterialTheme.shapes.large,
            ) {
                Text("保存设置", style = MaterialTheme.typography.titleSmall)
            }

            TextButton(
                onClick = {
                    viewModel.resetSettings()
                    text = TextSettings()
                    image = ImageSettings()
                    proxy = ProxySettings()
                    mock = false
                    keyDrafts = KeySlot.entries.associate { it to "" }
                },
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp),
                shape = MaterialTheme.shapes.large,
            ) {
                Text("恢复默认", style = MaterialTheme.typography.titleSmall)
            }
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = MaterialTheme.shapes.large,
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier
                        .width(4.dp)
                        .height(18.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(2.dp))
                )
                Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                Text(title, style = MaterialTheme.typography.titleMedium)
            }
            content()
        }
    }
}

@Composable
private fun SwitchRow(title: String, support: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(
                support,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun KeyInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    mask: String,
) {
    var show by remember { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
            visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                if (mask.isNotEmpty()) {
                    TextButton(onClick = { show = !show }) {
                        Icon(
                            if (show) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = if (show) "隐藏" else "显示已有 Key",
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            },
        )
        if (mask.isNotEmpty()) {
            Text("当前：$mask", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun ImageProviderDropdown(selected: ImageProviderId, onSelect: (ImageProviderId) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
        OutlinedTextField(
            value = if (selected == ImageProviderId.QWEN) "通义千问 Qwen" else "商汤 SenseNova",
            onValueChange = {},
            readOnly = true,
            label = { Text("生图服务商") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text("通义千问 Qwen") }, onClick = { onSelect(ImageProviderId.QWEN); expanded = false })
            DropdownMenuItem(text = { Text("商汤 SenseNova") }, onClick = { onSelect(ImageProviderId.SENSENOVA); expanded = false })
        }
    }
}

private fun slotLabel(slot: KeySlot): String = when (slot) {
    KeySlot.AGNES -> "Agnes API Key（文本生成 A）"
    KeySlot.DASHSCOPE -> "DashScope API Key（生图）"
    KeySlot.CHECK -> "Check API Key（质检 B，留空回退 Agnes）"
    KeySlot.SENSENOVA -> "SenseNova API Key（商汤生图）"
}
