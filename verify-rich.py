import json, base64, urllib.request, urllib.parse, os, sys, time

BASE = "http://localhost:5199"
OUT = "real-rich"
os.makedirs(OUT, exist_ok=True)

ART = "扁平矢量插画"
PAL = "明亮多彩、低饱和、干净"
MOOD = "轻松、现代、友好"
TYPO = "平滑矢量色块、边缘锐利干净、无笔触纹理的现代平面质感"

TYPE_HINT = {
    "cover": "封面页：开阔场景，主视觉与环境共同构成整体氛围，有空间纵深感，像一幅完整的场景插画。",
    "definition": "定义页：清晰展示概念核心，可以是剖面、内部结构、特写或主体在环境中的典型状态。",
    "fact": "知识点页：主体在真实或象征性场景中呈现，允许相关配角元素或环境细节辅助说明。",
    "compare": "对比页：两个相关对象并列或分屏呈现，形成视觉对照。",
    "stat": "数据页：用一个巨大的视觉符号或数量意象作为核心，主体围绕它组织。",
    "step": "步骤页：动态场景，主体正在执行某个动作，画面有方向感和先后次序。",
}
LAYOUT_HINT = {
    "sparse": "开阔构图：主体位于画面中心或黄金分割点，四周大量留白，突出主体本身，画面有呼吸感。",
    "balanced": "平衡构图：主体与相关环境元素左右或上下均衡分布，画面稳定且有空间层次。",
    "list": "主次构图：主体占据主要位置，旁边或下方自然排列 2~4 个相关联的小视觉元素。",
    "comparison": "对照构图：两个相关对象分居画面左右或上下，形成鲜明对比，背景统一。",
    "bigNumber": "数字主视觉构图：一个巨大的、图形化的数量意象或符号作为画面核心，主体环绕其周围。",
    "flow": "流程构图：画面具有从左到右或从上到下的叙事方向，主体与路径、阶段图形共同推进。",
}

def build_prompt(m):
    base = f"一幅{ART}风格的主题插画。配色：{PAL}。整体氛围：{MOOD}。"
    comp = (TYPE_HINT[m["type"]] + " 布局骨架：" + LAYOUT_HINT[m["layout"]])
    visual = (f"本画面核心主体与场景：{m['visualHint']}。围绕这个核心主体，加入丰富的具象元素、"
              "配角、细节物件与环境，让画面饱满、信息感强、一眼能看懂，但不要用抽象隐喻来表达概念；"
              "不同模块之间必须使用明显不同的构图、元素组合和场景氛围。")
    text_rule = ("这是一张纯插画图：画面里严禁出现任何文字、数字、字母、符号或标点符号，"
                 "包括标题、正文、标签、水印、装饰性文字在内的一切文字都不允许出现；"
                 "所有说明性文字会在后续步骤单独叠加，插画本身只负责呈现视觉主体。")
    style_spec = f"表面材质与笔触（画面中不得出现任何文字、字体或标题）：{TYPO}。"
    quality = ("画面是一个完整的纯插画艺术作品，构图自然有机、有空间纵深感；"
               "画面要包含与主体相关的丰富具象元素、配角、细节物件、剖面结构或数据化图形，"
               "让画面饱满、信息感强，但不要使用抽象象征或隐喻来表达概念；"
               "画面里不得出现任何文字、数字、字母、符号或标点符号，连细微的装饰性文字也不行——这是一张只用视觉讲故事的插画。")
    return " ".join([base, comp, visual, text_rule, style_spec, quality])

modules = [
    {"type":"cover","layout":"sparse","visualHint":"一对肾脏并排放在简洁医学插画背景中：左侧健康肾脏红褐色表面光滑饱满，右侧病变肾脏明显缩小、苍白、表面有瘢痕皱缩"},
    {"type":"definition","layout":"balanced","visualHint":"一个放大的肾脏剖面，内部肾小球与肾小管的网状结构清晰可见，周围漂浮着少量代表代谢废物的小颗粒"},
    {"type":"fact","layout":"list","visualHint":"肾小球毛细血管球的特写剖面：红细胞在血管中穿行，废物被滤出进入肾小囊，周围环绕多个弯曲的肾小管细节"},
    {"type":"compare","layout":"comparison","visualHint":"左右对照的两个肾脏：左侧健康肾脏红润有光泽，右侧萎缩变白、布满囊肿和瘢痕，背景统一为淡色"},
    {"type":"stat","layout":"bigNumber","visualHint":"一个巨大的百分比符号作为核心，周围环绕多个小肾脏图标和不同表情的人形，表示患病人群比例"},
    {"type":"step","layout":"flow","visualHint":"血液从人体手臂血管流出，经过一台透析机的透明管道回路被净化，再流回体内，画面有清晰的从左到右流动方向箭头"},
]

def call_agnes(prompt, n=1):
    payload = {
        "model": "agnes-image-2.1-flash",
        "prompt": prompt,
        "size": "1K",
        "ratio": "3:4",
        "n": n,
        "extra_body": {"response_format": "url"},
    }
    req = urllib.request.Request(BASE + "/ai-api/images/generations",
                                 data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read().decode())
            return data["data"][0]["url"], None
        except Exception as e:
            msg = str(e)
            if "429" in msg or "频率" in msg:
                wait = 30 * (attempt + 1)
                print(f"  rate limited, wait {wait}s ...")
                time.sleep(wait)
            else:
                return None, msg
    return None, "max retries"

for i, m in enumerate(modules, 1):
    prompt = build_prompt(m)
    print(f"[{i}/{len(modules)}] {m['type']:11s} generating ...")
    url, err = call_agnes(prompt)
    if not url:
        print(f"  FAILED: {err}")
        continue
    enc = urllib.parse.quote(url, safe="")
    try:
        with urllib.request.urlopen(BASE + "/ai-image-proxy?url=" + enc, timeout=120) as r:
            j = json.loads(r.read().decode())
        b64 = j["data"].split(",")[1]
        fn = f"{OUT}/{i:02d}-{m['type']}.png"
        with open(fn, "wb") as f:
            f.write(base64.b64decode(b64))
        print(f"  saved {fn}")
    except Exception as e:
        print(f"  proxy err: {e}")
    time.sleep(2)

print("done")
