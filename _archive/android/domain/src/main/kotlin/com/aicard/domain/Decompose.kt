package com.aicard.domain

// 对应 src/blocks/decompose.ts —— 知识拆解服务（LLM）
//
// 把主题或原始文本，拆成「知识点级」最小模块（搭积木的原子）。
// 每个模块只讲一个清晰知识点；整套共享一个 seriesStyle（视觉统一）。
// 每个模块的 visualHint 描述该模块图的配图主体——由 AI 生成完整模块图时使用。
//
// :domain 层不做 HTTP。网络通过 TextLlmGateway 抽象注入，
// decompose.ts 里的 fetch('/ai-api/chat/completions') 对应 gateway.chatCompletion(...)。

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// —— TYPE_DEFAULT_RATIO / DEFAULT_LAYOUT 使用 StyleEngine.kt 中的公共定义 ——
// （对应 TS 里 decompose.ts 从 styleEngine.ts import 同名表的结构）

// —— 网络抽象 ——

data class ChatMessage(val role: String, val content: String)

data class ChatRequest(
    val model: String,
    val messages: List<ChatMessage>,
    val temperature: Double,
    val maxTokens: Int,
)

/** HTTP 层失败：对应 decompose.ts 里 !resp.ok 分支（status + body 文本） */
class HttpFailure(val status: Int, val body: String) : RuntimeException("HTTP $status")

interface TextLlmGateway {
    /** 返回 choices[0].message.content 文本；HTTP 非 2xx 时抛 HttpFailure */
    suspend fun chatCompletion(request: ChatRequest): String
}

/** 对应 decompose.ts 的 DecomposeOptions（stylePresetId 在 :domain 层由调用方解析成 style 直接传入） */
data class DecomposeOptions(
    val mock: Boolean = false,
    // 默认值取自 settings.ts ENV_DEFAULTS.text：model 'agnes-2.5-flash'、temperature 0.6
    val model: String = "agnes-2.5-flash",
    val temperature: Double = 0.6,
)

class KnowledgeDecomposer(private val gateway: TextLlmGateway) {

    suspend fun decompose(
        input: String,
        style: ModuleStyle,
        opts: DecomposeOptions = DecomposeOptions(),
    ): DecomposeResult {
        if (opts.mock) {
            // mock 只在显式开启时进入（TS: useMock = opts.mock ?? getSettings().mock）
            return mockDecompose(input)
        }

        val system = buildSystemPrompt(style)
        val user = "主题或文本：\n$input"

        try {
            val text = try {
                gateway.chatCompletion(
                    ChatRequest(
                        model = opts.model,
                        messages = listOf(
                            ChatMessage("system", system),
                            ChatMessage("user", user),
                        ),
                        temperature = opts.temperature,
                        // 输出上限：不设则模型默认上限偏小，JSON 常生成到一半被掐断导致 parse 失败
                        maxTokens = 8000,
                    )
                )
            } catch (e: HttpFailure) {
                // 对应 !resp.ok 分支：`知识拆解失败: ${status} ${txt.slice(0,160)}`
                throw RuntimeException("知识拆解失败: ${e.status} ${e.body.take(160)}")
            }
            val parsed = parseDecompose(text, style)
            if (parsed != null && parsed.modules.isNotEmpty()) return parsed
            throw RuntimeException("模型输出无法解析为有效模块结构，请重试或更换模型")
        } catch (e: Exception) {
            // 此前任何失败都静默降级 mock：用户以为拿到的是 AI 拆解，实际是模板——
            // 与「URL 提取内容凭空编造」同根因。现在显式抛错，由调用方 toast 给用户；
            // mock 只在设置里显式开启 Mock 模式时才会走到。
            val msg = e.message ?: e.toString()
            throw RuntimeException(if (msg.startsWith("知识拆解失败")) msg else "知识拆解失败：$msg")
        }
    }
}

