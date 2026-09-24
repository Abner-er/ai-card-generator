package com.aicard.domain

// 对应 src/blocks/styleEngine.ts 的函数与规则部分（原文件 L752-1157）
// 生图提示词的中文措辞就是产品 know-how：每一句、每一个标点（、；·——）逐字保真。
// 产出的 prompt 字符串必须与 TS 完全一致（含空格、换行、顿号、句号），故这里不做任何「润色」。
// 未移植：fontStack / getTextTheme / getVariantDecoration / VariantDecoration（全仓零调用的死代码）。
//
// 跨语言等价性说明（重要）：
// 1) TS 的 String.prototype.trim / 正则 \s 覆盖 NBSP(U+00A0)、全角空格(U+3000)、BOM(U+FEFF)；
//    Java 的 Character.isWhitespace 与 \s 不覆盖。为避免边界输入产出漂移，这里用 JS_WS 显式补齐。
// 2) TS `x || 'fallback'` 对空串也回退，故 Kotlin 侧一律用 isNullOrEmpty 语义，不用 ?:。

// ===== 布局维度 =====

/** 布局维度（与风格解耦）：决定模块图里文字与图形的空间排布骨架 */
data class LayoutPreset(
    val id: Layout,
    val label: String,
    /** 空间排布指令（写进生图提示词） */
    val hint: String
)

/**
 * 针对免费 Agnes 的中文文字天花板，所有布局都收敛为「单一聚焦主体插画」的海报式排布，
 * 避免触发 AI 在纸片/标签/黑板等容器里乱填文字。
 */
val LAYOUTS: List<LayoutPreset> = listOf(
    LayoutPreset(Layout.SPARSE, "极简留白", "开阔构图：主体位于画面中心或黄金分割点，四周大量留白，突出主体本身，画面有呼吸感。"),
    LayoutPreset(Layout.BALANCED, "平衡分布", "平衡构图：主体与相关环境元素左右或上下均衡分布，画面稳定且有空间层次。"),
    LayoutPreset(Layout.DENSE, "密集有序", "饱满构图：主体周围布满相关的细节与小元素，画面丰富但不杂乱，有探索感。"),
    LayoutPreset(Layout.LIST, "竖向清单", "主次构图：主体占据主要位置，旁边或下方自然排列 2~4 个相关联的小视觉元素。"),
    LayoutPreset(Layout.COMPARISON, "左右对照", "对照构图：两个相关对象分居画面左右或上下，形成鲜明对比，背景统一。"),
    LayoutPreset(Layout.FLOW, "步骤流程", "流程构图：画面具有从左到右或从上到下的叙事方向，主体与路径、阶段图形共同推进。"),
    LayoutPreset(Layout.MINDMAP, "中心放射", "放射构图：中心主体向外放射出 3~5 条关联线，连接周围相关元素，整体呈网络状。"),
    LayoutPreset(Layout.QUADRANT, "四象限", "四象限构图：画面自然分成四个视觉区域，每个区域放置一个相关元素或场景片段。"),
    LayoutPreset(Layout.BIG_NUMBER, "数字主视觉", "数字主视觉构图：一个巨大的、图形化的数量意象或符号作为画面核心，主体环绕其周围。"),
)

private val LAYOUT_HINT: Map<Layout, String> = LAYOUTS.associate { it.id to it.hint }

/** 每个模块类型 → 默认布局（拆解时写入，UI 可改）。用更丰富的构图打破单一感。 */
val DEFAULT_LAYOUT: Map<ModuleType, Layout> = mapOf(
    ModuleType.COVER to Layout.SPARSE,
    ModuleType.DEFINITION to Layout.BALANCED,
    ModuleType.FACT to Layout.LIST,
    ModuleType.STEP to Layout.FLOW,
    ModuleType.COMPARE to Layout.COMPARISON,
    ModuleType.TIMELINE to Layout.FLOW,
    ModuleType.STAT to Layout.BIG_NUMBER,
    ModuleType.QUOTE to Layout.SPARSE,
    ModuleType.TIP to Layout.BALANCED,
    ModuleType.SECTION to Layout.DENSE,
)

