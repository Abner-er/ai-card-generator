import json
import base64
import urllib.request
import urllib.parse
import os

BASE = "http://localhost:5199"

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
}

STYLE = {
    "artStyle": "扁平矢量插画",
    "palette": "明亮多彩、低饱和、干净",
    "mood": "轻松、现代、友好",
    "typography": "现代几何平面字形，文字与色块图形融为一体，像海报字体一样直接画进画面",
}


def post_json(path, payload, timeout=120):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url, timeout=120):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_prompt(module, style):
    base = f"一幅{style['artStyle']}风格的主题插画。配色：{style['palette']}。整体氛围：{style['mood']}。"
    composition = f"{TYPE_HINT.get(module['type'], '')} 布局骨架：{LAYOUT_HINT.get(module.get('layout', 'balanced'), '')}".strip()
    visual = f"本画面主体：{module['visualHint']}。画面只呈现这一主体，保持单一、干净、聚焦。"
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


def main():
    os.makedirs("real-diff", exist_ok=True)
    module = {
        "type": "definition",
        "layout": "balanced",
        "visualHint": "一条从炽热太阳延伸到深空尽头的抽象空间层次带，用渐变色块和细弧线表示遥远边界，无任何文字标签",
    }
    prompt = build_prompt(module, STYLE)
    print("prompt:", prompt[:160], "...")
    img = generate_image(prompt, "4:3")
    fn = "real-diff/03-fixed-太阳系边界-无标注版.png"
    with open(fn, "wb") as f:
        f.write(img)
    print(f"saved {fn} ({len(img)} bytes)")


if __name__ == "__main__":
    main()
