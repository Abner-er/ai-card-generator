package com.aicard.data

import com.aicard.domain.countChars
import com.aicard.domain.trimTitle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.nio.charset.Charset
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * 正文提取器——逐函数直译 vite.config.ts L93-216 的正则清洗链路 + contentExtractor.ts 的后处理。
 *
 * Web 端的 /api/extract-url 中间件存在理由是绕浏览器 CORS；
 * Android 原生直连即可，整个后端中间件不迁移。
 *
 * 形态对齐说明：
 *  - extractArticle/pickTitle/htmlToText/decodeEntities/stripTags 五函数逐行直译
 *  - extractFromURL 的后处理（逐行 \\s+ 折叠、40 字门槛、detectTitle 兜底、wordCount=countChars）合并进来
 *  - contentExtractor.ts 的 parseMarkdownContent/detectTitle/detectSourceType 也直译
 *  - SSL 降级（rejectUnauthorized:false）不带过来（TS 注释自述为"本机开发环境"）
 *  - charset 解码：TS 用 TextDecoder(charset||utf-8)，Android 用 String(bytes, charset||UTF_8)
 */

data class ExtractResult(
    val title: String,
    val content: String,
    val sourceType: SourceType,
    val wordCount: Int,
)

enum class SourceType { PDF, MARKDOWN, TEXT, URL }

// ============ vite.config.ts 正则清洗链直译 ============

private val BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

/** HTML 实体解码——逐条直译 TS decodeEntities */
internal fun decodeEntities(s: String): String {
    var r = s
        .replace(Regex("&nbsp;"), " ")
        .replace(Regex("&lt;"), "<")
        .replace(Regex("&gt;"), ">")
        .replace(Regex("&quot;"), "\"")
        .replace(Regex("&#39;|&apos;"), "'")

    r = Regex("&#(\\d+);").replace(r) { mr ->
        val d = mr.groupValues[1].toIntOrNull() ?: return@replace " "
        try { String(Character.toChars(d)) } catch (_: Exception) { " " }
    }
    r = Regex("&#x([0-9a-f]+);", RegexOption.IGNORE_CASE).replace(r) { mr ->
        val d = mr.groupValues[1].toIntOrNull(16) ?: return@replace " "
        try { String(Character.toChars(d)) } catch (_: Exception) { " " }
    }
    // &amp; 必须最后解码（否则前面解码出的 < 会被 &amp; → & 再干扰）
    return r.replace(Regex("&amp;"), "&")
}

/** 剥标签：先去所有 <...> 再解码实体，最后折叠空白 */
internal fun stripTags(s: String): String =
    decodeEntities(s.replace(Regex("<[^>]*>"), " "))
        .replace(Regex("\\s+"), " ")
        .trim()

/**
 * HTML 片段 → 纯文本（保留段落换行）
 * 逐分支直译 TS htmlToText：script/style/comment→换行、br→换行、闭合块标签→换行、其余标签→空格
 */