/** 各类型的版式构图提示：强调不同镜头/场景/构图，避免每张都像证件照 */
private val TYPE_HINT: Map<ModuleType, String> = mapOf(
    ModuleType.COVER to "封面页：开阔场景，主视觉与环境共同构成整体氛围，有空间纵深感，像一幅完整的场景插画，大标题醒目地融入画面上方或中央。",
    ModuleType.DEFINITION to "定义页：清晰展示概念核心，可以是剖面、内部结构、特写或主体在环境中的典型状态，标题和定义文字融入画面。",
    ModuleType.FACT to "知识点页：主体在真实场景中呈现，允许相关配角元素或环境细节辅助说明，标题和要点文字清晰排列在画面中。",
    ModuleType.STEP to "步骤页：动态场景，主体正在执行某个动作，画面有方向感和先后次序，步骤文字编号融入流程。",
    ModuleType.COMPARE to "对比页：两个相关对象并列或分屏呈现，形成视觉对照，对比标签文字融入画面。",
    ModuleType.TIMELINE to "时间线页：同一主体在时间中的变化，或按阶段展开的场景序列感，时间节点文字标注融入画面。",
    ModuleType.STAT to "数据页：用一个巨大的视觉符号或数量意象作为核心，主体围绕它组织，数字与标签文字醒目地融入画面。",
    ModuleType.QUOTE to "金句页：与金句含义直接对应的具象场景，金句文字以优美排版融入画面，主体与场景自然融合。",
    ModuleType.TIP to "贴士页：轻量生活化小场景，主体与一两个提示性小元素自然互动，贴士文字融入画面。",
    ModuleType.SECTION to "分节页：与分节主题直接相关的具象场景，有形式感，分节标题文字融入画面。",
)

/** 各类型的默认比例（拆解服务也用它） */
val TYPE_DEFAULT_RATIO: Map<ModuleType, Ratio> = mapOf(
    ModuleType.COVER to Ratio.R3X4,
    ModuleType.DEFINITION to Ratio.R4X3,
    ModuleType.FACT to Ratio.R1X1,
    ModuleType.STEP to Ratio.R9X16,
    ModuleType.COMPARE to Ratio.R16X9,
    ModuleType.TIMELINE to Ratio.R4X3,
    ModuleType.STAT to Ratio.R3X4,
    ModuleType.QUOTE to Ratio.R3X4,
    ModuleType.TIP to Ratio.R1X1,
    ModuleType.SECTION to Ratio.R3X4,
)

// ===== 单模块生图提示词 =====

/** buildImagePrompt 选项 */
data class ImagePromptOptions(
    val anchor: Boolean = false
)

/**
 * 生成 Agnes 提示词（图文一体分支）：精简结构，去掉重复，每句话只说一件事。
 * 结构：风格基底 → 构图场景 → 画面文字 → 禁止项
 */
fun buildImagePrompt(
    m: DecomposedModule,
    style: ModuleStyle,
    opts: ImagePromptOptions? = null
): String {
    val parts = mutableListOf<String>()

    // 1. 风格基底
    parts.add("一幅${style.artStyle}风格的知识卡片插画。配色：${style.palette}。整体氛围：${style.mood}。")

    // 2. 构图 + 场景（合并 TYPE_HINT 与 LAYOUT_HINT，去重复）
    val compose = jsTrim("${TYPE_HINT[m.type] ?: ""} ${LAYOUT_HINT[m.layout] ?: ""}")
    if (compose.isNotEmpty()) parts.add(compose)

    // 3. 核心场景（visualHint）
    if (m.visualHint.isNotEmpty()) {
        parts.add("画面主体与场景：${m.visualHint}。与主体直接相关的细节要丰富，无关装饰不要加。")
    }

    // 4. 光照 + 镜头 + 材质（各一句话）
    style.lighting?.ifEmpty { null }?.let { parts.add("光照：$it。") }
    style.camera?.ifEmpty { null }?.let { parts.add("视角：$it。") }
    style.material?.ifEmpty { null }?.let { parts.add("材质：$it。") }

    // 5. 画面文字（标题 + 正文 + 要点 + 图标，一句话写完）
    val textParts = mutableListOf<String>()
    textParts.add("「${m.title}」作为最大标题文字渲染在画面中")
    if (m.body.isNotEmpty()) textParts.add("，正文「${m.body}」字号次之，放在标题下方")
    if (m.bullets.isNotEmpty()) {
        val bulletList = m.bullets.mapIndexed { i, b -> "${i + 1}. $b" }.joinToString("、")
        textParts.add("，要点「$bulletList」字号最小，竖向排列")
    }
    if (m.icon.isNotEmpty()) textParts.add("，可融入「${m.icon}」图标作为装饰")
    textParts.add("。所有文字清晰可读，大小有层级，与插画风格融为一体。")
    parts.add(textParts.joinToString(""))

    // 6. 锚点参考
    if (opts?.anchor == true) {
        parts.add("本系列已有锚点图作为参考，保持配色和画风统一；但内容按主体全新构图。")
    }

    // 7. 禁止项
    parts.add("禁止：标注线、说明线、指示线、无关装饰、抽象色块、纯装饰性边框。")

    return parts.joinToString(" ")
}

