package com.aicard.domain

// 对应 src/blocks/qualityCheck.ts — 内容质量规则快检
//
// 纯规则、零 LLM 调用、即时运行。
// 检查四个维度：完整性、逻辑一致性、数字合理性、风险分级。
//
// 设计原则（逐字保真）：
//  - 宁可漏报，不要误报（避免用户对"质检"失去信任）
//  - 每条问题都带具体位置和修改建议
//  - 评分制：0-100，按问题严重程度扣分

enum class IssueSeverity(val raw: String) {
    ERROR("error"),
    WARNING("warning"),
    INFO("info"),
}

data class QualityIssue(
    val code: String,
    val severity: IssueSeverity,
    val message: String,
    val suggestion: String? = null,
    val moduleId: String? = null,
    val field: String? = null,
)

data class QualityDimensions(
    val completeness: Int,
    val consistency: Int,
    val numerics: Int,
    val riskLevel: Int,
)

enum class RiskLabel(val label: String) {
    LOW("低风险"),
    MEDIUM("中风险"),
    HIGH("高风险"),
}

data class QualityReport(
    val score: Int,
    val dimensions: QualityDimensions,
    val issues: List<QualityIssue>,
    val riskLabel: RiskLabel,
)

// ===== 风险领域关键词 =====

private data class RiskDomain(val name: String, val words: List<String>)

private val HIGH_RISK_DOMAINS: List<RiskDomain> = listOf(
    RiskDomain(
        "医学/健康",
        listOf(
            "疾病", "治疗", "用药", "药方", "中医", "西医", "手术",
            "癌症", "肿瘤", "糖尿病", "高血压", "心脏病", "抑郁",
            "养生", "保健", "食疗", "偏方", "功效", "主治",
        ),
    ),
    RiskDomain(
        "法律",
        listOf("法规", "诉讼", "违法", "犯罪", "判刑", "律师"),
    ),
    RiskDomain(
        "金融/投资",
        listOf(
            "股票", "基金", "投资", "理财", "证券", "期货", "外汇", "加密货币",
            "比特币", "回报率", "保本", "稳赚",
        ),
    ),
)

private val HIGH_RISK_WEAK: List<String> = listOf(
    "医学", "医疗", "诊断", "症状",
    "法律", "条例", "宪法", "刑法", "民法", "合同", "知识产权", "专利", "商标",
    "金融",
)

private val TECH_PROCESS_WORDS: List<String> = listOf(
    "识别", "检测", "图像", "算法", "模型", "训练", "数据", "票据", "单据",
    "证件", "证书", "文书", "光学", "字符", "OCR", "分类", "分割", "特征",
    "提取", "深度学习", "神经网络", "计算机视觉", "扫描", "解析", "录入", "归档",
    "网络", "信息", "系统", "加密", "服务器", "软件", "程序", "代码",
)

private val MEDIUM_RISK_KEYWORDS: List<String> = listOf(
    "儿童", "婴幼儿", "孕妇", "安全", "食用", "饮食", "营养", "减肥",
    "考试", "升学", "就业", "职场",
)

private val VAGUE_ADJECTIVES: List<String> = listOf(
    "非常", "十分", "极其", "超级", "无比", "相当", "特别", "格外",
    "很多", "许多", "大量", "众多", "不少", "一些", "若干", "各种",
    "很好", "很棒", "优秀", "出色", "卓越", "顶级", "极致", "完美",
    "重要", "关键", "核心", "主要", "基本", "根本", "重要的",
)

private val PROCESS_KEYWORDS: List<String> = listOf(
    "制作", "流程", "步骤", "怎么做", "方法", "工序", "工艺", "教程",
)

private val CONTRADICTION_PAIRS: List<Pair<String, String>> = listOf(
    "卤水" to "石膏",
    "生的" to "煮熟",
    "加热" to "冷藏",
    "增加" to "减少",
    "上升" to "下降",
    "正确" to "错误",
    "优点" to "缺点",
)

// ===== 数字异常检测 =====