internal fun htmlToText(seg: String): String {
    var s = seg
        .replace(Regex("<script[\\s\\S]*?</script>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("<style[\\s\\S]*?</style>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("<!--[\\s\\S]*?-->"), "\n")
        .replace(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("</(p|div|section|li|h[1-6]|blockquote|tr)>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("<[^>]*>"), " ")
    s = decodeEntities(s)
        // 兜底清掉伪标签（解码实体后可能重新出现 < > 片段）
        .replace(Regex("<[^>\\s]*>"), " ")
    return s.split("\n")
        .map { it.replace(Regex("\\s+"), " ").trim() }
        .filter { it.length >= 2 }
        .joinToString("\n")
}

/** 取标题：og:title → 微信 msg_title → <title>，三层兜底 */
internal fun pickTitle(html: String): String {
    val og = Regex(
        """<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']""",
        RegexOption.IGNORE_CASE,
    ).find(html)
        ?: Regex(
            """<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']""",
            RegexOption.IGNORE_CASE,
        ).find(html)
    if (og != null && og.groupValues[1].trim().isNotEmpty()) {
        return decodeEntities(og.groupValues[1]).trim()
    }
    val wx = Regex("""var\s+msg_title\s*=\s*['"]([^'"]+)['"]""").find(html)
    if (wx != null && wx.groupValues[1].trim().isNotEmpty()) {
        return decodeEntities(wx.groupValues[1]).trim()
    }
    val t = Regex("""<title[^>]*>([\s\S]*?)</title>""", RegexOption.IGNORE_CASE).find(html)
    if (t != null) return stripTags(t.groupValues[1])
    return ""
}

/**
 * 从 HTML 里抽出标题 + 正文
 * 优先级：微信公众号 #js_content → p|h|li|blockquote 标签正则 → 全文清洗
 * 200 字符门槛（TS 是 40）、20000 字截断
 */
internal fun extractArticle(html: String): Pair<String, String> {
    val title = pickTitle(html)
    var cleaned = html
        .replace(Regex("<script[\\s\\S]*?</script>", RegexOption.IGNORE_CASE), " ")
        .replace(Regex("<style[\\s\\S]*?</style>", RegexOption.IGNORE_CASE), " ")
        .replace(Regex("<!--[\\s\\S]*?-->"), " ")

    // 1) 微信公众号正文容器 #js_content
    val i = Regex("""id=["']js_content["']""", RegexOption.IGNORE_CASE).find(cleaned)?.range?.first ?: -1
    if (i >= 0) {
        val rest = cleaned.substring(i)
        val gt = rest.indexOf('>')
        val body = if (gt >= 0) rest.substring(gt + 1) else rest
        val e = Regex(
            """id=["']js_tags["']|id=["']js_temp_bottom_area["']|rich_media_tool|js_share_profile""",
            RegexOption.IGNORE_CASE,
        ).find(body)?.range?.first ?: -1
        val content = htmlToText(if (e > 200) body.substring(0, e) else body)
        if (content.length >= 40) return title to content.take(20000)
    }

    // 2) 段落级标签正则兜底
    val texts = mutableListOf<String>()
    val re = Regex("""<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)</\1>""", RegexOption.IGNORE_CASE)
    for (m in re.findAll(cleaned)) {
        val t = stripTags(m.groupValues[2])
        if (t.length >= 4) texts.add(t)
    }
    val seen = mutableSetOf<String>()
    val general = texts.filter { seen.add(it) }.joinToString("\n")
    if (general.length >= 40) return title to general.take(20000)

    // 3) 全文清洗兜底
    return title to htmlToText(cleaned).take(20000)
}

// ============ extractFromUrl（OkHttp 15s 超时直连） ============

/** 抓取网页正文——直译 vite extractFromUrlSafe + contentExtractor extractFromURL 后处理 */
suspend fun extractFromUrl(
    http: OkHttpClient,
    rawUrl: String,
): ExtractResult = withContext(Dispatchers.IO) {
    val url = rawUrl.trim()
    if (!url.startsWith("http://", true) && !url.startsWith("https://", true)) {
        throw IOException("请提供 http(s) 完整链接")
    }

    val req = Request.Builder()
        .url(url)
        .header("User-Agent", BROWSER_UA)
        .header("Accept", "text/html,application/xhtml+xml,*/*")
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .get()
        .build()

    val (rawContent, rawTitle) = http.newCall(req).awaitResponse().use { r ->
        if (!r.isSuccessful) throw IOException("目标站点返回 HTTP ${r.code}")
        val bytes = r.body?.bytes() ?: throw IOException("目标站点返回空响应体")
        val ctype = r.header("Content-Type") ?: ""
        val charset = Regex("charset=([\\w-]+)", RegexOption.IGNORE_CASE)
            .find(ctype)?.groupValues?.get(1)
        val cs = try {
            if (charset != null) Charset.forName(charset) else Charsets.UTF_8
        } catch (_: Exception) { Charsets.UTF_8 }
        val text = String(bytes, cs)
        val (t, c) = extractArticle(text)
        c to t
    }

    // contentExtractor.ts extractFromURL 后处理：逐行空白折叠
    val text = rawContent
        .split("\n")
        .map { it.replace(Regex("\\s+"), " ").trim() }
        .filter { it.isNotEmpty() }
        .joinToString("\n")
    if (text.isEmpty()) {
        throw IOException("未能提取到正文（页面可能需登录、被反爬拦截或为纯动态渲染）")
    }

    val title = rawTitle.trim().ifEmpty { detectTitle(text) }
    ExtractResult(
        title = title,
        content = text,
        sourceType = SourceType.URL,
        wordCount = countChars(text),
    )
}

// ============ contentExtractor.ts 后处理链直译 ============

/**
 * Markdown/文本解析——直译 TS parseMarkdownContent
 *
 * 【已知 quirk，原样保留】：image 规则排在 link 规则之后，
 * `![alt](url)` 会被 link 规则先吃掉变成 `!alt`，
 * 只有 `![](url)` 空 alt 才命中图片规则变 `[图片]`。
 * 这是 TS 母本的历史缺陷，直译保真不动。
 */
internal fun parseMarkdownContent(text: String, source: String?): ExtractResult {
    val cleanText = text
        .replace(Regex("```[\\s\\S]*?```"), "")
        .replace(Regex("`([^`]+)`")) { it.groupValues[1] }
        .replace(Regex("""\[([^\]]+)\]\([^)]+\)""")) { it.groupValues[1] }
        .replace(Regex("""!\[([^\]]*)\]\([^)]+\)""")) { "[图片]" }
        .replace(Regex("^#{1,6}\\s*.+$", RegexOption.MULTILINE), "")
        .replace(Regex("^[*-]\\s+.+$", RegexOption.MULTILINE), "")
        .replace(Regex("""\*\*([^*]+)\*\*""")) { it.groupValues[1] }
        .replace(Regex("""\*([^*]+)\*""")) { it.groupValues[1] }
        .replace(Regex("\n{3,}"), "\n\n")
        .trim()

    val title = detectTitle(text).ifEmpty { source ?: "提取内容" }
    return ExtractResult(
        title = title,
        content = cleanText,
        sourceType = detectSourceType(text),
        wordCount = countChars(cleanText),
    )
}

/** 直译 TS detectTitle：h1 → h2 → 首行非空文本 trimTitle(30) → "内容" */
internal fun detectTitle(text: String): String {
    Regex("^#\\s+(.+)$", RegexOption.MULTILINE).find(text)?.let {
        return it.groupValues[1].trim()
    }
    Regex("^##\\s+(.+)$", RegexOption.MULTILINE).find(text)?.let {
        return it.groupValues[1].trim()
    }
    val firstLine = text.split("\n").firstOrNull { it.trim().isNotEmpty() }
    if (firstLine != null && firstLine.length > 5) {
        return trimTitle(firstLine, "内容", 30)
    }
    return "内容"
}

/** 直译 TS detectSourceType */
internal fun detectSourceType(text: String): SourceType =
    if (text.contains("# ") || text.contains("## ") || text.contains("- ")) {
        SourceType.MARKDOWN
    } else {
        SourceType.TEXT
    }