private fun buildSystemPrompt(style: ModuleStyle): String {
    return """你是一个知识拆解与排版专家。把用户给定的主题或文本，拆解成一系列「最小知识点模块」，然后把相关模块分组到「页面」上——每页是一张信息密度高的手抄报式知识图，可能包含多个知识模块。

规则：

【模块拆解】
- 模块数量：根据内容 8~18 个，覆盖全面但不重复。
- 每个模块：title（短标题 ≤20 字）、body（正文 ≤80 字，清晰说明核心知识）、bullets（可选，2~5 条，每条 ≤30 字）。
- type 从以下选：cover(封面大标题) / definition(定义) / fact(事实) / step(步骤) / compare(对比) / timeline(时间线) / stat(数据) / quote(金句) / tip(贴士) / section(分节)。
- 第一个模块必须是 type=cover（系列大标题）。
- icon 用单个 emoji（可选）。
- visualHint（必填）：描述该模块在画面中的配图主体或场景。使用具体、可识别的真实视觉元素，不要抽象象征或隐喻。

【页面分组——核心】
- 把模块分组为 2~6 张「页面」，每页包含 2~5 个相关模块，组成一张信息密度高的手抄报式知识图。
- 分组原则：内容相关的模块放同一页（例如「定义+原理」一页，「原因+对比」一页，「步骤+总结」一页）。
- 每页的 visualHint 描述整体画面布局：大标题位置、各模块用不同颜色的圆角文本框区分、箭头或流程线串联、信息密度高、布局饱满整齐。
- visualHint 必须把内容分配到画面的顶部、中部、底部，让整张画布被信息铺满；严禁出现「留白」「空白」「空出」「轻微纹理填充」等会让画面局部没有内容的描述。
- 每页 ratio 建议：封面页用 3:4，内容页用 3:4 或 9:16（竖版适合手机阅读）。
- 页面数量根据信息量自动决定：信息少 2 页，信息多 5~6 页。

【系列风格——必须严格遵守】
用户已选定一个整体视觉风格预设，整个系列（seriesStyle、每一页画面、每个模块配图）都必须统一采用该风格。请把以下各项原样填入输出 JSON 的 seriesStyle 对应字段，不要自行更改、扩展或替换为类似风格：
- artStyle：${style.artStyle}
- palette：${style.palette}
- mood：${style.mood}
- typography：${style.typography}
- lighting：${style.lighting}
- camera：${style.camera}
- material：${style.material}

只返回如下 JSON（不要任何解释、不要 markdown 代码块、不要反引号）：
{
  "seriesTitle": "系列名",
  "seriesStyle": {"artStyle":"...","palette":"...","mood":"...","typography":"..."},
  "modules": [
    {"id":"m1","type":"cover","title":"...","body":"...","bullets":[],"icon":"📘","visualHint":"...","ratio":"3:4"},
    {"id":"m2","type":"definition","title":"...","body":"...","bullets":[],"icon":"💡","visualHint":"...","ratio":"4:3"}
  ],
  "pages": [
    {"id":"p1","title":"封面与定义","moduleIds":["m1","m2"],"ratio":"3:4","visualHint":"大标题居上方，下方分两个彩色圆角文本框，左侧定义模块蓝色框，右侧补充说明绿色框，整体竖版布局"},
    {"id":"p2","title":"原理与对比","moduleIds":["m3","m4","m5"],"ratio":"3:4","visualHint":"上半部分流程图模块用箭头串联，下半部分对比表格双栏布局，各模块用不同颜色圆角框区分"}
  ]
}"""
}

/**
 * 修复 LLM 输出 JSON 的常见语法瑕疵：字符串字面量内的裸换行/硬回车/Tab 未转义，
 * 标准 JSON.parse 会直接抛错（agnes-3.0-flash 等代模型常犯）。用状态机只在字符串值内部
 * 把这些控制字符转义成合法序列，避免误伤字符串外的结构。无法无损修复时返回 null。
 */
private fun repairJsonControlChars(raw: String): String? {
    val out = StringBuilder()
    var inStr = false
    var esc = false
    var i = 0
    while (i < raw.length) {
        val ch = raw[i]
        if (esc) { out.append(ch); esc = false; i++; continue }
        if (inStr) {
            if (ch == '\\') { out.append(ch); esc = true; i++; continue }
            if (ch == '"') { out.append(ch); inStr = false; i++; continue }
            if (ch == '\n' || ch == '\r' || ch == '\t') {
                // 字符串内的裸控制字符：转义。\r\n 一起出现时只输出一个 \n 避免引入 \r
                val next = if (i + 1 < raw.length) raw[i + 1] else null
                if (ch == '\r' && next == '\n') {
                    // 输出空串
                } else {
                    out.append("\\n")
                }
                i++; continue
            }
            out.append(ch); i++; continue
        }
        if (ch == '"') { out.append(ch); inStr = true; i++; continue }
        out.append(ch); i++
    }
    return if (inStr) null else out.toString()
}

