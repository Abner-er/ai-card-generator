package com.aicard.domain

// 对应 src/blocks/styleEngine.ts 的 STYLE_PRESETS 部分（原文件 L36-734）
// 中文措辞即产品 know-how，逐字保真是第一优先级：不得改写、不得调整字段顺序、不得合并近义表述。
// 未移植：fontStack / getTextTheme / getVariantDecoration / VariantDecoration（全仓零调用的死代码）。

/** UI 可选的风格预设（也作为拆解时的系列风格建议） */
data class StylePreset(
    val id: String,
    val label: String,
    val style: ModuleStyle
)

/**
 * UI 可选的风格预设（也作为拆解时的系列风格建议）。
 * 顺序与 TS 源文件数组顺序完全一致，共 28 套（getPreset 的回退依赖「第一套」= flat）。
 */
val STYLE_PRESETS: List<StylePreset> = listOf(
    StylePreset(
        id = "flat",
        label = "专业医学插画",
        style = ModuleStyle(
            artStyle = "专业医学插画、写实科学图示、清晰解剖风格",
            palette = "真实人体与医学色调、柔和低饱和、高可读",
            mood = "专业、清晰、可信赖",
            typography = "科学图示质感、细腻光影、干净边缘的医学插画材质",
            lighting = "柔和漫射工作室光照、均匀照明、无硬阴影、清晰可读",
            camera = "微距特写、科学纪录片视角、正面平视、剖面展开",
            material = "光滑科学插画质感、精准干净的边缘、真实器官与组织纹理",
            background = "#f7f7f5",
            textTheme = TextTheme(
                variant = TextVariant.MAGAZINE,
                bg = "#ffffff",
                cardBg = "#f7f7f5",
                titleColor = "#1a1a1a",
                bodyColor = "#444444",
                accent = "#2b2b2b",
                deco = "#2b2b2b",
                font = ThemeFont.SANS,
                titleUnderline = true
            )
        )
    ),
    StylePreset(
        id = "watercolor",
        label = "清新水彩",
        style = ModuleStyle(
            artStyle = "清新水彩手绘",
            palette = "米白底 + 柔和自然色（草绿/天蓝/暖橘）",
            mood = "治愈、温柔、文艺",
            typography = "水彩湿画法晕染、纸纹吸水、边缘自然扩散的柔和质感",
            lighting = "柔和自然日光、清晨暖光、温润漫射、无强对比",
            camera = "平视自然视角、柔焦背景、舒适自然的构图",
            material = "湿画法水彩晕染、纸张纤维吸水、半透明色层叠加、自然扩散边缘",
            background = "#fbf8f2",
            textTheme = TextTheme(
                variant = TextVariant.BUJO,
                bg = "#fdfbf7",
                cardBg = "#fbf8f2",
                titleColor = "#3a4a5a",
                bodyColor = "#4a5a6a",
                accent = "#6a8caf",
                deco = "#c98a8a",
                font = ThemeFont.KAI,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "clay",
        label = "3D 黏土",
        style = ModuleStyle(
            artStyle = "3D 黏土风格、圆润立体",
            palette = "暖色奶油 + 马卡龙点缀",
            mood = "可爱、温暖、童趣",
            typography = "哑光黏土表面、圆润立体、柔和漫反射的立体材质",
            lighting = "柔和工作室光照、带方向性高光、温暖环境光、次表面散射",
            camera = "四分之三角度、略俯视、玩具摄影视角、圆润立体感",
            material = "哑光黏土表面、柔和次表面散射、圆润雕塑形态、指痕纹理",
            background = "#fdf3ec",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#fffdfb",
                cardBg = "#fdf3ec",
                titleColor = "#5a4636",
                bodyColor = "#6a5648",
                accent = "#e8a87c",
                deco = "#e8a87c",
                font = ThemeFont.SANS,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "ink",
        label = "国风水墨",
        style = ModuleStyle(
            artStyle = "国风水墨、留白意境",
            palette = "宣纸米白 + 墨黑 + 印章红",
            mood = "雅致、沉静、有韵味",
            typography = "宣纸纤维纹理、水墨浓淡晕染、大面积留白的东方质感",
            lighting = "柔和漫射自然光、墨纸对比、内敛柔和的环境光",
            camera = "正面平视、卷轴画构图、居中对称、大面积留白",
            material = "宣纸纤维纹理、墨色浓淡渐变晕染、干笔飞白、墨溅边缘",
            background = "#f5f1e8",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#f5f1e8",
                cardBg = "#f5f1e8",
                titleColor = "#2b2b2b",
                bodyColor = "#4a4a4a",
                accent = "#9c2b2b",
                deco = "#9c2b2b",
                font = ThemeFont.SERIF,
                titleUnderline = true
            )
        )
    ),
    StylePreset(
        id = "cyber",
        label = "赛博霓虹",
        style = ModuleStyle(
            artStyle = "赛博朋克、霓虹光效",
            palette = "深蓝紫底 + 霓虹青/品红",
            mood = "科技、未来、酷炫",
            typography = "霓虹光晕、全息渐变、光滑数字表面的科技感材质",
            lighting = "霓虹辉光照明、高对比色光源、青色与品红边缘光、暗部深邃",
            camera = "戏剧性低角度、鱼眼畸变、动态荷兰式倾斜",
            material = "全息光泽表面、铬合金反射、LED 发光、玻璃与金属质感",
            background = "#14132b",
            textTheme = TextTheme(
                variant = TextVariant.CHALK,
                bg = "#14132b",
                cardBg = "#14132b",
                titleColor = "#6fe3ff",
                bodyColor = "#cfe8ff",
                accent = "#ff4fd8",
                deco = "#6fe3ff",
                font = ThemeFont.MONO
            )
        )
    ),
    StylePreset(
        id = "minimal",
        label = "极简线条",
        style = ModuleStyle(
            artStyle = "极简线条插画、大量留白",
            palette = "纯白 + 一点黑灰 + 单一强调色",
            mood = "干净、克制、高级",
            typography = "极简线条、大量留白、单一线描的克制质感",
            lighting = "均匀照明、左上柔和方向光、极简阴影",
            camera = "平视正面或俯视、居中构图、大量负空间",
            material = "干净矢量线条、平涂色块、无纹理、利落几何边缘",
            background = "#fafafa",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#ffffff",
                cardBg = "#fafafa",
                titleColor = "#111111",
                bodyColor = "#555555",
                accent = "#111111",
                deco = "#111111",
                font = ThemeFont.SANS
            )
        )
    ),
    StylePreset(
        id = "doodle",
        label = "手绘涂鸦",
        style = ModuleStyle(
            artStyle = "手绘涂鸦、马克笔勾线、手帐感",
            palette = "柔和粉彩、浅蓝/薄荷绿/奶油黄/浅粉",
            mood = "童趣、亲切、活泼",
            typography = "马克笔勾线、手绘笔触、轻微纸纹的涂鸦质感",
            lighting = "明亮均匀光照、活泼色彩光、无阴影",
            camera = "随性平视、快照构图、略微倾斜",
            material = "马克笔笔触、可见墨水渗透、纸张颗粒纹理、手绘轮廓线",
            background = "#fdf8f3",
            textTheme = TextTheme(
                variant = TextVariant.BUJO,
                bg = "#fffef9",
                cardBg = "#fdf8f3",
                titleColor = "#333333",
                bodyColor = "#555555",
                accent = "#ff8c42",
                deco = "#7ec8e3",
                font = ThemeFont.KAI
            )
        )
    ),
    StylePreset(
        id = "crayon",
        label = "蜡笔油画棒",
        style = ModuleStyle(
            artStyle = "蜡笔/油画棒质感、笔触明显、边缘微糙",
            palette = "浓艳暖色 + 白色底、高饱和但不刺眼",
            mood = "稚拙、温暖、有手工感",
            typography = "蜡笔油画棒笔触、边缘微糙、厚涂质感的手工材质",
            lighting = "温暖自然日光、柔和金色光晕、舒适环境光",
            camera = "儿童视角、朴素构图、略微倾斜",
            material = "厚蜡笔笔触、可见纸张齿痕、厚重覆盖质感、粗糙边缘",
            background = "#fffdf7",
            textTheme = TextTheme(
                variant = TextVariant.BUJO,
                bg = "#fffdf7",
                cardBg = "#fffdf7",
                titleColor = "#4a3b2a",
                bodyColor = "#5a4a38",
                accent = "#e0853e",
                deco = "#d9b44a",
                font = ThemeFont.KAI
            )
        )
    ),
    StylePreset(
        id = "journal",
        label = "子弹手帐",
        style = ModuleStyle(
            artStyle = "手帐手绘风、细腻笔触、圆点网格纹理、纸张肌理",
            palette = "莫兰迪彩 + 米白纸张、低饱和",
            mood = "自律、治愈、有条理",
            typography = "纸张纤维、细腻手绘线条、圆点网格纹理的手帐质感",
            lighting = "柔和台灯光照、温暖聚焦光晕、舒适环境光",
            camera = "俯视平铺、手帐页面视角、居中构图",
            material = "纸张圆点网格纹理、精细笔线、和纸胶带层叠、微妙纸纹",
            background = "#f6f2ea",
            textTheme = TextTheme(
                variant = TextVariant.BUJO,
                bg = "#f6f2ea",
                cardBg = "#f6f2ea",
                titleColor = "#4a5a4a",
                bodyColor = "#5a6a5a",
                accent = "#c2a878",
                deco = "#ffe08a",
                font = ThemeFont.KAI,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "picturebook",
        label = "儿童绘本",
        style = ModuleStyle(
            artStyle = "儿童绘本插画、圆润角色、温馨场景、故事感",
            palette = "暖黄/天蓝/草绿、明亮柔和",
            mood = "温馨、讲故事、易亲近",
            typography = "绘本柔和渲染、圆润造型、温馨光感的故事书质感",
            lighting = "温暖故事书光照、柔和金色时刻光晕、温柔阴影",
            camera = "广角叙事视角、与角色平视、沉浸式场景",
            material = "柔和数字绘画质感、圆润笔触、水彩式融合、平滑渐变",
            background = "#fef9f0",
            textTheme = TextTheme(
                variant = TextVariant.MAGAZINE,
                bg = "#fffdf8",
                cardBg = "#fef9f0",
                titleColor = "#5a3a2a",
                bodyColor = "#6a4a3a",
                accent = "#f0a040",
                deco = "#f0a040",
                font = ThemeFont.SANS,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "sketch",
        label = "铅笔素描",
        style = ModuleStyle(
            artStyle = "铅笔素描、细腻排线、纸纹质感、单色素描",
            palette = "石墨灰阶、米白纸、单一淡彩点缀",
            mood = "学院、沉静、理性",
            typography = "铅笔排线、石墨灰阶、纸纹的素描质感",
            lighting = "单一方向光源、明暗对比法、柔和渐变阴影",
            camera = "学院派研究视角、四分之三侧视、分析性构图",
            material = "石墨铅笔排线、交叉影线、纸张纤维纹理、涂抹的石墨色调",
            background = "#f7f4ee",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#f7f4ee",
                cardBg = "#f7f4ee",
                titleColor = "#444444",
                bodyColor = "#5a5a5a",
                accent = "#666666",
                deco = "#888888",
                font = ThemeFont.SERIF
            )
        )
    ),
    StylePreset(
        id = "penwash",
        label = "钢笔淡彩",
        style = ModuleStyle(
            artStyle = "钢笔淡彩、线稿 + 淡淡水彩晕染",
            palette = "留白多、淡蓝/淡褐/淡绿、墨线勾勒",
            mood = "文艺、精致、博物志",
            typography = "钢笔淡墨线稿、淡淡水彩晕染、纸纹的博物志质感",
            lighting = "明亮自然日光、柔和漫射、轻微阴影",
            camera = "博物学插画视角、平视或略微四分之三视角",
            material = "钢笔墨线稿、淡淡水彩晕染、纸张纹理、精准笔触、透明色层",
            background = "#faf7f1",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#faf7f1",
                cardBg = "#faf7f1",
                titleColor = "#5a5040",
                bodyColor = "#6a6050",
                accent = "#8a9a8a",
                deco = "#8a9a8a",
                font = ThemeFont.SERIF
            )
        )
    ),
    StylePreset(
        id = "collage",
        label = "纸拼贴",
        style = ModuleStyle(
            artStyle = "纸艺拼贴质感、不同纸张的撕边与层叠、丰富纸纹肌理",
            palette = "米色牛皮纸 + 彩色卡纸、低饱和拼贴色",
            mood = "复古、手工、个性",
            typography = "撕边纸张层叠、纸纹肌理、拼贴边缘的纸艺质感",
            lighting = "侧面斜射光、纸张层间投射阴影、有质感的照明",
            camera = "俯视平铺、略微倾斜、拼贴画构图",
            material = "撕边纸张边缘、层叠卡纸、瓦楞纸板、薄纸、胶水痕迹",
            background = "#efe7d8",
            textTheme = TextTheme(
                variant = TextVariant.RISO,
                bg = "#efe7d8",
                cardBg = "#efe7d8",
                titleColor = "#3a3a3a",
                bodyColor = "#4a4a4a",
                accent = "#d98324",
                deco = "#4a7a9a",
                font = ThemeFont.SERIF,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "chalkboard",
        label = "黑板粉笔",
        style = ModuleStyle(
            artStyle = "粉笔手绘质感、深墨绿底、白/黄/粉粉笔线条与笔触、粉画风",
            palette = "深墨绿/深灰底 + 白/黄/粉粉笔色",
            mood = "课堂、教学、亲切",
            typography = "粉笔飞白笔触、深墨绿底、粉质纹理的粉笔质感",
            lighting = "粉笔粉尘环境光、柔和教室照明、粉笔痕迹微微发光",
            camera = "正面教室视角、居中构图",
            material = "粉笔粉末质感、涂抹粉笔痕、黑板擦条纹、深哑光石板表面",
            background = "#33403a",
            textTheme = TextTheme(
                variant = TextVariant.CHALK,
                bg = "#33403a",
                cardBg = "#33403a",
                titleColor = "#f5f5f0",
                bodyColor = "#e8e8e0",
                accent = "#ffd86b",
                deco = "#ffd86b",
                font = ThemeFont.KAI
            )
        )
    ),
    StylePreset(
        id = "riso",
        label = "复古印刷",
        style = ModuleStyle(
            artStyle = "Risograph 复古印刷、套色错位、网点颗粒",
            palette = "荧光粉/蓝/黄 + 米色纸、高对比套色",
            mood = "复古、艺术、设计感",
            typography = "网点颗粒、套色错位、粗糙印刷肌理的复古质感",
            lighting = "均匀平光、微暖复古色调、无硬阴影",
            camera = "平面设计视角、俯视或鸟瞰、海报构图",
            material = "Risograph 半调网点、套色错位、大豆油墨质感、米纸纹理",
            background = "#f5efe2",
            textTheme = TextTheme(
                variant = TextVariant.RISO,
                bg = "#f5efe2",
                cardBg = "#f5efe2",
                titleColor = "#1a1a1a",
                bodyColor = "#3a3a3a",
                accent = "#ff5fa2",
                deco = "#4a90d9",
                font = ThemeFont.SANS,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "comic",
        label = "波普漫画",
        style = ModuleStyle(
            artStyle = "波普漫画风、半调网点、粗黑描边、高对比色块",
            palette = "高饱和原色、红/黄/蓝、黑边强调",
            mood = "张力、活泼、抓眼",
            typography = "半调网点、粗黑描边、高对比色块的波普漫画质感",
            lighting = "高对比戏剧性光照、粗放阴影色块、漫画式明暗",
            camera = "动感英雄角度、戏剧性前缩、动作构图",
            material = "粗黑墨线描边、平涂色块、半调网点、新闻纸纹理",
            background = "#fdf6ef",
            textTheme = TextTheme(
                variant = TextVariant.MAGAZINE,
                bg = "#fffdf9",
                cardBg = "#fdf6ef",
                titleColor = "#1a1a1a",
                bodyColor = "#333333",
                accent = "#ff3b30",
                deco = "#1a1a1a",
                font = ThemeFont.SANS,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "pixel",
        label = "像素复古",
        style = ModuleStyle(
            artStyle = "8-bit 像素艺术、复古游戏风、方块边缘、像素字体",
            palette = "高饱和电子色、黑底或深蓝底 + 亮绿/亮粉",
            mood = "怀旧、游戏、数字",
            typography = "8-bit 方块像素、硬边缘、低分辨率纹理的复古数字质感",
            lighting = "平涂像素光照、无渐变、方块阴影、8-bit 抖动",
            camera = "正交俯视或横版侧视、像素画构图",
            material = "硬像素边缘、方块 8-bit 色块、有限调色板、无抗锯齿",
            background = "#1b1f3b",
            textTheme = TextTheme(
                variant = TextVariant.CHALK,
                bg = "#1b1f3b",
                cardBg = "#1b1f3b",
                titleColor = "#5dff8f",
                bodyColor = "#cfeaff",
                accent = "#ff5dce",
                deco = "#5dff8f",
                font = ThemeFont.MONO
            )
        )
    ),
    StylePreset(
        id = "scribble",
        label = "潦草速写",
        style = ModuleStyle(
            artStyle = "潦草速写、松散手绘线条、未完成感、笔记风",
            palette = "黑墨线 + 米白纸 + 淡彩点缀（淡蓝/淡棕）",
            mood = "随性、亲切、探索中",
            typography = "潦草手写体、松散快速线条、速写笔触感",
            lighting = "自然侧光、纸面微反射、柔和投影",
            camera = "平视手账视角、略微倾斜的随性构图",
            material = "钢笔/铅笔快速线条、纸张纤维、墨水洇染、大量留白",
            background = "#faf7f0",
            textTheme = TextTheme(
                variant = TextVariant.BUJO,
                bg = "#fffdf8",
                cardBg = "#faf7f0",
                titleColor = "#333333",
                bodyColor = "#555555",
                accent = "#6a8caf",
                deco = "#c9a86a",
                font = ThemeFont.KAI
            )
        )
    ),
    StylePreset(
        id = "flat-design",
        label = "扁平化设计",
        style = ModuleStyle(
            artStyle = "扁平化设计、几何色块、无阴影无渐变",
            palette = "明亮对比色、蓝/橙/黄/绿、干净纯色",
            mood = "现代、清晰、高效",
            typography = "粗体无衬线、高对比、扁平化图标式文字",
            lighting = "无光照、平涂均匀、无阴影",
            camera = "正面平视、居中对称、图标式构图",
            material = "纯色色块、无纹理、干净矢量边缘、无渐变",
            background = "#f5f5f5",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#ffffff",
                cardBg = "#f5f5f5",
                titleColor = "#1a1a1a",
                bodyColor = "#555555",
                accent = "#2563eb",
                deco = "#2563eb",
                font = ThemeFont.SANS
            )
        )
    ),
    StylePreset(
        id = "isometric",
        label = "等距三维",
        style = ModuleStyle(
            artStyle = "等距三维插画、30度角、无透视畸变",
            palette = "柔和3D色调、蓝绿+暖橙、低饱和",
            mood = "结构化、专业、空间感",
            typography = "3D立体字效、等距视角文字、干净工业感",
            lighting = "柔和三点光照、上方主光、无硬阴影",
            camera = "等距30度俯角、无透视畸变、结构化视角",
            material = "光滑3D表面、柔和哑光材质、圆角边缘",
            background = "#f0f2f5",
            textTheme = TextTheme(
                variant = TextVariant.DATA,
                bg = "#f0f2f5",
                cardBg = "#f0f2f5",
                titleColor = "#1e3a5f",
                bodyColor = "#3a5070",
                accent = "#2b8a9a",
                deco = "#2b8a9a",
                font = ThemeFont.SANS
            )
        )
    ),
    StylePreset(
        id = "woodcut",
        label = "木刻版画",
        style = ModuleStyle(
            artStyle = "木刻版画、黑白高对比、粗犷刀痕",
            palette = "纯黑 + 米白 + 单一红色点缀",
            mood = "力量、古朴、震撼",
            typography = "木刻字体感、粗犷有力、黑白分明",
            lighting = "高对比单方向光、强烈明暗交界",
            camera = "正面平视、居中构图、海报式",
            material = "木刻刀痕、木纹残留、油墨不均匀、纸张压印",
            background = "#f5f0e8",
            textTheme = TextTheme(
                variant = TextVariant.RISO,
                bg = "#f5f0e8",
                cardBg = "#f5f0e8",
                titleColor = "#1a1a1a",
                bodyColor = "#333333",
                accent = "#9c2b2b",
                deco = "#1a1a1a",
                font = ThemeFont.SERIF,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "engraving",
        label = "蚀刻版画",
        style = ModuleStyle(
            artStyle = "蚀刻版画、精细排线、交叉影线、铜版质感",
            palette = "深褐墨色 + 米白纸 + 淡金点缀",
            mood = "学术、权威、古典",
            typography = "铜版蚀刻字体、精细线刻文字、古典学术感",
            lighting = "单方向光、细腻明暗渐变、学术照明",
            camera = "学术研究视角、正面或四分之三侧视",
            material = "铜版蚀刻线条、交叉影线、精细排线、旧纸张纹理",
            background = "#f4f0e6",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#f4f0e6",
                cardBg = "#f4f0e6",
                titleColor = "#3a2a1a",
                bodyColor = "#5a4a3a",
                accent = "#8a6a3a",
                deco = "#8a6a3a",
                font = ThemeFont.SERIF,
                titleUnderline = true
            )
        )
    ),
    StylePreset(
        id = "gouache",
        label = "水粉画",
        style = ModuleStyle(
            artStyle = "水粉画、不透明色块、覆盖力强、笔触明显",
            palette = "浓郁色块、暖橘/深绿/藏蓝、高饱和但不刺眼",
            mood = "温暖、厚重、有手工感",
            typography = "水粉笔触、不透明色块文字、厚重覆盖感",
            lighting = "自然柔光、色块间微妙明暗、无高光",
            camera = "平视自然视角、画面饱满",
            material = "水粉厚涂、不透明覆盖、干净色块边缘、纸张纹理",
            background = "#fbf5ee",
            textTheme = TextTheme(
                variant = TextVariant.MAGAZINE,
                bg = "#fffdf8",
                cardBg = "#fbf5ee",
                titleColor = "#4a3520",
                bodyColor = "#5a4530",
                accent = "#c97a3a",
                deco = "#c97a3a",
                font = ThemeFont.SANS,
                titleUnderline = true
            )
        )
    ),
    StylePreset(
        id = "origami",
        label = "折纸风格",
        style = ModuleStyle(
            artStyle = "折纸风格、几何折叠、利落棱角、层次分明",
            palette = "柔和纸色 + 亮色点缀、浅粉/浅蓝/米白",
            mood = "精致、巧妙、空间感",
            typography = "折纸几何文字、棱角分明的字体感",
            lighting = "侧光投射折痕阴影、层次分明",
            camera = "四分之三角度、展示折叠层次",
            material = "纸张折叠、利落棱角、投影层次、哑光纸面",
            background = "#f8f6f0",
            textTheme = TextTheme(
                variant = TextVariant.MINIMAL,
                bg = "#f8f6f0",
                cardBg = "#f8f6f0",
                titleColor = "#3a3a3a",
                bodyColor = "#5a5a5a",
                accent = "#e07a5f",
                deco = "#3a7a8a",
                font = ThemeFont.SANS
            )
        )
    ),
    StylePreset(
        id = "ghibli",
        label = "吉卜力风格",
        style = ModuleStyle(
            artStyle = "吉卜力风格、手绘动画感、水彩背景、温暖叙事",
            palette = "温暖自然色、草绿/天蓝/暖黄、柔和饱和",
            mood = "治愈、怀旧、温暖",
            typography = "手写温暖字体、柔和圆润、动画标题感",
            lighting = "柔和自然光、金色时刻暖光、温柔阴影",
            camera = "广角叙事视角、与角色平视、沉浸式",
            material = "手绘水彩背景、赛璐璐角色层、柔和笔触、温暖渐变",
            background = "#f9f5ec",
            textTheme = TextTheme(
                variant = TextVariant.MAGAZINE,
                bg = "#fffdf6",
                cardBg = "#f9f5ec",
                titleColor = "#4a3a2a",
                bodyColor = "#5a4a3a",
                accent = "#8aae5a",
                deco = "#d9a441",
                font = ThemeFont.SANS,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "bauhaus",
        label = "包豪斯",
        style = ModuleStyle(
            artStyle = "包豪斯风格、原色几何、功能主义、极简构成",
            palette = "红/黄/蓝三原色 + 黑白、纯粹",
            mood = "理性、结构、现代主义",
            typography = "无衬线几何字体、粗壮、功能主义排版",
            lighting = "均匀光照、无阴影、平面化",
            camera = "正面平视、网格构图、几何对称",
            material = "纯色色块、无纹理、干净利落的几何边缘",
            background = "#f5f5f0",
            textTheme = TextTheme(
                variant = TextVariant.DATA,
                bg = "#f5f5f0",
                cardBg = "#f5f5f0",
                titleColor = "#1a1a1a",
                bodyColor = "#333333",
                accent = "#dc2626",
                deco = "#1a1a1a",
                font = ThemeFont.SANS,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "cel-shading",
        label = "赛璐璐",
        style = ModuleStyle(
            artStyle = "赛璐璐、动画风、粗线描边+平涂色块",
            palette = "高饱和动画色、蓝天/草绿/角色色",
            mood = "活泼、年轻、二次元",
            typography = "动画标题字体、粗描边文字、活力感",
            lighting = "高对比动画光照、明暗分明、色彩鲜明",
            camera = "动感视角、戏剧性构图、动画分镜感",
            material = "粗黑描边、平涂色块、无渐变、动画赛璐璐片质感",
            background = "#f5f8ff",
            textTheme = TextTheme(
                variant = TextVariant.MAGAZINE,
                bg = "#fffefb",
                cardBg = "#f5f8ff",
                titleColor = "#2a2a4a",
                bodyColor = "#3a3a5a",
                accent = "#5a8acc",
                deco = "#ff6b6b",
                font = ThemeFont.SANS,
                titleBlock = true
            )
        )
    ),
    StylePreset(
        id = "infographic",
        label = "手绘信息图",
        style = ModuleStyle(
            artStyle = "手绘信息图、马克笔勾线涂鸦、手账拼贴感、每个知识点配一个拟物小插画",
            palette = "米白纸张底 + 柔和粉彩（薄荷绿/天蓝/奶油黄/浅粉）+ 黑色勾线强调",
            mood = "亲切、活泼、有温度、轻松科普",
            typography = "手写风标题、圆角标签框、气泡对话框、编号圆圈，文字分区清晰",
            lighting = "明亮均匀平光、无阴影、平涂色彩",
            camera = "俯视平铺整页、四宫格或多分区排版、板块间用虚线与手绘箭头串联",
            material = "马克笔勾线、和纸胶带、贴纸、回形针、星星小装饰、纸张颗粒纹理",
            background = "#fdf9f0",
            textTheme = TextTheme(
                variant = TextVariant.BUJO,
                bg = "#fffdf6",
                cardBg = "#fdf9f0",
                titleColor = "#333333",
                bodyColor = "#555555",
                accent = "#ff8c42",
                deco = "#7ec8e3",
                font = ThemeFont.KAI,
                titleBlock = true
            )
        )
    ),
)

/** 按 id 取预设，找不到回退第一套（与 TS `find(...) ?? STYLE_PRESETS[0]` 一致） */
fun getPreset(id: String?): StylePreset =
    STYLE_PRESETS.firstOrNull { it.id == id } ?: STYLE_PRESETS.first()

/** 给预设补一个安全浅色底（防止 style.background 缺失） */
fun presetBackground(p: StylePreset): String = p.style.background ?: "#faf8f3"

/** 按 id 取安全浅色底：未知 id 先回退第一套，再取其 background */
fun presetBackground(id: String?): String = presetBackground(getPreset(id))
