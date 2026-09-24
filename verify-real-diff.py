import json
import base64
import urllib.request
import urllib.parse
import os
import time
import re

BASE = "http://localhost:5199"

SYSTEM_PROMPT = """你是一个知识拆解专家。把用户给定的主题或文本，拆解成一系列「最小知识点模块」，像搭积木一样，每个模块只讲一个清晰的知识点。

规则：
- 模块数量：根据内容 8~18 个，覆盖全面但不重复。
- 每个模块极简（文字预算从严）：title（短标题 ≤10 字）、body（正文 ≤30 字，一句核心说明）、bullets（可选，默认 2 条、最多 3 条，每条 ≤12 字，作为补充细节）。若某点信息量大，宁可多拆几个模块，也不要在一个模块里堆太多文字；每个模块文字总量尽量少，文字越少画面越干净。
- visualHint（必填）：一句话描述这个模块的主体应该画什么。必须是一个具体、可识别的单一主体（例如 "一株完整的向日葵，花盘朝太阳" / "一颗向日葵种子落在泥土里发芽" / "向日葵根系在土壤中的剖面" / "一个浏览器地址栏变为 IP 地址的示意图"）。只描述主体本身与构图，不要描述装饰、文字或边框。重要：每个模块的 visualHint 必须与该模块的 title/body 强相关、且彼此之间必须明显不同——绝对禁止多张模块使用相同或高度相似的视觉主体（例如不要多张都画"同一个器官""同一朵花"），要让每张图一眼能区分开。
- type 从以下选：cover(封面大标题) / definition(定义) / fact(事实) / step(步骤) / compare(对比) / timeline(时间线) / stat(数据) / quote(金句) / tip(贴士) / section(分节)。
- ratio 按类型给：cover→3:4, definition→4:3, fact→1:1, step→9:16, compare→16:9, timeline→4:3, stat→3:4, quote→3:4, tip→1:1, section→3:4。
- 第一个模块必须是 type=cover（系列大标题）。
- icon 用单个 emoji（可选，贴切即可）。
- 必须包含：1 个 cover、1~2 个 definition、若干 fact；必要时 step/compare/timeline/stat；1 个 quote、1 个 tip。
- seriesStyle：为整套模块设定统一风格（artStyle/palette/mood/typography），保证视觉一致。建议采用如下风格：
  artStyle=扁平矢量插画；palette=明亮多彩、低饱和、干净；mood=轻松、现代、友好；typography=现代几何平面字形，文字与色块图形融为一体，像海报字体一样直接画进画面。

只返回如下 JSON（不要任何解释、不要 markdown 代码块、不要反引号）：
{
  "seriesTitle": "系列名",
  "seriesStyle": {"artStyle":"...","palette":"...","mood":"...","typography":"..."},
  "modules": [
    {"id":"m1","type":"cover","title":"...","body":"...","bullets":[],"icon":"📘","visualHint":"...","ratio":"3:4"}
  ]
}"""

TYPE_HINT = {
    "cover": "封面页：主视觉插画占据画面主体，居中、聚焦、有整体性，四周留白。",
    "definition": "定义页：主体插画占据视觉中心，单一主体清晰聚焦。",
    "fact": "知识点页：主体插画占据画面中心，内容可识别、干净。",
    "step": "步骤页：主体插画暗示操作动作或流程方向。",
    "compare": "对比页：两个相关对象分居画面左右，形成对照。",
    "timeline": "时间线页：主体插画暗示时间推进或阶段节点。",
    "stat": "数据页：核心数据相关的可视化主体（如图表、数字意象）。",
    "quote": "金句页：抽象意境插画，氛围贴合主题，留白充足。",
    "tip": "贴士页：提示相关的轻量插画（如灯泡、手势），简洁。",
    "section": "分节页：分节相关的抽象主体图形，居中、留白。",
}

LAYOUT_HINT = {
    "sparse": "极简构图：单一主体居中占据画面，四周大量留白，干净聚焦。",
    "balanced": "平衡构图：主体位于画面中心，上下或左右留有均匀空间，稳定平衡。",
    "dense": "满幅构图：主体占据大部分画面，细节丰富但仍聚焦单一对象。",
    "list": "竖向构图：主体在上方，下方用 2~3 个简洁小图形作为辅助元素。",
    "comparison": "左右构图：两个相关对象分居画面左右，形成对照。",
    "flow": "流程构图：主体配合箭头或步骤图形暗示先后顺序。",
    "mindmap": "放射构图：中心主体向外放射线条连接辅助元素。",
    "quadrant": "四象限构图：主体相关的四个元素分布在 2×2 网格中。",
}