private fun parseDecompose(text: String, fallbackStyle: ModuleStyle): DecomposeResult? {
    val cleaned = text.replace(Regex("```json\\n?"), "").replace(Regex("```\\n?"), "").trim()
    val m = Regex("\\{[\\s\\S]*\\}").find(cleaned) ?: return null
    val p: JsonElement = try {
        try {
            Json.parseToJsonElement(m.value)
        } catch (e: Exception) {
            // 首次解析失败：尝试修复字符串内的裸控制字符后重试（LLM 输出常见）
            val repaired = repairJsonControlChars(m.value)
            if (repaired != null) {
                try {
                    Json.parseToJsonElement(repaired)
                } catch (e2: Exception) {
                    throw RuntimeException("unrepairable")
                }
            } else {
                throw RuntimeException("unrepairable")
            }
        }
    } catch (e: Exception) {
        return null
    }
    val pObj = p as? JsonObject ?: return null
    val rawModules = (pObj["modules"] as? JsonArray) ?: JsonArray(emptyList())
    val modules: List<DecomposedModule> = rawModules
        .mapNotNull { it as? JsonObject }
        .filter { it.truthyText("title") != null }
        .mapIndexed { i, x ->
            val type = ModuleType.fromRaw(x.stringOrNull("type")) ?: ModuleType.FACT
            DecomposedModule(
                id = x.stringOrNull("id")?.takeIf { s -> s.isNotEmpty() } ?: "m${i + 1}",
                type = type,
                title = trimTitle(x.textOrNull("title"), "", 40),
                body = x.textOrEmpty("body").take(200),
                bullets = (x["bullets"] as? JsonArray)
                    ?.map { b -> b.textValue().take(50) }
                    ?.take(5)
                    ?: emptyList(),
                icon = x.truthyText("icon")?.take(4) ?: "",
                visualHint = x.truthyText("visualHint")?.take(120) ?: "",
                ratio = Ratio.fromRaw(x.stringOrNull("ratio")) ?: TYPE_DEFAULT_RATIO.getValue(type),
                layout = DEFAULT_LAYOUT.getValue(type),
            )
        }
    if (modules.isEmpty()) return null
    val ssObj = pObj["seriesStyle"] as? JsonObject
    val seriesStyle: ModuleStyle = if (ssObj != null) {
        ModuleStyle(
            artStyle = ssObj.textOrNull("artStyle") ?: fallbackStyle.artStyle,
            palette = ssObj.textOrNull("palette") ?: fallbackStyle.palette,
            mood = ssObj.textOrNull("mood") ?: fallbackStyle.mood,
            typography = ssObj.textOrNull("typography") ?: fallbackStyle.typography,
            lighting = ssObj.truthyText("lighting") ?: fallbackStyle.lighting,
            camera = ssObj.truthyText("camera") ?: fallbackStyle.camera,
            material = ssObj.truthyText("material") ?: fallbackStyle.material,
        )
    } else {
        fallbackStyle
    }
    val seriesTitle = trimTitle(pObj.textOrNull("seriesTitle"), "知识图解")
    val pages = parsePages(pObj["pages"], modules)
    return DecomposeResult(
        seriesTitle = seriesTitle,
        seriesStyle = seriesStyle,
        modules = modules,
        pages = pages,
    )
}

