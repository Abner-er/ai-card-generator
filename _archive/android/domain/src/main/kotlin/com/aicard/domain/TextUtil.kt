package com.aicard.domain

// 对应 src/blocks/textUtil.ts —— 文本处理共享规则
// 所有涉及标题截断、字数统计的地方一律走本文件，禁止手写同类逻辑。
//
// 跨语言等价性：JS 的 trim()/\s 覆盖 NBSP(U+00A0)、全角空格(U+3000)、BOM(U+FEFF)，
// Java 的 String.trim()/Regex \s 不覆盖。为与 TS 产出一致，这里统一用 JS_WS 字符类。
internal const val JS_WS = "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"
private val TITLE_TRAILING = Regex("[，。、,;；:：!！？$JS_WS]+$")

/** 与 JS String.prototype.trim 等价的空白剥离（含 NBSP/全角空格/BOM） */
internal fun jsTrim(s: String): String = s.replace(Regex("^[$JS_WS]+|[$JS_WS]+$"), "")

/** 标题智能截断：
 * - 中文信息密度高，默认上限 32（可按场景收紧）；
 * - 若切断点落在英文/数字单词中间，回退到上一个空格，避免 "…7 v" 式断词；
 * - 去掉结尾悬挂的标点（，。、,;:!? 等），避免截出半句话。
 */
fun trimTitle(raw: String?, fallback: String = "", limit: Int = 32): String {
    val t = jsTrim(raw ?: "")
    if (t.isEmpty()) return fallback
    if (t.length <= limit) return t
    var cut = t.substring(0, limit)
    val nextCh = t[limit]
    val lastCh = cut[cut.length - 1]
    // 切断点两侧都是词字符 → 落在单词内部，回退到最近空格
    if (nextCh in 'A'..'Z' || nextCh in 'a'..'z' || nextCh in '0'..'9') {
        if (
            lastCh in 'A'..'Z' || lastCh in 'a'..'z' || lastCh in '0'..'9' ||
                lastCh == '&' || lastCh == '%' || lastCh == '.' || lastCh == '+' || lastCh == '-'
        ) {
            val sp = cut.lastIndexOf(' ')
            if (sp > 6) cut = cut.substring(0, sp)
        }
    }
    val trimmed = cut.replace(TITLE_TRAILING, "")
    return trimmed.ifEmpty { fallback }
}

/** 字数统计：非空白字符数。中文一字计一，英文按字母计（近似可读字数）。
 * 与 JS 的 replace(/\s/g) 口径完全一致（含 NBSP/全角空格/BOM）。 */
fun countChars(text: String?): Int =
    text?.let { Regex("[$JS_WS]").replace(it, "").length } ?: 0
