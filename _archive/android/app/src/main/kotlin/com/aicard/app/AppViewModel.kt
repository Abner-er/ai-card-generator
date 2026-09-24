package com.aicard.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aicard.data.AppSettings
import com.aicard.data.GenerateImageOptions
import com.aicard.data.GeneratedImage
import com.aicard.data.ImageProviderId
import com.aicard.data.KeySlot
import com.aicard.data.MockCardText
import com.aicard.data.OpenAiCompatGateway
import com.aicard.data.ProxySettings
import com.aicard.data.SelfCheckOptions
import com.aicard.data.SelfCheckResult
import com.aicard.data.TextSettings
import com.aicard.data.ImageSettings
import com.aicard.data.extractFromUrl
import com.aicard.data.extractModelName
import com.aicard.data.maskKey
import com.aicard.data.placeholderOk
import com.aicard.data.resolveImageProvider
import com.aicard.data.selfCheckContent
import com.aicard.domain.CardPage
import com.aicard.domain.DecomposeResult
import com.aicard.domain.DecomposeOptions
import com.aicard.domain.KnowledgeDecomposer
import com.aicard.domain.ModuleType
import com.aicard.domain.PageBadgeFormat
import com.aicard.domain.PageBadgePos
import com.aicard.domain.PagePromptOptions
import com.aicard.domain.QualityReport
import com.aicard.domain.Ratio
import com.aicard.domain.StylePreset
import com.aicard.domain.StyleRecommendation
import com.aicard.domain.STYLE_PRESETS
import com.aicard.domain.buildAnchorPrompt
import com.aicard.domain.buildPagePrompt
import com.aicard.domain.checkQuality
import com.aicard.domain.getPreset
import com.aicard.domain.recommendStyle
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.first

class AppViewModel(private val container: AppContainer) : ViewModel() {
    private val http = container.http
    private val settingsStore = container.settingsStore
    private val keyStore = container.keyStore