private fun parsePages(raw: JsonElement?, modules: List<DecomposedModule>): List<CardPage> {
    if (raw !is JsonArray || raw.isEmpty()) return autoPages(modules)
    return raw
        .mapNotNull { it as? JsonObject }
        .filter { (it["moduleIds"] as? JsonArray)?.isNotEmpty() == true }
        .mapIndexed { i, x ->
            CardPage(
                id = x.stringOrNull("id")?.takeIf { s -> s.isNotEmpty() } ?: "p${i + 1}",
                title = trimTitle(x.textOrNull("title")),
                moduleIds = (x["moduleIds"] as JsonArray).map { id -> id.textValue() },
                ratio = Ratio.fromRaw(x.stringOrNull("ratio")) ?: Ratio.R3X4,
                visualHint = x.truthyText("visualHint")?.take(200) ?: "",
            )
        }
}

private fun autoPages(modules: List<DecomposedModule>): List<CardPage> {
    if (modules.isEmpty()) return emptyList()
    val pages = mutableListOf<CardPage>()
    val pageSize = 3
    var i = 0
    while (i < modules.size) {
        val chunk = modules.subList(i, minOf(i + pageSize, modules.size))
        pages.add(
            CardPage(
                id = "p${pages.size + 1}",
                title = chunk[0].title,
                moduleIds = chunk.map { m -> m.id },
                ratio = Ratio.R3X4,
                visualHint = "",
            )
        )
        i += pageSize
    }
    return pages
}

/** Mock 拆解：仅在显式开启 Mock 模式时使用（不再是 LLM 失败的静默兜底） */
private fun mockDecompose(input: String, style: ModuleStyle? = null): DecomposeResult {
    val text = input.trim()
    val isLong = text.length > 60
    val theme = if (isLong) trimTitle(text, "知识图解", 24) else text.ifEmpty { "知识图解" }
    val sentences: List<String> = if (isLong) {
        text.split(Regex("[。！？\n；;]+"))
            .map { s -> s.trim() }
            .filter { s -> s.length >= 4 }
            .take(14)
    } else {
        emptyList()
    }

    val modules = mutableListOf<DecomposedModule>()

    modules.add(
        DecomposedModule(
            id = "m1",
            type = ModuleType.COVER,
            title = if (isLong) trimTitle(text, "知识图解", 20) else text.ifEmpty { "知识图解" },
            body = if (isLong) "核心要点一览" else "一键拆解知识点",
            bullets = emptyList(),
            icon = "📘",
            visualHint = "与\"$theme\"相关的完整主体场景，居中、清晰、可识别",
            ratio = Ratio.R3X4,
            layout = DEFAULT_LAYOUT.getValue(ModuleType.COVER),
        )
    )

    if (isLong) {
        sentences.forEachIndexed { i, s ->
            modules.add(
                DecomposedModule(
                    id = "m${i + 2}",
                    type = if (i % 5 == 4) ModuleType.TIP else ModuleType.FACT,
                    title = trimTitle(s, "要点", 16),
                    body = s.take(40), // allow-truncation: mock 正文限长占位，非标题
                    bullets = emptyList(),
                    icon = if (i % 5 == 4) "💡" else "🔍",
                    visualHint = "与\"${s.take(12)}\"直接相关的单一主体插画，干净背景，只有这个主体",
                    ratio = Ratio.R1X1,
                    layout = DEFAULT_LAYOUT.getValue(if (i % 5 == 4) ModuleType.TIP else ModuleType.FACT),
                )
            )
        }
        val quoteType = ModuleType.QUOTE
        modules.add(
            DecomposedModule(
                id = "m${modules.size + 1}",
                type = quoteType,
                title = "小结",
                body = "理解本质，胜过死记硬背。",
                bullets = emptyList(),
                icon = "✨",
                visualHint = "与\"$theme\"氛围相关的抽象主体图形",
                ratio = Ratio.R3X4,
                layout = DEFAULT_LAYOUT.getValue(quoteType),
            )
        )
    } else {
        val themeOrSubject = text.ifEmpty { "主题" }
        val elseModules: List<DecomposedModule> = listOf(
            DecomposedModule(id = "m2", type = ModuleType.DEFINITION, title = "是什么", body = "${themeOrSubject}的核心定义，一句话说清。", bullets = emptyList(), icon = "💡", visualHint = "与\"$themeOrSubject\"概念相关的抽象主体图形", ratio = Ratio.R4X3, layout = DEFAULT_LAYOUT.getValue(ModuleType.DEFINITION)),
            DecomposedModule(id = "m3", type = ModuleType.FACT, title = "要点一", body = "第一个关键知识点，简明扼要。", bullets = listOf("细节 A", "细节 B"), icon = "🔍", visualHint = "与要点一相关的单一主体插画，干净背景", ratio = Ratio.R1X1, layout = DEFAULT_LAYOUT.getValue(ModuleType.FACT)),
            DecomposedModule(id = "m4", type = ModuleType.FACT, title = "要点二", body = "第二个关键知识点，配示例。", bullets = listOf("细节 C"), icon = "🔍", visualHint = "与要点二相关的单一主体插画，干净背景", ratio = Ratio.R1X1, layout = DEFAULT_LAYOUT.getValue(ModuleType.FACT)),
            DecomposedModule(id = "m5", type = ModuleType.STEP, title = "怎么做", body = "操作步骤，循序渐进。", bullets = listOf("先…", "再…", "后…"), icon = "🧭", visualHint = "步骤流程的单一示意图标，居中清晰", ratio = Ratio.R9X16, layout = DEFAULT_LAYOUT.getValue(ModuleType.STEP)),
            DecomposedModule(id = "m6", type = ModuleType.STAT, title = "关键数据", body = "用数字说话。", bullets = emptyList(), icon = "📊", visualHint = "数据可视化主体（图表/数字），干净背景", ratio = Ratio.R3X4, layout = DEFAULT_LAYOUT.getValue(ModuleType.STAT)),
            DecomposedModule(id = "m7", type = ModuleType.QUOTE, title = "金句", body = "一句有记忆点的总结。", bullets = emptyList(), icon = "✨", visualHint = "与\"$theme\"氛围相关的抽象主体图形", ratio = Ratio.R3X4, layout = DEFAULT_LAYOUT.getValue(ModuleType.QUOTE)),
            DecomposedModule(id = "m8", type = ModuleType.TIP, title = "贴士", body = "一个实用提醒。", bullets = emptyList(), icon = "💡", visualHint = "提示相关的单一小插画（如灯泡）", ratio = Ratio.R1X1, layout = DEFAULT_LAYOUT.getValue(ModuleType.TIP)),
        )
        elseModules.forEach { m -> modules.add(m) }
    }

    val seriesStyle: ModuleStyle = style ?: ModuleStyle(
        artStyle = "扁平矢量插画",
        palette = "明亮多彩、低饱和",
        mood = "轻松现代",
        typography = "粗体无衬线、高对比",
        lighting = "均匀漫射光、柔和无硬阴影",
        camera = "平视正面、居中构图",
        material = "干净矢量色块、平滑边缘、无纹理",
    )

    return DecomposeResult(
        seriesTitle = theme,
        seriesStyle = seriesStyle,
        modules = modules,
        pages = autoPages(modules),
    )
}