private data class NumericPattern(val regex: Regex, val unit: String, val max: Double, val min: Double)

private val NUMERIC_PATTERNS: List<NumericPattern> = listOf(
    NumericPattern(Regex("(\\d+(?:\\.\\d+)?)\\s*(小时|个小时|h|小时以上)"), "小时", 1000.0, 0.0),
    NumericPattern(Regex("(\\d+(?:\\.\\d+)?)\\s*(分钟|分|min)"), "分钟", 1440.0, 0.0),
    NumericPattern(Regex("(\\d+(?:\\.\\d+)?)\\s*(天|日|天以上)"), "天", 365.0, 0.0),
    NumericPattern(Regex("(\\d+(?:\\.\\d+)?)\\s*(年|年以上|多年)"), "年", 10000.0, 0.0),
    NumericPattern(Regex("(\\d+(?:\\.\\d+)?)\\s*(℃|°C|度|摄氏度)"), "温度℃", 500.0, -100.0),
    NumericPattern(Regex("(\\d+(?:\\.\\d+)?)\\s*(%|百分之|％)"), "百分比", 100.0, 0.0),
)

private fun checkNumerics(text: String): List<String> {
    val issues = mutableListOf<String>()
    for (p in NUMERIC_PATTERNS) {
        for (m in p.regex.findAll(text)) {
            val num = m.groupValues[1].toDoubleOrNull() ?: continue
            if (num > p.max || num < p.min) {
                issues.add("数字异常：${m.value}（${p.unit}范围通常在 ${p.min.toInt()}~${p.max.toInt()} 之间）")
            }
        }
    }
    return issues
}

// ===== 工具函数 =====

private fun inTechContext(modules: List<DecomposedModule>, kw: String): Boolean =
    modules.any { m ->
        val t = "${m.title} ${m.body} ${m.bullets.joinToString(" ")}"
        t.contains(kw) && TECH_PROCESS_WORDS.any { w -> t.contains(w) }
    }

private fun textSimilarity(a: String, b: String): Double {
    if (a.isEmpty() || b.isEmpty()) return 0.0
    if (a == b) return 1.0
    val longer = if (a.length >= b.length) a else b
    if (longer.length < 4) return 0.0

    val gramsA = mutableSetOf<String>()
    val gramsB = mutableSetOf<String>()
    for (i in 0 until a.length - 1) gramsA.add(a.substring(i, i + 2))
    for (i in 0 until b.length - 1) gramsB.add(b.substring(i, i + 2))

    var intersection = 0
    for (g in gramsA) if (g in gramsB) intersection++
    val union = gramsA.size + gramsB.size - intersection
    return if (union == 0) 0.0 else intersection.toDouble() / union
}

// ===== 主函数 =====