// ===== 整页提示词：页码角标 =====

/** 页码角标位置 */
enum class PageBadgePos(val raw: String) {
    TL("tl"),
    TC("tc"),
    TR("tr"),
    BL("bl"),
    BC("bc"),
    BR("br");

    companion object {
        fun fromRaw(v: String?): PageBadgePos? = entries.firstOrNull { it.raw == v }
    }
}

/** 页码角标格式 */
enum class PageBadgeFormat(val raw: String) {
    CN("cn"),
    SLASH("slash"),
    DOT("dot");

    companion object {
        fun fromRaw(v: String?): PageBadgeFormat? = entries.firstOrNull { it.raw == v }
    }
}

private val POS_WORDS: Map<PageBadgePos, String> = mapOf(
    PageBadgePos.TL to "左上角",
    PageBadgePos.TC to "上边缘正中",
    PageBadgePos.TR to "右上角",
    PageBadgePos.BL to "左下角",
    PageBadgePos.BC to "下边缘正中",
    PageBadgePos.BR to "右下角",
)

internal fun badgeLabel(fmt: PageBadgeFormat, n: Int, total: Int): String = when (fmt) {
    PageBadgeFormat.SLASH -> "$n / $total"
    PageBadgeFormat.DOT -> "$n · $total"
    PageBadgeFormat.CN -> "第 $n / $total 页"
}

// ===== 版面描述清洗 =====

private val HINT_SPLIT_RE = Regex("[，。；、]")
private val HINT_BLANK_RE = Regex("留白|空白|空出|空隙|不放置|无需内容|轻微纹理")

/**
 * 清洗拆解模型产出的布局描述：剔除「底部留白」「大面积空白」这类句子。
 * 生图模型会忠实执行这些指令，导致画面出现无内容的空白带（实测踩坑）。
 */
internal fun sanitizeLayoutHint(hint: String): String =
    hint.split(HINT_SPLIT_RE)
        .filter { jsTrim(it).isNotEmpty() && !HINT_BLANK_RE.containsMatchIn(it) }
        .joinToString("，")

// ===== 风格圣经 / 锚点图 =====

/** 统一负面约束：全系列共用，逐张写入提示词末尾，防止风格漂移 */
internal const val NEGATIVE_UNIFIED: String =
    "负面约束（全图一致）：无 3D 渲染、无照片写实、无阴暗色调、无乱码错别字、无模糊扭曲图形、无杂乱背景，禁止逐张更换背景色、字体与配色方案。"

/**
 * 系列统一设定块（风格圣经）：只由 style 推导，同一 style 输出逐字一致，
 * 在同组每一张提示词开头原样复用。这是「同组生图一致」的主抓手。
 * 锁死五件事：背景、配色角色、标题处理、卡片样式、装饰与字体。
 */
