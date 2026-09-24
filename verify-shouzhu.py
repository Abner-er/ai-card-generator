#!/usr/bin/env python3
"""
真实 Agnes 验证：守株待兔 + 儿童绘本风格（仅使用标准库）
检查 Agnes 是否还会画出乱码标题。
"""
import base64
import json
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path("real-shouzhu")
OUT.mkdir(exist_ok=True)

BASE = "http://localhost:5199"
THEME = "守株待兔"

def request(method, path, payload=None, timeout=120):
    url = f"{BASE}{path}"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))

def post(path, payload):
    return request("POST", path, payload)

def get(path):
    return request("GET", path)

def proxy_image(url):
    enc = urllib.parse.quote(url, safe="")
    return get(f"/ai-image-proxy?url={enc}")["data"]

# 1) 真实拆解
print(f"[decompose] theme={THEME}")
system = f"""你是一个知识拆解专家。把用户给定的主题拆解成 8~12 个最小知识点模块。
规则：
- 每个模块：title ≤10 字，body ≤30 字，bullets 最多 3 条每条 ≤12 字。
- visualHint：一句话描述该模块主体画什么，只描述纯视觉元素（形状、颜色、空间、材质），绝对禁止出现"标注/标签/文字/对话框/黑板/便签/胶带/丝带/标题/字体"等诱导文字的词。
- 第一个模块必须是 type=cover。
- seriesStyle 采用：artStyle=儿童绘本插画、圆润角色、温馨场景、故事感；palette=暖黄/天蓝/草绿、明亮柔和；mood=温馨、讲故事、易亲近；typography=绘本柔和渲染、圆润造型、温馨光感的故事书质感。
只返回如下 JSON（不要解释、不要 markdown 代码块）：
{{"seriesTitle":"...","seriesStyle":{{"artStyle":"...","palette":"...","mood":"...","typography":"..."}},"modules":[{{"id":"m1","type":"cover","title":"...","body":"...","bullets":[],"icon":"📘","visualHint":"...","ratio":"3:4"}}]}}"""

decomp = post("/ai-api/chat/completions", {
    "model": "agnes-2.5-flash",
    "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": f"主题：{THEME}"},
    ],
    "temperature": 0.6,
})
text = decomp["choices"][0]["message"]["content"]
cleaned = text.strip().replace("```json", "").replace("```", "").strip()
data = json.loads(cleaned[cleaned.find("{"):cleaned.rfind("}")+1])
modules = data["modules"][:6]
print(f"  modules={len(modules)}")
for i, m in enumerate(modules, 1):
    print(f"  {i:02d}. {m['type']:10s} {m['title']:12s} visualHint={m.get('visualHint','')[:50]}")

# 2) 串行生图
print("\n[generate]")
for i, m in enumerate(modules, 1):
    prompt = (
        f"一幅儿童绘本插画风格的主题插画。"
        f"配色：暖黄/天蓝/草绿、明亮柔和。"
        f"整体氛围：温馨、讲故事、易亲近。"
        f"本画面主体：{m.get('visualHint','与守株待兔相关的单一主体')}。画面只呈现这一主体，保持单一、干净、聚焦。"
        "这是一张纯插画图：画面里严禁出现任何文字、数字、字母、符号或标点符号，"
        "包括标题、正文、标签、水印、装饰性文字在内的一切文字都不允许出现；"
        "所有说明性文字会在后续步骤单独叠加，插画本身只负责呈现视觉主体。"
        "表面材质与笔触（画面中不得出现任何文字、字体或标题）：绘本柔和渲染、圆润造型、温馨光感的故事书质感。"
        "画面是一个完整的纯插画艺术作品，构图自然有机；"
        "画面里不得出现任何文字、数字、字母、符号或标点符号，连细微的装饰性文字也不行——这是一张只用视觉讲故事的插画。"
    )
    payload = {
        "model": "agnes-image-2.1-flash",
        "prompt": prompt,
        "size": "1K",
        "ratio": m.get("ratio", "3:4"),
        "n": 1,
        "extra_body": {"response_format": "url"},
    }
    r = post("/ai-api/images/generations", payload)
    url = r["data"][0]["url"]
    b64 = proxy_image(url).split(",")[1]
    fname = OUT / f"{i:02d}-{m['type']}-{m['title']}.png"
    fname.write_bytes(base64.b64decode(b64))
    print(f"  {fname.name} ok ({len(b64)//1024}KB)")
    time.sleep(0.5)

print(f"\n[done] outputs in {OUT.absolute()}")
