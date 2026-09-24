package com.aicard.app.ui.input

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aicard.app.AppViewModel
import com.aicard.domain.StylePreset

private const val INPUT_TEXT = 0
private const val INPUT_URL = 1

private fun hexColor(hex: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(hex))
}.getOrDefault(Color.Unspecified)

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun InputScreen(
    viewModel: AppViewModel,
    modifier: Modifier = Modifier,
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    var mode by rememberSaveable { mutableIntStateOf(INPUT_TEXT) }
    var urlText by rememberSaveable { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 28.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        // Hero：大字标题建立品牌锚点，副标题点明用途
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "知识卡片工坊",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                "把一段知识，变成成套的图文卡片提示词",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // 输入分区
        SectionCard(title = "输入知识内容") {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                SegmentedButton(
                    selected = mode == INPUT_TEXT,
                    onClick = { mode = INPUT_TEXT },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                ) { Text("手动输入") }
                SegmentedButton(
                    selected = mode == INPUT_URL,
                    onClick = { mode = INPUT_URL },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                ) { Text("URL 提取") }
            }

            when (mode) {
                INPUT_TEXT -> {
                    OutlinedTextField(
                        value = viewModel.inputText,
                        onValueChange = { viewModel.updateInput(it) },
                        label = { Text("输入主题或知识文本") },
                        placeholder = { Text("例如：光合作用、Redis 持久化、意式浓缩…") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 160.dp, max = 320.dp),
                        maxLines = 10,
                        shape = MaterialTheme.shapes.medium,
                    )
                }
                INPUT_URL -> {
                    OutlinedTextField(
                        value = urlText,
                        onValueChange = { urlText = it },
                        label = { Text("粘贴文章 URL（微信公众号等）") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = MaterialTheme.shapes.medium,
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { viewModel.extractFromUrl(urlText) },
                        enabled = urlText.isNotBlank() && !viewModel.isExtracting,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (viewModel.isExtracting) {
                            CircularProgressIndicator(
                                modifier = Modifier.widthIn(max = 18.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("正在提取…")
                        } else {
                            Text("提取正文")
                        }
                    }
                    viewModel.extractError?.let { err ->
                        Spacer(Modifier.height(8.dp))
                        Text(err, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    if (viewModel.inputText.isNotBlank()) {
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = viewModel.inputText,
                            onValueChange = { viewModel.updateInput(it) },
                            label = { Text("提取结果（可编辑）") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 120.dp, max = 280.dp),
                            maxLines = 8,
                            shape = MaterialTheme.shapes.medium,
                        )
                    }
                }
            }
        }

        // 风格分区
        SectionCard(title = "视觉风格") {
            val presets = viewModel.stylePresets()
            val rec = viewModel.styleRecommendation
            val userOverride = rec != null && viewModel.selectedPresetId != rec.presetId

            if (rec != null) {
                val recPreset = presets.find { it.id == rec.presetId }
                Surface(
                    color = if (userOverride) MaterialTheme.colorScheme.surfaceContainerHighest
                        else MaterialTheme.colorScheme.primaryContainer,
                    contentColor = if (userOverride) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onPrimaryContainer,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(
                                    if (userOverride) MaterialTheme.colorScheme.surfaceVariant
                                        else MaterialTheme.colorScheme.surface.copy(alpha = 0.35f),
                                    CircleShape,
                                ),
                            contentAlignment = Alignment.Center,
                        ) { Text("✨", style = MaterialTheme.typography.titleMedium) }
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                "AI 推荐 · ${recPreset?.label ?: rec.presetId}",
                                style = MaterialTheme.typography.titleSmall,
                            )
                            Text(
                                rec.reason,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (userOverride) MaterialTheme.colorScheme.onSurfaceVariant
                                    else MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                            )
                        }
                        if (userOverride) {
                            OutlinedButton(
                                onClick = { viewModel.selectPreset(rec.presetId) },
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                            ) { Text("采用", style = MaterialTheme.typography.labelMedium) }
                        } else {
                            Text(
                                "✓ 已应用",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "风格预设",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "${presets.size} 套",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.tertiary,
                )
            }
            Spacer(Modifier.height(10.dp))

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                presets.forEach { preset ->
                    StylePresetChip(
                        preset = preset,
                        selected = viewModel.selectedPresetId == preset.id,
                        isRecommended = rec?.presetId == preset.id,
                        onClick = { viewModel.selectPreset(preset.id) },
                    )
                }
            }
        }

        Button(
            onClick = { viewModel.generatePrompts() },
            enabled = viewModel.inputText.isNotBlank() && !viewModel.isDecomposing,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = MaterialTheme.shapes.large,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            elevation = null,
        ) {
            if (viewModel.isDecomposing) {
                CircularProgressIndicator(
                    modifier = Modifier.widthIn(max = 22.dp),
                    strokeWidth = 2.5.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
                Spacer(Modifier.width(12.dp))
                Text("正在生成…", style = MaterialTheme.typography.titleSmall)
            } else {
                Text("生成提示词", style = MaterialTheme.typography.titleSmall)
            }
        }

        viewModel.decomposeError?.let { err ->
            Surface(
                color = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(err, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp))
            }
        }

        if (settings.mock) {
            Surface(
                color = MaterialTheme.colorScheme.tertiaryContainer,
                contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Mock 模式已开启 · 生成占位内容，不发网络请求",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(12.dp),
                )
            }
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height(18.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(2.dp)),
                )
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            content()
        }
    }
}

@Composable
private fun StylePresetChip(
    preset: StylePreset,
    selected: Boolean,
    isRecommended: Boolean,
    onClick: () -> Unit,
) {
    val dotColor = hexColor(preset.style.background ?: preset.style.textTheme?.bg ?: "#ffffff")
    FilterChip(
        selected = selected,
        onClick = onClick,
        shape = MaterialTheme.shapes.small,
        leadingIcon = {
            Box(
                modifier = Modifier
                    .size(14.dp)
                    .background(
                        if (dotColor != Color.Unspecified) dotColor else MaterialTheme.colorScheme.surfaceVariant,
                        CircleShape,
                    ),
            )
        },
        label = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(preset.label, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge)
                if (isRecommended) Text("✦", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.tertiary)
            }
        },
    )
}
