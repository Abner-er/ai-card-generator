package com.aicard.data

// 对应 src/blocks/selfCheck.ts — 跨模型质检（A 模型生成，B 模型检查）
//
// 让另一个 LLM 以"知识内容质检员"身份审查拆解结果，
// 逐条检查模块内容的准确性、完整性、逻辑一致性。
//
// 为什么用 B 模型：同家族/同模型评审自己的输出存在自我偏好偏差
// （self-preference bias，实测可系统性抬分），换一个不同家族的模型
// 能显著降低偏袒。默认取 settings.text.checkModel，留空回退到生成模型。
//
// Android 端差异：TS 走 /ai-check-api 中间件（注入 B 端点 Key + 转发），
// 这里直接用 OpenAiCompatGateway 配 B 端点/Key——checkGatewayPlan 协商逻辑不变。

import com.aicard.domain.ChatMessage
import com.aicard.domain.ChatRequest
import com.aicard.domain.DecomposeResult
import com.aicard.domain.HttpFailure
import com.aicard.domain.TextLlmGateway
import com.aicard.domain.trimTitle
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient

enum class SelfCheckType(val raw: String) {
    ACCURACY("accuracy"),
    LOGIC("logic"),
    COMPLETENESS("completeness"),
    CLARITY("clarity");

    companion object {
        fun fromRaw(v: String?): SelfCheckType? = entries.firstOrNull { it.raw == v }
    }
}

data class SelfCheckIssue(
    val moduleId: String? = null,
    val severity: com.aicard.domain.IssueSeverity,
    val type: SelfCheckType,
    val message: String,
    val suggestion: String? = null,
)

data class ImprovedModule(
    val id: String,
    val title: String? = null,
    val body: String? = null,
    val bullets: List<String>? = null,
)

data class SelfCheckResult(
    val confidenceScore: Int,
    val analysis: String? = null,
    val issues: List<SelfCheckIssue>,
    val overallComment: String,
    val improvedModules: List<ImprovedModule>? = null,
)

data class SelfCheckOptions(
    val mock: Boolean = false,
)

/**
 * 跨模型质检入口。
 *
 * http/settings/keys 注入：对应 TS getSettings() + fetch 的端点协商。
 * gateway 由本函数内部按 checkGatewayPlan 构造——B 端点/Key 留空回退 A 端点。
 */
suspend fun selfCheckContent(
    result: DecomposeResult,
    http: OkHttpClient,
    settings: AppSettings,
    keys: (KeySlot) -> String,
    opts: SelfCheckOptions = SelfCheckOptions(),
): SelfCheckResult {
    val useMock = opts.mock || settings.mock
    if (useMock) return mockSelfCheck(result)

    val (checkBase, checkKey) = checkGatewayPlan(settings, keys)
    val gateway: TextLlmGateway = OpenAiCompatGateway(
        http = http,
        baseUrl = { checkBase },
        apiKey = { checkKey },
    )

    val system = buildSelfCheckSystemPrompt()
    val user = buildSelfCheckUserPrompt(result)
    val checkModel = checkModelName(settings)

    val text = try {
        gateway.chatCompletion(
            ChatRequest(
                model = checkModel,
                messages = listOf(
                    ChatMessage("system", system),
                    ChatMessage("user", user),
                ),
                temperature = settings.text.selfCheckTemperature,
                maxTokens = 8000,
            ),
        )
    } catch (e: HttpFailure) {
        throw RuntimeException("内容质检失败: ${e.status} ${e.body.take(160)}")
    }

    val parsed = parseSelfCheckResult(text)
    if (parsed != null) return parsed
    throw RuntimeException("质检结果解析失败：模型未返回合法 JSON")
}