fun checkQuality(result: DecomposeResult): QualityReport {
    val issues = mutableListOf<QualityIssue>()
    val modules = result.modules
    val pages = result.pages
    val allText = modules.joinToString("") { it.title + it.body + it.bullets.joinToString("") }

    // ---------- 1. 完整性检查 ----------
    var completenessScore = 100

    if (modules.size < 3) {
        issues.add(
            QualityIssue(
                code = "COMP-001",
                severity = IssueSeverity.WARNING,
                message = "模块数量偏少（${modules.size} 个），内容可能不够全面",
                suggestion = "建议增加模块数量到 5 个以上，覆盖定义、原理、步骤、数据等多个角度",
            ),
        )
        completenessScore -= 15
    } else if (modules.size < 5) {
        issues.add(
            QualityIssue(
                code = "COMP-002",
                severity = IssueSeverity.INFO,
                message = "模块数量较少（${modules.size} 个），建议补充更多知识点",
                suggestion = "可以增加数据、对比、贴士等类型的模块丰富内容",
            ),
        )
        completenessScore -= 5
    }

    if (modules.none { it.type == ModuleType.COVER }) {
        issues.add(
            QualityIssue(
                code = "COMP-003",
                severity = IssueSeverity.WARNING,
                message = "缺少封面模块（type=cover）",
                suggestion = "第一个模块应为封面，包含系列大标题和核心介绍",
            ),
        )
        completenessScore -= 10
    }

    val hasProcessTheme = PROCESS_KEYWORDS.any { allText.contains(it) }
    val stepCount = modules.count { it.type == ModuleType.STEP }
    if (hasProcessTheme && stepCount < 2) {
        issues.add(
            QualityIssue(
                code = "COMP-004",
                severity = IssueSeverity.WARNING,
                message = "主题是流程类，但步骤模块只有 $stepCount 个",
                suggestion = "流程类主题建议拆出 3 个以上 step 类型模块，详细说明每一步",
            ),
        )
        completenessScore -= 15
    }

    var emptyModules = 0
    modules.forEach { m ->
        if (m.body.length < 5) {
            emptyModules++
            issues.add(
                QualityIssue(
                    code = "COMP-005",
                    severity = IssueSeverity.INFO,
                    message = "模块「${m.title}」正文过短（${m.body.length} 字）",
                    suggestion = "正文至少写一句完整的说明，让读者快速理解核心内容",
                    moduleId = m.id,
                    field = "body",
                ),
            )
        }
    }
    if (emptyModules > 0) completenessScore -= minOf(emptyModules * 3, 15)

    val missingVisualHint = modules.count { it.visualHint.length < 3 }
    if (missingVisualHint > 0) {
        issues.add(
            QualityIssue(
                code = "COMP-006",
                severity = IssueSeverity.INFO,
                message = "$missingVisualHint 个模块缺少配图说明（visualHint）",
                suggestion = "每个模块都应有具体的配图主体描述，AI 生成的图才会精准",
            ),
        )
        completenessScore -= minOf(missingVisualHint * 2, 10)
    }

    // ---------- 2. 逻辑一致性检查 ----------
    var consistencyScore = 100

    for ((a, b) in CONTRADICTION_PAIRS) {
        val modulesWithA = modules.filter { "${it.title} ${it.body} ${it.bullets.joinToString(" ")}".contains(a) }
        val modulesWithB = modules.filter { "${it.title} ${it.body} ${it.bullets.joinToString(" ")}".contains(b) }
        val sameModule = modulesWithA.filter { ma -> modulesWithB.any { it.id == ma.id } }
        for (m in sameModule) {
            if (m.type == ModuleType.COMPARE) continue
            issues.add(
                QualityIssue(
                    code = "CONS-001",
                    severity = IssueSeverity.WARNING,
                    message = "模块「${m.title}」中同时出现「$a」和「$b」，需确认是否存在逻辑矛盾",
                    suggestion = "如果是对比说明请明确标注；如果是笔误请修正",
                    moduleId = m.id,
                ),
            )
            consistencyScore -= 8
        }
    }

    for (i in modules.indices) {
        for (j in i + 1 until modules.size) {
            val sim = textSimilarity(modules[i].body, modules[j].body)
            if (sim > 0.7 && modules[i].body.length > 10) {
                issues.add(
                    QualityIssue(
                        code = "CONS-002",
                        severity = IssueSeverity.WARNING,
                        message = "模块「${modules[i].title}」与「${modules[j].title}」正文高度相似（相似度约 ${(sim * 100).toInt()}%）",
                        suggestion = "内容重复会浪费版面，建议合并或区分各自的侧重点",
                        moduleId = modules[i].id,
                    ),
                )
                consistencyScore -= 10
            }
        }
    }

    var vagueCount = 0
    modules.forEach { m ->
        val text = m.title + m.body + m.bullets.joinToString("")
        for (adj in VAGUE_ADJECTIVES) {
            if (text.contains(adj)) vagueCount++
        }
    }
    if (vagueCount > 3) {
        issues.add(
            QualityIssue(
                code = "CONS-003",
                severity = IssueSeverity.INFO,
                message = "发现 $vagueCount 处空洞修饰词（如\"非常\"\"很多\"\"重要\"等）",
                suggestion = "尽量用具体数据或事实替代感性描述，提升内容可信度",
            ),
        )
        consistencyScore -= minOf((vagueCount * 1.5).toInt(), 10)
    }

    // ---------- 3. 数字合理性检查 ----------
    var numericsScore = 100
    var numericIssues = 0

    modules.forEach { m ->
        val text = "${m.title} ${m.body} ${m.bullets.joinToString(" ")}"
        for (issueMsg in checkNumerics(text)) {
            numericIssues++
            issues.add(
                QualityIssue(
                    code = "NUM-001",
                    severity = IssueSeverity.WARNING,
                    message = "模块「${m.title}」：$issueMsg",
                    suggestion = "请核实数字是否准确，单位是否正确",
                    moduleId = m.id,
                ),
            )
        }
    }
    if (numericIssues > 0) {
        numericsScore -= minOf(numericIssues * 15, 40)
    }

    // ---------- 4. 风险分级 ----------
    var riskScore = 100
    var riskLabel = RiskLabel.LOW

    val titleText = (result.seriesTitle) + " " +
        modules.joinToString(" ") { it.title } + " " +
        pages.joinToString(" ") { it.title }

    val hitStrong = mutableListOf<String>()
    for (domain in HIGH_RISK_DOMAINS) {
        val hits = domain.words.filter { allText.contains(it) }
        if (hits.isEmpty()) continue
        if (hits.size >= 2 || hits.any { titleText.contains(it) }) {
            hitStrong.addAll(hits)
        }
    }

    val hitWeak = HIGH_RISK_WEAK.filter { allText.contains(it) && !inTechContext(modules, it) }
    val hitMedium = MEDIUM_RISK_KEYWORDS.filter { allText.contains(it) && !inTechContext(modules, it) }

    when {
        hitStrong.isNotEmpty() -> {
            riskLabel = RiskLabel.HIGH
            riskScore = 40
            issues.add(
                QualityIssue(
                    code = "RISK-001",
                    severity = IssueSeverity.ERROR,
                    message = "内容涉及高风险领域：${hitStrong.take(5).joinToString("、")}",
                    suggestion = "此内容仅供科普参考，不构成专业建议。建议在显著位置添加免责声明，并请专业人士审核后再发布",
                ),
            )
        }
        hitWeak.isNotEmpty() -> {
            riskLabel = RiskLabel.MEDIUM
            riskScore = 60
            issues.add(
                QualityIssue(
                    code = "RISK-002",
                    severity = IssueSeverity.WARNING,
                    message = "内容涉及敏感领域：${hitWeak.take(5).joinToString("、")}（未构成具体建议，仍建议标注\"仅供参考\"）",
                    suggestion = "建议添加\"内容仅供参考\"提示，涉及具体操作请标注注意事项",
                ),
            )
        }
        hitMedium.isNotEmpty() -> {
            riskLabel = RiskLabel.MEDIUM
            riskScore = 70
            issues.add(
                QualityIssue(
                    code = "RISK-002",
                    severity = IssueSeverity.WARNING,
                    message = "内容涉及中风险领域：${hitMedium.take(5).joinToString("、")}",
                    suggestion = "建议添加\"内容仅供参考\"提示，涉及具体操作请标注注意事项",
                ),
            )
        }
    }

    // ---------- 汇总 ----------
    val severityOrder = mapOf(IssueSeverity.ERROR to 0, IssueSeverity.WARNING to 1, IssueSeverity.INFO to 2)
    issues.sortBy { severityOrder[it.severity] ?: 2 }

    val score = (completenessScore * 0.3 + consistencyScore * 0.3 + numericsScore * 0.2 + riskScore * 0.2).toInt()

    return QualityReport(
        score = score.coerceIn(0, 100),
        dimensions = QualityDimensions(
            completeness = completenessScore.coerceAtLeast(0),
            consistency = consistencyScore.coerceAtLeast(0),
            numerics = numericsScore.coerceAtLeast(0),
            riskLevel = riskScore.coerceAtLeast(0),
        ),
        issues = issues,
        riskLabel = riskLabel,
    )
}