fun buildSeriesBible(style: ModuleStyle): String {
    val background = style.background
    val bg = if (background.isNullOrEmpty()) "同一干净纯色底" else "$background 纯色底"
    return listOf(
        "【系列统一设定 · 同组每张逐字复用，禁止逐张改动】",
        "画风：${style.artStyle}，全系列一致。",
        "背景：全部图固定同一$bg；不得逐张更换背景颜色，不得添加点阵、网格、纸张纹理、笔记本孔等背景变化。",
        "配色（固定色彩角色，全图一致）：仅使用这套调色板——${style.palette}。其中主色用于主标题文字与卡片标题条，辅色用于卡片描边与分隔，强调色用于小图标与高亮数字，最浅色用于卡片底色。严禁逐张更换配色方案或临时引入新颜色。",
        "标题处理：全系列统一——主标题大号粗体（主色），下方一行小字副标题，配手绘下划线装饰；每张同一处理手法。",
        "卡片样式：统一为白色圆角卡片 + 轻微投影 + 一致圆角，卡片顶部一条彩色标题条；卡片风格、圆角、间距全图一致。",
        "装饰与字体：统一装饰词汇（${style.material.orEmpty().ifEmpty { "手绘小图标、引线" }}），统一字体（${style.typography.ifEmpty { "圆润手写风" }}），不逐张新增无关装饰。",
    ).joinToString(" ")
}

/**
 * 确定性的系列副标题文案：生图 prompt 必须给出具体副标题文字，
 * 否则生图模型每次自行发挥、同一张多次生成副标题会漂移（多次生图实测踩坑）。
 */
internal fun seriesSubtitle(
    hasCover: Boolean,
    seriesTitle: String? = null,
    totalPages: Int? = null
): String = if (hasCover) {
    val p = if (totalPages != null && totalPages > 0) "$totalPages 页" else "全系列"
    "知识图解 · $p"
} else {
    seriesTitle.orEmpty().ifEmpty { "知识图解" }
}

/**
 * 风格锚点图提示词：先出这一张封面锁定整组风格，
 * 之后每张生成时把它当「参考图」上传（I2I），把一致性拉到接近 Codex 的像素级。
 */
fun buildAnchorPrompt(seriesTitle: String, style: ModuleStyle): String {
    val subtitle = seriesSubtitle(hasCover = true)
    val parts = mutableListOf<String>()
    parts.add("【风格锚点图 · 请先生成这一张，之后所有页面都把它作为参考图】")
    parts.add(buildSeriesBible(style))
    parts.add(
        "构图（系列封面）：顶部大字号系列主标题「$seriesTitle」（主色、粗体、手绘下划线），下方一行副标题「$subtitle」（此副标题文字为固定内容，不得更改或临场发挥）；" +
            "中部为整组 3-5 个核心知识点卡片预览（与后续页同款白色圆角卡片，每张含彩色标题条 + 简短文字）；" +
            "底部一条通栏横幅写一句系列总结（固定格式：只能是一句连贯的话，8~14 字）；内容铺满画布，边缘不得留空白带。"
    )
    style.lighting?.ifEmpty { null }?.let { parts.add("光照：$it。") }
    style.camera?.ifEmpty { null }?.let { parts.add("视角：$it。") }
    parts.add(NEGATIVE_UNIFIED)
    parts.add("本张为整组风格锚点，后续每张都需与它的配色、字体、卡片样式、背景、装饰语言完全一致。")
    return parts.joinToString(" ")
}

/** 参考图工作流引导：在 UI 展示，也写进批量导出头部 */
val REFERENCE_WORKFLOW: String =
    "一致性使用步骤：1) 先用「风格锚点图」提示词在千问生成一张，锁定整组风格；" +
        "2) 生成后续每一页时，把这张锚点图作为「参考图」上传（千问支持参考图/多图输入），再粘贴该页提示词；" +
        "3) 锚点图保证吉祥物、配色、版式像素级一致，每张开头的「系列统一设定」块作为兜底，防止风格漂移。"

// ===== 页面结构词剥离 =====

/** 从页面标题中剥离结构/功能词前缀（封面/首页/目录/引言/总结 等），让画面主标题只反映内容主题 */
internal val PAGE_ROLE_WORDS: List<String> = listOf(
    "封面", "首页", "目录", "引言", "导语", "前言", "开篇", "结尾", "结语", "收尾",
    "总结", "概述", "总览", "综述", "开屏", "intro", "index"
)