private fun buildSelfCheckSystemPrompt(): String =
    """你是一个严谨的知识内容质检员。待审查的内容由另一个 AI 模型生成，你是独立的第三方审查者——它与你的声誉无关，不必手下留情，也不必迎合它。

【审查方式】
先分析，后结论。在给出任何评分和问题列表之前，必须先逐模块、逐维度过一遍检查（写入 analysis 字段）。直接跳到结论会漏掉真问题。

【审查维度】
1. **准确性（accuracy）**：内容是否有明显的事实错误、数据不准、概念混淆。
   - 注意：你只能指出"你确定错误"的内容，不确定的不要瞎标。
   - 如果某个说法你不确定对错，标记为"待验证"而不是"错误"。

2. **逻辑性（logic）**：内容是否存在前后矛盾、因果倒置、推理跳跃、概念偷换。
   - 检查模块之间是否有说法不一致的地方。
   - 检查流程类内容步骤顺序是否合理。

3. **完整性（completeness）**：主题是否有明显遗漏的关键知识点。
   - 比如讲"做豆腐"不能漏掉"点卤"这个核心步骤。
   - 比如讲"糖尿病"不能只讲症状不讲治疗/预防。

4. **表述清晰度（clarity）**：内容是否含糊不清、有歧义、过于笼统。
   - "很多""非常好"这种空洞表述需要指出。
   - 专业术语没有解释、读者可能看不懂的，需要指出。

【输出格式】
只返回 JSON（不要任何解释、不要 markdown 代码块、不要反引号），且字段必须按下面的顺序生成——先写 analysis，再给结论：
{
  "analysis": "逐模块检查：m1（xxx）：准确性无问题，逻辑通顺…；m2（xxx）：第 2 条要点与 m1 正文矛盾…；m3（xxx）：「yyy」说法存疑，我确定它是错的因为…",
  "confidenceScore": 85,
  "overallComment": "整体内容质量较好，结构完整，但有 2 处数据需要核实，1 个关键步骤缺失。",
  "issues": [
    {
      "moduleId": "m3",
      "severity": "warning",
      "type": "accuracy",
      "message": "「豆腐起源于汉代淮南王刘安」这一说法存在争议，并非定论",
      "suggestion": "建议改为「相传豆腐起源于汉代淮南王刘安」或添加\"据考证\"等限定词"
    }
  ],
  "improvedModules": [
    {
      "id": "m3",
      "body": "相传豆腐起源于汉代淮南王刘安，距今已有两千多年历史。"
    },
    {
      "id": "m5",
      "bullets": ["Wi-Fi 7 使用 2.4/5/6 GHz 频段", "支持 320 MHz 信道", "支持 4K-QAM"]
    }
  ]
}

字段说明：
- analysis：必填。按模块顺序逐一写出你的检查过程和依据，每个模块 1-2 句；这是后续结论的推导基础，不许走过场
- confidenceScore：你对整组内容的可信度评分，0-100
- overallComment：整体评价，50 字以内
- issues：问题列表，按严重程度排序（error 在前），只允许包含 analysis 中有依据的问题
  - severity：error（必须改）/ warning（建议改）/ info（可优化）
  - type：accuracy / logic / completeness / clarity
- improvedModules：可选，给出你建议修改后的内容，只填需要改写的字段。**铁律：若你确认某条"要点(bullet)"存在事实/数据错误，必须给出该模块修正后的完整 bullets（最多 5 条，把错误要点替换为正确表述）——不要只写 suggestion 让用户手动改；同理，正文错误给修正后的 body**。用户"一键采纳"时只认 improvedModules 里的字段，光有 suggestion 不会真正改掉内容。

【重要原则】
- 先分析后结论：issues 和 confidenceScore 必须从 analysis 的检查过程中推导出来
- 宁缺毋滥：只报你有把握的问题，不要为了"显得专业"而凑数
- 实事求是：不确定就标"待验证"，不要瞎给结论
- 独立判断：内容质量差就给低分，不要客气；内容没问题就给高分，不要硬挑
- 聚焦重点：优先找真正影响内容质量的问题，小语病之类不用挑"""

private fun buildSelfCheckUserPrompt(result: DecomposeResult): String {
    val lines = mutableListOf<String>()
    lines.add("主题/系列：${result.seriesTitle}")
    lines.add("")
    lines.add("知识模块列表：")
    result.modules.forEachIndexed { i, m ->
        lines.add("${i + 1}. [${m.type.raw}] ${m.title}（ID: ${m.id}）")
        lines.add("   正文：${m.body.ifEmpty { "(空)" }}")
        if (m.bullets.isNotEmpty()) {
            lines.add("   要点：${m.bullets.joinToString("；")}")
        }
    }
    lines.add("")
    lines.add("请先在 analysis 字段中逐模块写出检查过程，再给出评分、整体评价和问题列表。输出 JSON。")
    return lines.joinToString("\n")
}

private val selfCheckJson = Json { ignoreUnknownKeys = true }

