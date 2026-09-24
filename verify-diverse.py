#!/usr/bin/env python3
"""
真实 Agnes 验证：构图多样性。
走 decompose（用最新 system prompt）+ 生图链路，观察不同模块的构图是否明显不同。
"""
import base64
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent / "real-diverse"
OUT.mkdir(exist_ok=True)
BASE = "http://localhost:5199"
TOPIC = "人体消化系统"

STYLE = {
    "artStyle": "清新水彩手绘",
    "palette": "米白底 + 柔和自然色（草绿/天蓝/暖橘）",
    "mood": "治愈、温柔、文艺",
    "typography": "水彩湿画法晕染、纸纹吸水、边缘自然扩散的柔和质感",
}

DEFAULT_LAYOUT = {
    "cover": "sparse",
    "definition": "balanced",
    "fact": "list",
    "step": "flow",
    "compare": "comparison",
    "timeline": "flow",
    "stat": "bigNumber",
    "quote": "sparse",
    "tip": "balanced",
    "section": "dense",
}

LAYOUT_HINT = {
    "sparse": "开阔构图：主体位于画面中心或黄金分割点，四周大量留白。",
    "balanced": "平衡构图：主体与环境元素左右或上下均衡分布。",
    "dense": "饱满构图：主体周围布满相关细节与小元素。",
    "list": "主次构图：主体占据主要位置，旁边或下方自然排列 2~4 个相关小元素。",
    "comparison": "对照构图：两个相关对象分居画面左右或上下，形成鲜明对比。",
    "flow": "流程构图：画面具有从左到右或从上到下的叙事方向。",
    "mindmap": "放射构图：中心主体向外放射出 3~5 条关联线。",
    "quadrant": "四象限构图：画面分成四个视觉区域。",
    "bigNumber": "数字主视觉构图：一个巨大的图形化数量意象作为核心。",
}

SYSTEM = f"""你是一个知识拆解专家。把用户给定的主题或文本，拆解成一系列「最小知识点模块」，每个模块只讲一个清晰的知识点。

规则：
- 模块数量：根据内容 8~18 个，覆盖全面但不重复。
- 每个模块极简（文字预算从严）：title（短标题 ≤10 字）、body（正文 ≤30 字，一句核心说明）、bullets（可选，默认 2 条、最多 3 条，每条 ≤12 字）。
- visualHint（必填）：一句话描述这个模块的画面应该画什么。可以是一个具体主体、一个场景、一个动作瞬间、一个剖面/内部结构，或一组有明确关系的视觉元素。允许包含环境、配角、动态动作和空间氛围；不要描述装饰、文字或边框。绝对禁止出现"标注""标签""文字""对话框""黑板""便签""胶带""丝带"等会诱导 AI 生成乱码文字的词汇。重要：每个模块的 visualHint 必须与该模块的 title/body 强相关、且彼此之间必须明显不同。
- type 从以下选：cover / definition / fact / step / compare / timeline / stat / quote / tip / section。
- ratio 按类型给：cover→3:4, definition→4:3, fact→1:1, step→9:16, compare→16:9, timeline→4:3, stat→3:4, quote→3:4, tip→1:1, section→3:4。
- 第一个模块必须是 type=cover。
- icon 用单个 emoji。
- seriesStyle 固定为：artStyle={STYLE['artStyle']}；palette={STYLE['palette']}；mood={STYLE['mood']}；typography={STYLE['typography']}。

只返回如下 JSON（不要任何解释、不要 markdown 代码块、不要反引号）：
{{
  "seriesTitle": "系列名",
  "seriesStyle": {{"artStyle":"...","palette":"...","mood":"...","typography":"..."}},
  "modules": [
    {{"id":"m1","type":"cover","title":"...","body":"...","bullets":[],"icon":"📘","visualHint":"一片金色向日葵花田在晨雾中向太阳倾斜","ratio":"3:4"}},
    {{"id":"m2","type":"definition","title":"...","body":"...","bullets":[],"icon":"💡","visualHint":"一颗向日葵种子的特写剖面","ratio":"4:3"}}
  ]
}}"""


