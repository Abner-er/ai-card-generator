package com.aicard.domain

// 对应 src/blocks/types.ts —— 「知识积木」核心类型（提示词+生图子集）
// 学习流程相关字段（fullBody/fullBullets/notes、LearnModule）属未来独立 App，本层不携带。

/** 模块类型：决定版式与生图提示词的构图 */
enum class ModuleType(val raw: String) {
    COVER("cover"),
    DEFINITION("definition"),
    FACT("fact"),
    STEP("step"),
    COMPARE("compare"),
    TIMELINE("timeline"),
    STAT("stat"),
    QUOTE("quote"),
    TIP("tip"),
    SECTION("section");

    companion object {
        fun fromRaw(v: String?): ModuleType? = entries.firstOrNull { it.raw == v }
    }
}

/** 支持的宽高比（决定每张模块图的构图与大小） */
enum class Ratio(val raw: String) {
    R1X1("1:1"),
    R3X4("3:4"),
    R4X3("4:3"),
    R9X16("9:16"),
    R16X9("16:9"),
    R2X3("2:3"),
    R3X2("3:2");

    companion object {
        fun fromRaw(v: String?): Ratio? = entries.firstOrNull { it.raw == v }
    }
}

/** 拼合节奏：模块在长图/面板里占据的宽度 */
enum class Span(val raw: String) {
    FULL("full"),
    HALF("half"),
    THIRD("third");

    companion object {
        fun fromRaw(v: String?): Span? = entries.firstOrNull { it.raw == v }
    }
}

/** 布局维度（与风格解耦）：决定模块图里文字与图形的空间排布骨架 */
enum class Layout(val raw: String) {
    SPARSE("sparse"),
    BALANCED("balanced"),
    DENSE("dense"),
    LIST("list"),
    COMPARISON("comparison"),
    FLOW("flow"),
    MINDMAP("mindmap"),
    QUADRANT("quadrant"),
    BIG_NUMBER("bigNumber");

    companion object {
        fun fromRaw(v: String?): Layout? = entries.firstOrNull { it.raw == v }
    }
}

/** 模块生成状态 */
enum class ModuleStatus {
    PENDING,
    GENERATING,
    DONE,
    ERROR
}

/** 信息区文字版式类型（代码叠字风格化，对应插画风格） */
enum class TextVariant(val raw: String) {
    MAGAZINE("magazine"),
    BUJO("bujo"),
    CHALK("chalk"),
    RISO("riso"),
    MINIMAL("minimal"),
    DATA("data");

    companion object {
        fun fromRaw(v: String?): TextVariant? = entries.firstOrNull { it.raw == v }
    }
}

/** 信息区字体栈类型 */
enum class ThemeFont(val raw: String) {
    SANS("sans"),
    SERIF("serif"),
    KAI("kai"),
    MONO("mono");

    companion object {
        fun fromRaw(v: String?): ThemeFont? = entries.firstOrNull { it.raw == v }
    }
}

/** 信息区文字版式主题：决定代码叠加标题/正文的视觉样式，与插画风格呼应 */
data class TextTheme(
    val variant: TextVariant,
    val bg: String,
    val cardBg: String,
    val titleColor: String,
    val bodyColor: String,
    val accent: String,
    val deco: String,
    val font: ThemeFont,
    val titleUnderline: Boolean? = null,
    val titleBlock: Boolean? = null
)

/** 系列风格：整套模块共享，保证视觉统一（搭积木不乱） */
data class ModuleStyle(
    val artStyle: String,
    val palette: String,
    val mood: String,
    val typography: String,
    val background: String? = null,
    val textTheme: TextTheme? = null,
    val lighting: String? = null,
    val camera: String? = null,
    val material: String? = null
)

/** LLM 拆解返回的结构（不含运行时字段） */
data class DecomposedModule(
    val id: String,
    val type: ModuleType,
    val title: String,
    val body: String,
    val bullets: List<String> = emptyList(),
    val icon: String = "",
    val visualHint: String = "",
    val ratio: Ratio,
    val layout: Layout
)

/** 一张图页：多个知识模块组成的手抄报式信息图 */
data class CardPage(
    val id: String,
    val title: String,
    val moduleIds: List<String>,
    val ratio: Ratio,
    val visualHint: String = ""
)

data class DecomposeResult(
    val seriesTitle: String,
    val seriesStyle: ModuleStyle,
    val modules: List<DecomposedModule>,
    val pages: List<CardPage>
)