private fun parseSelfCheckResult(text: String): SelfCheckResult? {
    val cleaned = text.replace(Regex("```json\\n?"), "").replace(Regex("```\\n?"), "").trim()
    val m = Regex("\\{[\\s\\S]*\\}").find(cleaned) ?: return null
    val p = try {
        selfCheckJson.parseToJsonElement(m.value) as? JsonObject ?: return null
    } catch (e: Exception) {
        return null
    }

    val scoreEl = p["confidenceScore"]
    val score = if (scoreEl is JsonPrimitive) {
        scoreEl.content.toIntOrNull()?.coerceIn(0, 100) ?: 70
    } else 70

    val comment = (p["overallComment"] as? JsonPrimitive)?.content?.take(200) ?: ""

    val issuesArr = p["issues"] as? JsonArray
    val issues = (issuesArr ?: JsonArray(emptyList())).mapNotNull { el ->
        val x = el as? JsonObject ?: return@mapNotNull null
        val msg = (x["message"] as? JsonPrimitive)?.content ?: return@mapNotNull null
        val sevRaw = (x["severity"] as? JsonPrimitive)?.content
        val severity = com.aicard.domain.IssueSeverity.entries
            .firstOrNull { it.raw == sevRaw } ?: com.aicard.domain.IssueSeverity.WARNING
        val typeRaw = (x["type"] as? JsonPrimitive)?.content
        val type = SelfCheckType.fromRaw(typeRaw) ?: SelfCheckType.CLARITY
        SelfCheckIssue(
            moduleId = (x["moduleId"] as? JsonPrimitive)?.content,
            severity = severity,
            type = type,
            message = msg.take(200),
            suggestion = (x["suggestion"] as? JsonPrimitive)?.content?.take(200),
        )
    }

    val improvedArr = p["improvedModules"] as? JsonArray
    val improved = improvedArr?.mapNotNull { el ->
        val x = el as? JsonObject ?: return@mapNotNull null
        val id = (x["id"] as? JsonPrimitive)?.content ?: return@mapNotNull null
        ImprovedModule(
            id = id,
            title = (x["title"] as? JsonPrimitive)?.content?.let { trimTitle(it, "", 40) },
            body = (x["body"] as? JsonPrimitive)?.content?.take(200),
            bullets = (x["bullets"] as? JsonArray)
                ?.mapNotNull { b -> (b as? JsonPrimitive)?.content?.take(50) }
                ?.take(5),
        )
    }

    return SelfCheckResult(
        confidenceScore = score,
        analysis = (p["analysis"] as? JsonPrimitive)?.content?.take(1500),
        overallComment = comment,
        issues = issues,
        improvedModules = improved,
    )
}

// ===== Mock =====

private fun mockSelfCheck(result: DecomposeResult): SelfCheckResult {
    val issues = mutableListOf<SelfCheckIssue>()
    val stepModules = result.modules.filter { it.type == com.aicard.domain.ModuleType.STEP }

    if (stepModules.isNotEmpty() && stepModules.size < 4) {
        issues.add(
            SelfCheckIssue(
                moduleId = stepModules[0].id,
                severity = com.aicard.domain.IssueSeverity.WARNING,
                type = SelfCheckType.COMPLETENESS,
                message = "流程步骤可能不够完整，关键环节有遗漏风险",
                suggestion = "建议检查是否缺少核心步骤，确保流程闭环",
            ),
        )
    }

    val hasData = result.modules.any { it.type == com.aicard.domain.ModuleType.STAT }
    if (!hasData) {
        issues.add(
            SelfCheckIssue(
                severity = com.aicard.domain.IssueSeverity.INFO,
                type = SelfCheckType.COMPLETENESS,
                message = "缺少数据类模块，可以增加具体数字增强说服力",
                suggestion = "考虑添加 1 个 stat 类型模块，用数据支撑内容",
            ),
        )
    }

    val totalBullets = result.modules.sumOf { it.bullets.size }
    if (totalBullets < result.modules.size) {
        issues.add(
            SelfCheckIssue(
                severity = com.aicard.domain.IssueSeverity.INFO,
                type = SelfCheckType.CLARITY,
                message = "多数模块只有正文没有要点，信息层级不够清晰",
                suggestion = "建议为主要知识点模块补充 2-3 条要点，便于快速阅读",
            ),
        )
    }

    var score = 82
    if (issues.any { it.severity == com.aicard.domain.IssueSeverity.ERROR }) score -= 20
    if (issues.any { it.severity == com.aicard.domain.IssueSeverity.WARNING }) score -= 8

    val improvedModules = mutableListOf<ImprovedModule>()
    val m0 = result.modules.firstOrNull()
    if (m0 != null) {
        improvedModules.add(
            ImprovedModule(
                id = m0.id,
                body = "【Mock 示例改写】${m0.body}",
                bullets = if (m0.bullets.isNotEmpty()) m0.bullets else listOf("示例要点一（采纳后可撤销）", "示例要点二"),
            ),
        )
    }
    val firstStep = stepModules.firstOrNull()
    if (firstStep != null && firstStep.id != m0?.id) {
        improvedModules.add(ImprovedModule(id = firstStep.id, body = "【Mock 示例改写】${firstStep.body}"))
    }

    val typeNames = issues.joinToString("、") { it.type.raw }
    val comment = "整体内容结构完整，共 ${result.modules.size} 个模块覆盖了主要知识点。" +
        if (issues.isNotEmpty()) "发现 ${issues.size} 处可优化点，主要集中在${typeNames}方面。" else "未发现明显问题。"

    return SelfCheckResult(
        confidenceScore = score.coerceAtLeast(0),
        overallComment = comment,
        issues = issues,
        improvedModules = improvedModules,
    )
}