private val ROLE_SEPARATORS = "[、，,；;:：/・·|]"
private val CONNECTIVE_RE = Regex("^[与及和、，,；;。．]+")

internal fun stripPageRoleWord(raw: String): String {
    if (raw.isEmpty()) return ""
    var t = jsTrim(raw)
    // 反复剥离开头的结构词（含 "封面与/"封面、/"封面：" 等分隔）
    var changed = true
    while (changed) {
        changed = false
        for (w in PAGE_ROLE_WORDS) {
            if (t == w) {
                t = ""
                changed = true
                break
            }
            val re = Regex("^$w[$JS_WS]*${ROLE_SEPARATORS}?[$JS_WS]*")
            if (re.containsMatchIn(t)) {
                t = re.replaceFirst(t, "")
                changed = true
                break
            }
        }
    }
    // 剩余若是纯连接词（与/及/和）开头，也剥掉，避免出现「与定义」这类残段
    return jsTrim(CONNECTIVE_RE.replaceFirst(t, ""))
}

// ===== 整页提示词 =====

/** buildPagePrompt 选项 */
data class PagePromptOptions(
    /** 用户上传了锚点参考图 */
    val anchor: Boolean = false,
    /** 系列标题：封面页（含 cover 模块）用它作主标题，避免「封面与定义」这类结构词混入画面文字 */
    val seriesTitle: String? = null,
    val pageNumber: Int? = null,
    val totalPages: Int? = null,
    val pagePos: PageBadgePos? = null,
    val pageFormat: PageBadgeFormat? = null
)

/**
 * 生成多模块手抄报式提示词：多个知识模块融合在一张图里，
 * 每个模块是独立的内容板块，信息密度高。
 */
fun buildPagePrompt(
    page: CardPage,
    modules: List<DecomposedModule>,
    style: ModuleStyle,
    opts: PagePromptOptions? = null
): String {
    val parts = mutableListOf<String>()

    // 主标题决策：封面页用系列标题；非封面页用页面标题（并剥离轻量的页面结构词前缀）
    val hasCover = modules.any { it.type == ModuleType.COVER }
    val seriesTitle = opts?.seriesTitle
    val mainTitle = if (hasCover && !seriesTitle.isNullOrEmpty()) seriesTitle else stripPageRoleWord(page.title)
    val subtitle = seriesSubtitle(hasCover, seriesTitle, opts?.totalPages)

    // 1. 系列统一设定块（逐字复用，同组一致的主抓手）
    parts.add(buildSeriesBible(style))

    // 2. 固定版式骨架（不再由逐页 visualHint 决定，消除版式随机漂移）
    parts.add(
        "本张版面（全系列统一骨架）：顶部标题区——大号主标题「$mainTitle」+ 下方一行副标题「$subtitle」（此副标题文字为固定内容，不得更改或临场发挥）+ 手绘下划线；" +
            "中部为 ${modules.size} 个白色圆角内容卡片，按网格/纵向排布，每张卡片顶部一条彩色标题条、下方为正文或要点，卡片大小与间距一致；" +
            "底部一条通栏横幅承载本页一句话总结（固定格式：只能是一句连贯的话，8~14 字，概括本页模块共同主题；全页仅此一句，不得写成列表、分条或成段）。内容铺满整个画布：顶部、中部、底部都要有信息或插画承载，画面任何边缘不得出现无内容的空白带。"
    )

    // 2.5 页码编号（可选）：位置精确到角，样式全图一致
    if (opts != null && opts.pageNumber != null && opts.totalPages != null && opts.totalPages > 0) {
        val pos = POS_WORDS[opts.pagePos ?: PageBadgePos.TR]
        val label = badgeLabel(opts.pageFormat ?: PageBadgeFormat.CN, opts.pageNumber, opts.totalPages)
        parts.add(
            "在画面${pos}、紧贴边缘约 5% 边距处，单独显示一行很小的文字「$label」：" +
                "纯文字、无底纹、无边框，字号约为模块标题的三分之一，颜色与画面正文文字色一致，手绘笔触；" +
                "该编号全图仅出现这一次，数字必须与「$label」完全一致，不得改写、增删或重复。"
        )
    }

    // 3. 逐页内容槽（唯一逐张变化的部分）
    modules.forEachIndexed { i, m ->
        val sections = mutableListOf<String>()
        sections.add("卡片${i + 1}「${m.title}」")
        if (m.body.isNotEmpty()) sections.add(m.body)
        if (m.bullets.isNotEmpty()) {
            sections.add("要点：" + m.bullets.mapIndexed { j, b -> "${j + 1}. $b" }.joinToString("、"))
        }
        parts.add(sections.joinToString("，") + "。")
    }

    // 3.5 本页主体配图（visualHint 降级为卡片插画素材，不再决定布局）
    if (page.visualHint.isNotEmpty()) {
        val cleaned = sanitizeLayoutHint(page.visualHint)
        if (cleaned.isNotEmpty()) {
            parts.add("本页卡片内插画主体：$cleaned。（仅作为卡片内的插画素材，不改变上述统一版面骨架与配色角色。）")
        }
    }

    // 4. 光照 + 镜头（风格级，全系列一致）
    style.lighting?.ifEmpty { null }?.let { parts.add("光照：$it。") }
    style.camera?.ifEmpty { null }?.let { parts.add("视角：$it。") }

    // 5. 文字层级
    parts.add("所有文字清晰可读，大小有层级（卡片标题最大、正文中等、要点稍小），与插画风格融为一体。")

    // 6. 锚点参考（用户上传参考图时，这一行强化「对齐锚点」）
    if (opts?.anchor == true) {
        parts.add("本系列已有锚点图作为参考，严格对齐其配色、字体、卡片样式、背景与装饰语言；仅内容按本页全新组织。")
    }

    // 7. 统一负面约束
    parts.add(NEGATIVE_UNIFIED)
    parts.add("禁止：标注线、说明线、指示线、抽象色块、纯装饰性边框、大面积空白、无内容的空白带。")

    return parts.joinToString(" ")
}