def post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}", data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def get_proxy_img(url):
    enc = urllib.parse.quote(url, safe="")
    req = urllib.request.Request(f"{BASE}/ai-image-proxy?url={enc}")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def decompose():
    print(f"[decompose] topic={TOPIC}")
    data = post("/ai-api/chat/completions", {
        "model": "agnes-2.5-flash",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"主题或文本：\n{TOPIC}"},
        ],
        "temperature": 0.6,
    })
    text = data["choices"][0]["message"]["content"]
    cleaned = text.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
    m = cleaned[cleaned.find("{"):cleaned.rfind("}")+1]
    return json.loads(m)


def gen_image(module):
    payload = {
        "model": "agnes-image-2.1-flash",
        "prompt": module["prompt"],
        "size": "1K",
        "ratio": module["ratio"],
        "n": 1,
        "extra_body": {"response_format": "url"},
    }
    data = post("/ai-api/images/generations", payload)
    url = data["data"][0]["url"]
    proxy = get_proxy_img(url)
    b64 = proxy["data"].split(",")[1]
    return base64.b64decode(b64)


def main():
    result = decompose()
    modules = result.get("modules", [])
    print(f"[decompose] {len(modules)} modules")

    for m in modules:
        m["layout"] = DEFAULT_LAYOUT.get(m["type"], "balanced")

    for i, m in enumerate(modules):
        print(f"  {i+1:02d} {m['type']:10s} {m['layout']:10s} {m['title']}")
        print(f"      visualHint: {m.get('visualHint', '')}")

    # 优先挑不同 layout 的模块生成，观察构图差异
    seen_layouts = set()
    targets = []
    for m in modules:
        if m["type"] == "cover" or m["layout"] not in seen_layouts:
            targets.append(m)
            seen_layouts.add(m["layout"])
    targets = targets[:8]

    for idx, m in enumerate(targets):
        safe_title = "".join(c for c in m["title"] if c.isalnum() or c in "_-")[:20]
        fname = f"{idx+1:02d}-{m['type']}-{m['layout']}-{safe_title}.png"
        fpath = OUT / fname
        if fpath.exists():
            print(f"[skip] {fname}")
            continue
        layout_hint = LAYOUT_HINT.get(m["layout"], "")
        prompt = (
            f"一幅{STYLE['artStyle']}风格的主题插画。"
            f"配色：{STYLE['palette']}。整体氛围：{STYLE['mood']}。"
            f"{layout_hint} "
            f"本画面核心主体与场景：{m.get('visualHint', '')}。"
            "围绕这个核心主体，构建有环境、有层次、有空间感的插画场景；"
            "不同模块之间必须使用明显不同的构图、镜头距离和场景氛围。"
            "表面材质与笔触（画面中不得出现任何文字、字体或标题）："
            f"{STYLE['typography']}。"
            "画面是一个完整的纯插画艺术作品，构图自然有机、有空间纵深感；"
            "画面可以包含与主体相关的环境元素、配角、动态动作、路径线条或空间层次；"
            "画面里不得出现任何文字、数字、字母、符号或标点符号，"
            "连细微的装饰性文字也不行——这是一张只用视觉讲故事的插画。"
        )
        m["prompt"] = prompt
        m["ratio"] = m.get("ratio", "1:1")
        print(f"[{idx+1}/{len(targets)}] generating {fname} ratio={m['ratio']} layout={m['layout']} ...")
        try:
            img = gen_image(m)
            fpath.write_bytes(img)
            print(f"       saved {len(img)} bytes -> {fname}")
        except Exception as e:
            print(f"       ERROR: {e}")
        time.sleep(1.5)

if __name__ == "__main__":
    main()