DEFAULT_RATIO = {
    "cover": "3:4", "definition": "4:3", "fact": "1:1", "step": "9:16",
    "compare": "16:9", "timeline": "4:3", "stat": "3:4", "quote": "3:4",
    "tip": "1:1", "section": "3:4",
}


def post_json(path, payload, timeout=120):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url, timeout=120):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def decompose(theme):
    payload = {
        "model": "agnes-2.5-flash",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"主题或文本：\n{theme}"},
        ],
        "temperature": 0.6,
    }
    data = post_json("/ai-api/chat/completions", payload)
    text = data["choices"][0]["message"]["content"]
    cleaned = re.sub(r"```json\n?", "", text).replace("```", "").strip()
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if not m:
        raise ValueError("decompose returned no JSON block")
    return json.loads(m.group(0))


def build_prompt(module, style):
    base = f"一幅{style['artStyle']}风格的主题插画。配色：{style['palette']}。整体氛围：{style['mood']}。"
    composition_parts = [TYPE_HINT.get(module.get("type"), ""), f"布局骨架：{LAYOUT_HINT.get(module.get('layout', 'balanced'), '')}"]
    composition = " ".join([p for p in composition_parts if p]).strip()
    visual = (
        f"本画面主体：{module['visualHint']}。画面只呈现这一主体，保持单一、干净、聚焦。"
        if module.get("visualHint")
        else "本画面主体只画与主题直接相关的单一主体，保持单一、干净、聚焦。"
    )
    text_rule = "这是一张纯插画图：画面里严禁出现任何文字、数字、字母、符号或标点符号，包括标题、正文、标签、水印、装饰性文字在内的一切文字都不允许出现；所有说明性文字会在后续步骤单独叠加，插画本身只负责呈现视觉主体。"
    style_specific = f"画面媒材质感：{style['typography']}。"
    quality = "画面是一个完整的纯插画艺术作品，构图自然有机；画面里不得出现任何文字、数字、字母、符号或标点符号，连细微的装饰性文字也不行——这是一张只用视觉讲故事的插画。"
    return " ".join([base, composition, visual, text_rule, style_specific, quality])


def generate_image(prompt, ratio):
    payload = {
        "model": "agnes-image-2.1-flash",
        "prompt": prompt,
        "size": "1K",
        "ratio": ratio,
        "n": 1,
        "extra_body": {"response_format": "url"},
    }
    data = post_json("/ai-api/images/generations", payload)
    url = data["data"][0]["url"]
    enc = urllib.parse.quote(url, safe="")
    proxy_data = get_json(f"{BASE}/ai-image-proxy?url={enc}")
    b64 = proxy_data["data"].split(",", 1)[1]
    return base64.b64decode(b64)


def safe_name(s, limit=30):
    return re.sub(r'[\\/*?:"<>|]', "_", str(s or "")).strip()[:limit]


def main():
    theme = "太阳系的八大行星"
    os.makedirs("real-diff", exist_ok=True)
    print(f"== decompose: {theme}")
    result = decompose(theme)
    modules = result.get("modules", [])
    print(f"got {len(modules)} modules, seriesTitle={result.get('seriesTitle')}")
    style = result.get("seriesStyle") or {
        "artStyle": "扁平矢量插画",
        "palette": "明亮多彩、低饱和、干净",
        "mood": "轻松、现代、友好",
        "typography": "现代几何平面字形，文字与色块图形融为一体，像海报字体一样直接画进画面",
    }

    targets = modules[:6]
    for i, m in enumerate(targets):
        t = m.get("type", "fact")
        ratio = m.get("ratio") or DEFAULT_RATIO.get(t, "1:1")
        title = m.get("title", "untitled")
        hint = m.get("visualHint", "")
        print(f"\n[{i+1}/{len(targets)}] type={t} ratio={ratio} title={title}")
        print(f"    visualHint={hint}")
        prompt = build_prompt(m, style)
        print(f"    prompt={prompt[:120]}...")
        try:
            img = generate_image(prompt, ratio)
            fn = f"real-diff/{i+1:02d}-{safe_name(t)}-{safe_name(title)}-{safe_name(hint)}.png"
            with open(fn, "wb") as f:
                f.write(img)
            print(f"    saved {fn} ({len(img)} bytes)")
        except Exception as e:
            print(f"    ERROR: {e}")
        if i < len(targets) - 1:
            time.sleep(3)


if __name__ == "__main__":
    main()
