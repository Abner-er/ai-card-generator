package com.aicard.domain

// 对应 src/blocks/textDiff.ts —— 字符级 LCS 差异（selfCheck 改前/改后对比用）

enum class DiffKind { SAME, DEL, ADD }

data class DiffToken(val kind: DiffKind, val text: String)

/** diffTokens — 字符级 LCS 差异。中文按单字、英文/数字按下划线相连词整体，其余单字符兜底
 * 注意：TS 的 \s+ 会整体吃掉 NBSP/全角空格/BOM，Java \s 不会，故显式列字符类保持分词一致。 */
fun diffTokens(a: String, b: String): List<DiffToken> {
    val tokenRegex = Regex("[\\u4e00-\\u9fff]|[a-zA-Z0-9]+(?:[.%\\-][a-zA-Z0-9]+)*|[" + JS_WS + "]+|.")
    val ta = tokenRegex.findAll(a).map { it.value }.toList()
    val tb = tokenRegex.findAll(b).map { it.value }.toList()
    val n = ta.size
    val m = tb.size
    val dp = Array(n + 1) { IntArray(m + 1) }
    for (i in 1..n) {
        for (j in 1..m) {
            dp[i][j] = if (ta[i - 1] == tb[j - 1]) {
                dp[i - 1][j - 1] + 1
            } else {
                maxOf(dp[i - 1][j], dp[i][j - 1])
            }
        }
    }
    val out = mutableListOf<DiffToken>()
    var i = n
    var j = m
    while (i > 0 || j > 0) {
        when {
            i > 0 && j > 0 && ta[i - 1] == tb[j - 1] -> {
                out.add(DiffToken(DiffKind.SAME, ta[i - 1])); i--; j--
            }
            j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) -> {
                out.add(DiffToken(DiffKind.ADD, tb[j - 1])); j--
            }
            else -> {
                out.add(DiffToken(DiffKind.DEL, ta[i - 1])); i--
            }
        }
    }
    return out.reversed()
}