    val settings: StateFlow<AppSettings> = settingsStore.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AppSettings())

    fun keyMasks(): Map<KeySlot, String> = KeySlot.entries.associateWith { keyStore.masked(it) }

    // ===== Input =====
    var inputText: String = ""
        private set
    var selectedPresetId: String = "flat"
        private set
    var styleRecommendation: StyleRecommendation? = null
        private set

    // ===== Decompose =====
    var decomposeResult: DecomposeResult? = null
        private set
    var isDecomposing: Boolean = false
        private set
    var decomposeError: String? = null
        private set

    // ===== Quality =====
    var qualityReport: QualityReport? = null
        private set
    var selfCheckResult: SelfCheckResult? = null
        private set
    var isSelfChecking: Boolean = false
        private set
    var selfCheckError: String? = null
        private set

    // ===== Adoption =====
    var adoptedIds: Set<String> = emptySet()
        private set
    private val undoStack = mutableListOf<AdoptRecord>()

    // ===== Prompts =====
    var anchorPrompt: String? = null
        private set
    var pagePrompts: Map<String, String> = emptyMap()
        private set

    // ===== Image generation =====
    var anchorImage: GeneratedImage? = null
        private set
    var pageImages: Map<String, GeneratedImage> = emptyMap()
        private set
    var imageProgress: Map<String, String> = emptyMap()
        private set
    var generatingPages: Set<String> = emptySet()
        private set
    var imageErrors: Map<String, String> = emptyMap()
        private set
    var isGeneratingAll: Boolean = false
        private set

    // ===== URL extraction =====
    var isExtracting: Boolean = false
        private set
    var extractError: String? = null
        private set

    // ===== Input actions =====
    fun updateInput(text: String) {
        inputText = text
        styleRecommendation = recommendStyle(text)
    }

    fun selectPreset(id: String) {
        selectedPresetId = id
    }

    // ===== Decompose =====
    fun generatePrompts() {
        if (inputText.isBlank() || isDecomposing) return
        isDecomposing = true
        decomposeError = null
        clearResult()
        viewModelScope.launch {
            try {
                val s = settings.value
                val preset = getPreset(selectedPresetId)
                val gateway = OpenAiCompatGateway(
                    http = http,
                    baseUrl = { s.proxy.textBaseUrl },
                    apiKey = { keyStore.get(KeySlot.AGNES) },
                )
                val decomposer = KnowledgeDecomposer(gateway)
                val result = decomposer.decompose(
                    input = inputText,
                    style = preset.style,
                    opts = DecomposeOptions(
                        mock = s.mock,
                        model = s.text.model,
                        temperature = s.text.temperature,
                    ),
                )
                decomposeResult = result
                qualityReport = checkQuality(result)
                rebuildPrompts(result)
            } catch (e: Exception) {
                decomposeError = e.message ?: e.toString()
            } finally {
                isDecomposing = false
            }
        }
    }

    // ===== URL extraction =====
    fun extractFromUrl(url: String) {
        if (url.isBlank() || isExtracting) return
        isExtracting = true
        extractError = null
        viewModelScope.launch {
            try {
                val result = extractFromUrl(http, url)
                inputText = result.content
                styleRecommendation = recommendStyle(result.content)
            } catch (e: Exception) {
                extractError = e.message ?: e.toString()
            } finally {
                isExtracting = false
            }
        }
    }

    // ===== Self-check =====
    fun runSelfCheck() {
        val result = decomposeResult ?: return
        if (isSelfChecking) return
        isSelfChecking = true
        selfCheckError = null
        selfCheckResult = null
        adoptedIds = emptySet()
        undoStack.clear()
        viewModelScope.launch {
            try {
                val s = settings.value
                val sc = selfCheckContent(
                    result = result,
                    http = http,
                    settings = s,
                    keys = { slot -> keyStore.get(slot) },
                    opts = SelfCheckOptions(mock = s.mock),
                )
                selfCheckResult = sc
            } catch (e: Exception) {
                selfCheckError = e.message ?: e.toString()
            } finally {
                isSelfChecking = false
            }
        }
    }

    // ===== Adoption =====
    fun adoptModule(moduleId: String) {
        val result = decomposeResult ?: return
        val improved = selfCheckResult?.improvedModules?.find { it.id == moduleId } ?: return
        if (moduleId in adoptedIds) return

        undoStack.add(AdoptRecord(moduleId, result))

        val updatedModules = result.modules.map { m ->
            if (m.id == moduleId) m.copy(
                title = improved.title ?: m.title,
                body = improved.body ?: m.body,
                bullets = improved.bullets ?: m.bullets,
            ) else m
        }
        val updatedResult = result.copy(modules = updatedModules)
        decomposeResult = updatedResult
        qualityReport = checkQuality(updatedResult)
        rebuildPrompts(updatedResult)
        adoptedIds = adoptedIds + moduleId
    }

    fun adoptAll() {
        val improved = selfCheckResult?.improvedModules ?: return
        improved.forEach { im -> adoptModule(im.id) }
    }

    fun undoAdopt() {
        val record = undoStack.removeLastOrNull() ?: return
        decomposeResult = record.before
        qualityReport = checkQuality(record.before)
        rebuildPrompts(record.before)
        adoptedIds = adoptedIds - record.moduleId
    }

    // ===== Image generation =====
    fun generateAnchorImage() {
        val result = decomposeResult ?: return
        if (anchorImage != null || isGeneratingAll) return
        val prompt = anchorPrompt ?: return
        generatingPages = generatingPages + "__anchor__"
        imageProgress = imageProgress + ("__anchor__" to "正在生图…")
        viewModelScope.launch {
            try {
                val s = settings.value
                val provider = resolveImageProvider(s, { slot -> keyStore.get(slot) }, http)
                val img = provider.generate(
                    prompt = prompt,
                    opts = GenerateImageOptions(
                        ratio = Ratio.R3X4,
                        mock = s.mock,
                        mockText = MockCardText(
                            title = result.seriesTitle,
                            body = "风格锚点",
                        ),
                        onProgress = { msg -> imageProgress = imageProgress + ("__anchor__" to msg) },
                    ),
                )
                anchorImage = img
                imageProgress = imageProgress - "__anchor__"
            } catch (e: Exception) {
                imageErrors = imageErrors + ("__anchor__" to (e.message ?: e.toString()))
                imageProgress = imageProgress - "__anchor__"
            } finally {
                generatingPages = generatingPages - "__anchor__"
            }
        }
    }

    fun generateImage(pageId: String) {
        val result = decomposeResult ?: return
        val page = result.pages.find { it.id == pageId } ?: return
        val prompt = pagePrompts[pageId] ?: return
        if (pageId in generatingPages) return
        generatingPages = generatingPages + pageId
        imageProgress = imageProgress + (pageId to "正在生图…")
        imageErrors = imageErrors - pageId
        viewModelScope.launch {
            try {
                val s = settings.value
                val provider = resolveImageProvider(s, { slot -> keyStore.get(slot) }, http)
                val img = provider.generate(
                    prompt = prompt,
                    opts = GenerateImageOptions(
                        ratio = page.ratio,
                        refImage = anchorImage?.bytes,
                        refImageMime = anchorImage?.mimeType ?: "image/png",
                        mock = s.mock,
                        mockText = MockCardText(
                            title = page.title,
                        ),
                        onProgress = { msg -> imageProgress = imageProgress + (pageId to msg) },
                    ),
                )
                pageImages = pageImages + (pageId to img)
                imageProgress = imageProgress - pageId
            } catch (e: Exception) {
                imageErrors = imageErrors + (pageId to (e.message ?: e.toString()))
                imageProgress = imageProgress - pageId
            } finally {
                generatingPages = generatingPages - pageId
            }
        }
    }

    fun generateAllImages() {
        val result = decomposeResult ?: return
        if (isGeneratingAll) return
        isGeneratingAll = true
        viewModelScope.launch {
            try {
                if (anchorImage == null && anchorPrompt != null) {
                    generateAnchorImage()
                    while ("__anchor__" in generatingPages) {
                        kotlinx.coroutines.delay(200)
                    }
                }
                result.pages.forEach { page ->
                    if (page.id !in pageImages) {
                        generateImage(page.id)
                        while (page.id in generatingPages) {
                            kotlinx.coroutines.delay(200)
                        }
                    }
                }
            } finally {
                isGeneratingAll = false
            }
        }
    }

    // ===== Settings =====
    fun saveSettings(updated: AppSettings) {
        viewModelScope.launch { settingsStore.save(updated) }
    }

    fun saveKey(slot: KeySlot, value: String) {
        keyStore.save(slot, value)
    }

    fun saveKeys(values: Map<KeySlot, String?>) {
        keyStore.saveKeys(values)
    }

    fun resetSettings() {
        viewModelScope.launch {
            settingsStore.reset()
            keyStore.clearAll()
        }
    }

    // ===== Reset =====
    fun clearResult() {
        decomposeResult = null
        qualityReport = null
        selfCheckResult = null
        selfCheckError = null
        adoptedIds = emptySet()
        undoStack.clear()
        anchorPrompt = null
        pagePrompts = emptyMap()
        anchorImage = null
        pageImages = emptyMap()
        imageProgress = emptyMap()
        imageErrors = emptyMap()
        generatingPages = emptySet()
    }

    // ===== Helpers =====
    private fun rebuildPrompts(result: DecomposeResult) {
        val style = result.seriesStyle
        anchorPrompt = buildAnchorPrompt(result.seriesTitle, style)
        val totalPages = result.pages.size
        pagePrompts = result.pages.mapIndexed { index, page ->
            val modules = page.moduleIds.mapNotNull { id -> result.modules.find { it.id == id } }
            val prompt = buildPagePrompt(
                page = page,
                modules = modules,
                style = style,
                opts = PagePromptOptions(
                    anchor = anchorImage != null,
                    seriesTitle = result.seriesTitle,
                    pageNumber = index + 1,
                    totalPages = totalPages,
                    pagePos = PageBadgePos.BR,
                    pageFormat = PageBadgeFormat.CN,
                ),
            )
            page.id to prompt
        }.toMap()
    }

    fun stylePresets(): List<StylePreset> = STYLE_PRESETS

    private data class AdoptRecord(val moduleId: String, val before: DecomposeResult)
}