// —— 防御式 JSON 取值：完全镜像 TS 的可选链 / ?? / 真值判断 ——

/** JSON 值的字符串化：串→内容、数/布尔→字面、null/缺失→""、对象/数组→其 JSON 文本 */
private fun JsonElement.textValue(): String = when {
    this is JsonNull -> ""
    this is JsonPrimitive -> content
    else -> toString()
}

/** typeof === 'string'：仅字符串原始值返回内容，其余（含数字/布尔/对象/缺失）返回 null */
private fun JsonObject.stringOrNull(key: String): String? {
    val el = this[key] ?: return null
    return (el as? JsonPrimitive)?.takeIf { it.isString && it !is JsonNull }?.content
}

/** x ?? d：字段缺失或显式 null → null（可回退）；否则返回其字符串化（空串保留为空串） */
private fun JsonObject.textOrNull(key: String): String? {
    val el = this[key] ?: return null
    if (el is JsonNull) return null
    return el.textValue()
}

/** x ?? ''：字段缺失或 null → ""；否则其字符串化 */
private fun JsonObject.textOrEmpty(key: String): String = textOrNull(key) ?: ""

/** x ? ... : undefined（真值判断）：缺失/null/空串 → null；否则其字符串化 */
private fun JsonObject.truthyText(key: String): String? = textOrNull(key)?.takeIf { it.isNotEmpty() }