// ===== 风格推荐引擎 =====

private data class StyleRule(
    val keywords: List<String>,
    val presetId: String,
    val reason: String,
    val weight: Int
)

private val STYLE_RULES: List<StyleRule> = listOf(
    // 传统/历史/文化
    StyleRule(listOf("古法", "传统", "历史", "古代", "文化", "非遗", "传承", "古典", "民俗", "国风", "汉服", "书法", "节气", "节日"), "ink", "传统主题适合国风水墨，体现文化底蕴", 3),
    StyleRule(listOf("木刻", "雕版", "年画", "版画"), "woodcut", "匹配版画主题", 3),
    StyleRule(listOf("考古", "文物", "碑文", "铭文", "甲骨", "青铜"), "engraving", "考古文物适合蚀刻版画风格", 3),

    // 科技/技术
    StyleRule(listOf("科技", "技术", "代码", "编程", "算法", "程序", "软件", "HTTP", "TCP", "协议", "服务器", "网络", "计算机", "互联网", "API", "前端", "后端", "数据库", "人工智能", "AI", "机器学习"), "cyber", "科技主题适合赛博霓虹风格", 3),

    // 架构/系统
    StyleRule(listOf("架构", "系统", "部署", "微服务", "容器", "云", "DevOps", "K8s", "Docker"), "isometric", "系统架构适合等距三维风格", 3),
    StyleRule(listOf("数据", "分析", "报表", "统计", "可视化", "指标", "监控"), "flat-design", "数据分析适合扁平化设计", 3),

    // 美食/烹饪
    StyleRule(listOf("美食", "食物", "烹饪", "料理", "菜谱", "食材", "豆腐", "茶", "酒", "咖啡", "烘焙", "面包", "菜", "饭", "面", "汤", "糖", "酱", "糕点", "点心"), "doodle", "美食制作适合手绘涂鸦风格，亲切易懂", 2),
    StyleRule(listOf("甜品", "蛋糕", "巧克力", "冰淇淋", "饮品"), "watercolor", "甜品饮品适合水彩风格，柔和精致", 2),

    // 自然/生态
    StyleRule(listOf("自然", "植物", "花", "树", "动物", "昆虫", "海洋", "森林", "生态", "环境", "生物", "鸟", "鱼"), "watercolor", "自然主题适合水彩风格，柔和灵动", 2),
    StyleRule(listOf("风景", "田园", "乡村", "四季", "山水", "花园"), "ghibli", "田园风景适合吉卜力风格，温暖治愈", 2),

    // 医学/健康
    StyleRule(listOf("医学", "健康", "人体", "疾病", "症状", "治疗", "药", "解剖", "生理", "医院", "养生", "中医"), "flat", "医学主题适合专业医学插画风格", 3),

    // 教育/科普
    StyleRule(listOf("科普", "教学", "教育", "知识", "学习", "课程", "考试", "学生", "笔记", "复习"), "journal", "教育科普适合子弹手帐风格", 2),
    StyleRule(listOf("清单", "盘点", "一览", "汇总", "总结", "入门", "零基础", "知识点", "要素", "几招", "几个"), "infographic", "清单/盘点类内容适合手绘信息图，分区清晰、有拟物小插画好记", 2),

    // 儿童/故事
    StyleRule(listOf("儿童", "童话", "故事", "寓言", "卡通", "动漫", "绘本", "宝宝", "亲子"), "picturebook", "儿童故事适合绘本风格", 3),

    // 流程/步骤（通用，权重低）
    StyleRule(listOf("流程", "步骤", "教程", "操作", "指南", "方法", "工序", "工艺", "怎么做", "制作"), "isometric", "流程步骤适合等距三维风格，结构清晰", 1),

    // 艺术/设计
    StyleRule(listOf("艺术", "设计", "美学", "色彩", "构图", "创意", "美术"), "bauhaus", "艺术设计适合包豪斯风格", 2),

    // 旅行/地理
    StyleRule(listOf("旅行", "旅游", "地理", "城市", "建筑", "地图", "景点", "游记"), "ghibli", "旅行主题适合吉卜力风格，温暖治愈", 2),

    // 商业/金融
    StyleRule(listOf("商业", "金融", "市场", "经济", "股票", "投资", "财务", "营销", "品牌"), "flat-design", "商业主题适合扁平化设计", 2),

    // 情感/心理
    StyleRule(listOf("心理", "情绪", "情感", "关系", "沟通", "社交"), "doodle", "情感心理适合手绘涂鸦风格，亲切温暖", 2),

    // 对比/区别
    StyleRule(listOf("对比", "区别", "差异", "vs", "VS", "Vs", "比较", "证书"), "flat-design", "对比类主题适合扁平化设计，双栏排版清晰", 2),

    // 物理/化学
    StyleRule(listOf("物理", "化学", "实验", "分子", "原子", "反应", "力学", "光学"), "flat-design", "理化实验适合扁平化设计", 3),

    // 运动/健康生活
    StyleRule(listOf("运动", "健身", "跑步", "瑜伽", "体育", "锻炼"), "doodle", "运动健身适合手绘涂鸦风格", 2),
)

