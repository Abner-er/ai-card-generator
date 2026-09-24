package com.aicard.app.ui.prompts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.aicard.app.AppViewModel
import com.aicard.data.GeneratedImage
import com.aicard.data.SelfCheckResult
import com.aicard.domain.IssueSeverity
import com.aicard.domain.QualityIssue
import com.aicard.domain.QualityReport
import com.aicard.domain.RiskLabel

@Composable
fun PromptsScreen(
    viewModel: AppViewModel,
    modifier: Modifier = Modifier,
) {
    val result = viewModel.decomposeResult ?: return
    val report = viewModel.qualityReport
    val selfCheck = viewModel.selfCheckResult
    val clipboard = LocalClipboardManager.current

    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                IconButton(onClick = { viewModel.clearResult() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回输入")
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        result.seriesTitle,
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                    )
                    Text(
                        "${result.pages.size} 页 · ${result.modules.size} 个模块",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Icon(
                    Icons.Filled.AutoAwesome,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp),
                )
            }
        }

        item {
            val style = result.seriesStyle
            StyleInfoCard(style = style)
        }

        if (report != null) {
            item {
                QualityPanel(
                    report = report,
                    selfCheck = selfCheck,
                    isSelfChecking = viewModel.isSelfChecking,
                    selfCheckError = viewModel.selfCheckError,
                    adoptedIds = viewModel.adoptedIds,
                    hasUndo = viewModel.adoptedIds.isNotEmpty(),
                    onRunSelfCheck = { viewModel.runSelfCheck() },
                    onAdopt = { viewModel.adoptModule(it) },
                    onAdoptAll = { viewModel.adoptAll() },
                    onUndo = { viewModel.undoAdopt() },
                )
            }
        }

        item {
            AnchorCard(
                prompt = viewModel.anchorPrompt,
                image = viewModel.anchorImage,
                isGenerating = "__anchor__" in viewModel.generatingPages,
                progress = viewModel.imageProgress["__anchor__"],
                error = viewModel.imageErrors["__anchor__"],
                onGenerate = { viewModel.generateAnchorImage() },
                onCopy = { clipboard.setText(AnnotatedString(viewModel.anchorPrompt ?: "")) },
            )
        }

        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    Modifier
                        .width(4.dp)
                        .height(18.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(2.dp))
                )
                Text("页面提示词", style = MaterialTheme.typography.titleMedium)
                Text(
                    "共 ${result.pages.size} 页",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        itemsIndexed(result.pages) { index, page ->
            val modules = page.moduleIds.mapNotNull { id -> result.modules.find { it.id == id } }
            val prompt = viewModel.pagePrompts[page.id] ?: ""
            PagePromptCard(
                pageNumber = index + 1,
                totalPages = result.pages.size,
                title = page.title,
                ratio = page.ratio.raw,
                moduleTitles = modules.joinToString("、") { it.title },
                prompt = prompt,
                image = viewModel.pageImages[page.id],
                isGenerating = page.id in viewModel.generatingPages,
                progress = viewModel.imageProgress[page.id],
                error = viewModel.imageErrors[page.id],
                onGenerate = { viewModel.generateImage(page.id) },
                onCopy = { clipboard.setText(AnnotatedString(prompt)) },
            )
        }

        item {
            Button(
                onClick = { viewModel.generateAllImages() },
                enabled = !viewModel.isGeneratingAll,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = MaterialTheme.shapes.large,
            ) {
                if (viewModel.isGeneratingAll) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Text(
                        "正在批量生图…",
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(start = 12.dp),
                    )
                } else {
                    Icon(
                        Icons.Filled.Image,
                        contentDescription = null,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        "全部生图",
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(start = 10.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun StyleInfoCard(style: com.aicard.domain.ModuleStyle) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        shape = MaterialTheme.shapes.large,
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                Text("系列风格", style = MaterialTheme.typography.titleMedium)
            }
            Text("画风：${style.artStyle}", style = MaterialTheme.typography.bodyMedium)
            Text("配色：${style.palette}", style = MaterialTheme.typography.bodyMedium)
            Text("氛围：${style.mood}", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun QualityPanel(
    report: QualityReport,
    selfCheck: SelfCheckResult?,
    isSelfChecking: Boolean,
    selfCheckError: String?,
    adoptedIds: Set<String>,
    hasUndo: Boolean,
    onRunSelfCheck: () -> Unit,
    onAdopt: (String) -> Unit,
    onAdoptAll: () -> Unit,
    onUndo: () -> Unit,
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
                Icon(Icons.AutoMirrored.Filled.ReceiptLong, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                Text("质检面板", style = MaterialTheme.typography.titleMedium)
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(vertical = 8.dp)) {
                    Text(
                        "${report.score}",
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Bold,
                        color = scoreColor(report.score),
                    )
                    Text("总分", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    DimBar("完整性", report.dimensions.completeness, scoreColor(report.dimensions.completeness))
                    DimBar("逻辑性", report.dimensions.consistency, scoreColor(report.dimensions.consistency))
                    DimBar("数字", report.dimensions.numerics, scoreColor(report.dimensions.numerics))
                    DimBar("风险", report.dimensions.riskLevel, scoreColor(report.dimensions.riskLevel))
                }
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("风险等级", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    val (chipBg, chipFg) = riskTones(report.riskLabel)
                    Surface(
                        color = chipBg,
                        shape = RoundedCornerShape(999.dp),
                    ) {
                        Text(
                            report.riskLabel.label,
                            style = MaterialTheme.typography.labelMedium,
                            color = chipFg,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }

            if (report.issues.isNotEmpty()) {
                Text("问题列表（${report.issues.size}）", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Medium)
                report.issues.forEach { issue ->
                    IssueRow(issue)
                }
            }

            HorizontalDivider()

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(16.dp))
                    Text("AI 跨模型质检", style = MaterialTheme.typography.titleSmall)
                }
                if (selfCheck == null && !isSelfChecking) {
                    OutlinedButton(onClick = onRunSelfCheck) { Text("开始质检") }
                }
            }

            if (isSelfChecking) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(modifier = Modifier.widthIn(max = 18.dp), strokeWidth = 2.dp)
                    Text("B 模型审查中…", style = MaterialTheme.typography.bodySmall)
                }
            }

            selfCheckError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }

            selfCheck?.let { sc ->
                Surface(
                    color = MaterialTheme.colorScheme.tertiaryContainer,
                    contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("可信度", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text(
                                sc.confidenceScore.toString(),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = scoreColor(sc.confidenceScore),
                            )
                        }
                        Text(sc.overallComment, style = MaterialTheme.typography.bodySmall)
                    }
                }

                sc.analysis?.let { analysis ->
                    var expanded by remember { mutableStateOf(false) }
                    Text(
                        analysis.take(if (expanded) analysis.length else 120) + if (!expanded && analysis.length > 120) "…" else "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (analysis.length > 120) {
                        TextButton(onClick = { expanded = !expanded }) {
                            Text(if (expanded) "收起" else "展开")
                        }
                    }
                }

                sc.issues.forEach { issue ->
                    Text("• [${issue.severity.raw}] ${issue.message}", style = MaterialTheme.typography.bodySmall)
                }

                sc.improvedModules?.let { improved ->
                    if (improved.isNotEmpty()) {
                        HorizontalDivider()
                        Text("B 模型改写（${improved.size}）", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Medium)
                        improved.forEach { im ->
                            val adopted = im.id in adoptedIds
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(MaterialTheme.shapes.small)
                                    .background(if (adopted) MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("模块 ${im.id}", style = MaterialTheme.typography.bodySmall)
                                    im.body?.let { Text("改写：${it.take(60)}…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                }
                                if (adopted) {
                                    Icon(Icons.Filled.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                } else {
                                    TextButton(onClick = { onAdopt(im.id) }) { Text("采纳") }
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = onAdoptAll) { Text("全部采纳") }
                            if (hasUndo) TextButton(onClick = onUndo) { Text("撤销") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DimBar(label: String, value: Int, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, modifier = Modifier.widthIn(max = 40.dp))
        LinearProgressIndicator(
            progress = { value / 100f },
            color = color,
            trackColor = color.copy(alpha = 0.15f),
            modifier = Modifier
                .weight(1f)
                .height(8.dp)
                .clip(RoundedCornerShape(999.dp)),
        )
        Text("$value", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun IssueRow(issue: QualityIssue) {
    val color = when (issue.severity) {
        IssueSeverity.ERROR -> MaterialTheme.colorScheme.error
        IssueSeverity.WARNING -> MaterialTheme.colorScheme.tertiary
        IssueSeverity.INFO -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .padding(vertical = 4.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier
                .padding(top = 6.dp)
                .size(10.dp)
                .background(color, CircleShape),
        )
        Column(modifier = Modifier.padding(start = 8.dp)) {
            Text(issue.message, style = MaterialTheme.typography.bodySmall)
            issue.suggestion?.let {
                Text("→ $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun AnchorCard(
    prompt: String?,
    image: GeneratedImage?,
    isGenerating: Boolean,
    progress: String?,
    error: String?,
    onGenerate: () -> Unit,
    onCopy: () -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    SectionBody {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(MaterialTheme.colorScheme.primaryContainer, MaterialTheme.shapes.small),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Image,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(18.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text("风格锚点图", style = MaterialTheme.typography.titleMedium)
                Text(
                    "先出锚点，统一整套画风",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onCopy) { Icon(Icons.Filled.ContentCopy, contentDescription = "复制") }
            IconButton(onClick = { expanded = !expanded }) {
                Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, contentDescription = null)
            }
        }
        if (expanded && prompt != null) {
            PromptBox(prompt)
        }
        ImageSection(image, isGenerating, progress, error, onGenerate, "生成锚点图")
    }
}

@Composable
private fun PagePromptCard(
    pageNumber: Int,
    totalPages: Int,
    title: String,
    ratio: String,
    moduleTitles: String,
    prompt: String,
    image: GeneratedImage?,
    isGenerating: Boolean,
    progress: String?,
    error: String?,
    onGenerate: () -> Unit,
    onCopy: () -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    SectionBody {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text("$pageNumber", style = MaterialTheme.typography.titleMedium)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
                Text(
                    "第 $pageNumber / $totalPages 页 · 比例 $ratio",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "模块：$moduleTitles",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            IconButton(onClick = onCopy) { Icon(Icons.Filled.ContentCopy, contentDescription = "复制") }
            IconButton(onClick = { expanded = !expanded }) {
                Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, contentDescription = null)
            }
        }
        if (expanded) {
            PromptBox(prompt)
        }
        ImageSection(image, isGenerating, progress, error, onGenerate, "生成本页")
    }
}

@Composable
private fun ImageSection(
    image: GeneratedImage?,
    isGenerating: Boolean,
    progress: String?,
    error: String?,
    onGenerate: () -> Unit,
    buttonLabel: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (image != null) {
            AsyncImage(
                model = image.bytes,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(MaterialTheme.shapes.medium),
            )
        }
        if (isGenerating) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(MaterialTheme.shapes.medium)
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Text(progress ?: "正在生图…", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
            }
        }
        error?.let {
            Surface(
                color = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer,
                shape = MaterialTheme.shapes.small,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        if (!isGenerating) {
            OutlinedButton(
                onClick = onGenerate,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.small,
            ) {
                if (image != null) {
                    Icon(Icons.Filled.RestartAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.size(6.dp))
                }
                Text(if (image != null) "重新生成" else buttonLabel)
            }
        }
    }
}

private fun scoreColor(score: Int) = when {
    score >= 80 -> Color(0xFF2E7D32)
    score >= 60 -> Color(0xFFEF6C00)
    else -> Color(0xFFC62828)
}

@Composable
private fun SectionBody(
    color: Color = MaterialTheme.colorScheme.surfaceContainer,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = color,
        shape = MaterialTheme.shapes.large,
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            content = content,
        )
    }
}

@Composable
private fun PromptBox(prompt: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerHighest,
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            prompt,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(12.dp),
        )
    }
}

@Composable
private fun riskTones(label: RiskLabel): Pair<Color, Color> = when (label) {
    RiskLabel.HIGH -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
    RiskLabel.MEDIUM -> MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer
    RiskLabel.LOW -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
}