/** recommendStyle 返回值 */
data class StyleRecommendation(
    val presetId: String,
    val reason: String
)

private class ScoreEntry(var score: Int, var reason: String)

fun recommendStyle(input: String): StyleRecommendation? {
    val text = input.lowercase()
    val scores = LinkedHashMap<String, ScoreEntry>()

    for (rule in STYLE_RULES) {
        for (kw in rule.keywords) {
            if (text.contains(kw.lowercase())) {
                val cur = scores[rule.presetId]
                val newScore = (cur?.score ?: 0) + rule.weight
                if (cur == null || newScore > cur.score) {
                    scores[rule.presetId] = ScoreEntry(newScore, rule.reason)
                } else {
                    cur.score = newScore
                }
            }
        }
    }

    // 无命中时返回 null（界面不显示推荐条，避免误导成某个特定风格）
    var bestId: String? = null
    var bestScore = 0
    var bestReason = ""
    for ((id, entry) in scores) {
        if (entry.score > bestScore) {
            bestScore = entry.score
            bestId = id
            bestReason = entry.reason
        }
    }

    val presetId = bestId ?: return null
    return StyleRecommendation(presetId, bestReason)
}

// jsTrim / JS_WS 收敛在 TextUtil.kt（全模块共用，与 JS \s/trim 语义对齐）
