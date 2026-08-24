from openai import OpenAI
from dotenv import load_dotenv
import json
from datetime import datetime
import tkinter as tk
from tkinter import messagebox


# =========================
# 1. 环境与 OpenAI
# =========================

load_dotenv()

client = OpenAI()


# =========================
# 2. API 与成本配置
# =========================

MODEL = "gpt-5.6-luna"

INPUT_PRICE_PER_MILLION_USD = 0.20
OUTPUT_PRICE_PER_MILLION_USD = 1.20

MAX_OUTPUT_TOKENS = 700

# 当前只是开发阶段的“软警戒线”
# 超过它不会禁止生成，而是先询问用户
INPUT_TOKEN_WARNING = 1500


# =========================
# 3. Structured Output Schema
# =========================

TRACE_SCHEMA = {
    "type": "object",
    "properties": {
        "emotion": {
            "type": "string"
        },
        "trace": {
            "type": "string"
        },
        "scene": {
            "type": "string"
        },
        "visual": {
            "type": "string"
        },
        "movement": {
            "type": "string"
        },
        "shot": {
            "type": "string"
        },
        "sound": {
            "type": "string"
        },
        "duration": {
            "type": "string"
        },
        "video_prompt": {
            "type": "string"
        }
    },
    "required": [
        "emotion",
        "trace",
        "scene",
        "visual",
        "movement",
        "shot",
        "sound",
        "duration",
        "video_prompt"
    ],
    "additionalProperties": False
}


# =========================
# 4. AI 调用
# =========================

def call_ai(memory):

    prompt = f"""
你是 Trace Generator，一个用于实验影像创作的 AI 分析工具。

请分析下面这段记忆：

{memory}

要求：

- emotion：概括这段记忆最核心的情绪
- trace：指出消逝之后仍然留下的痕迹
- scene：描述这一镜具体发生什么
- visual：描述画面的视觉语言，包括色调、光线、空间、材质、构图和整体风格
- movement：描述主体、环境或画面内部如何运动或变化
- shot：给出可以实际执行的摄影机与镜头建议
- sound：给出具体的声音设计方向
- duration：给出这一镜建议时长和基本节奏
- video_prompt：整合以上内容，生成一条可直接用于 AI 视频生成的英文 Prompt

所有字段都要简洁、具体。
每项控制在 1 到 2 句话。
"""

    text_format = {
        "format": {
            "type": "json_schema",
            "name": "trace_analysis",
            "strict": True,
            "schema": TRACE_SCHEMA
        }
    }

    # 生成前：计算 Input Tokens
    token_count = client.responses.input_tokens.count(
        model=MODEL,
        input=prompt,
        text=text_format
    )

    estimated_input_tokens = token_count.input_tokens

    # 生成前：估算最大成本
    estimated_input_cost = (
        estimated_input_tokens
        / 1_000_000
        * INPUT_PRICE_PER_MILLION_USD
    )

    estimated_max_output_cost = (
        MAX_OUTPUT_TOKENS
        / 1_000_000
        * OUTPUT_PRICE_PER_MILLION_USD
    )

    estimated_max_total_cost = (
        estimated_input_cost
        + estimated_max_output_cost
    )

    print("预计输入 Tokens:", estimated_input_tokens)
    print(
        "预计最大成本 USD:",
        f"${estimated_max_total_cost:.6f}"
    )

    # 判断是否超过软警戒线
    if estimated_input_tokens > INPUT_TOKEN_WARNING:
        warning_text = "\n⚠ 输入量已超过当前警戒值。"
    else:
        warning_text = ""

    # 每次正式生成前都由用户确认
    should_continue = messagebox.askyesno(
        "生成前成本预检",
        f"预计输入：{estimated_input_tokens} Tokens\n"
        f"最大输出：{MAX_OUTPUT_TOKENS} Tokens\n"
        f"预计最大成本：${estimated_max_total_cost:.6f}"
        f"{warning_text}\n\n"
        "是否继续生成？"
    )

    if not should_continue:
        return None

    # 正式调用 AI
    response = client.responses.create(
        model=MODEL,
        input=prompt,
        text=text_format,
        max_output_tokens=MAX_OUTPUT_TOKENS
    )

    # 调用后：读取实际 Token 使用量
    actual_input_tokens = response.usage.input_tokens
    actual_output_tokens = response.usage.output_tokens
    actual_total_tokens = response.usage.total_tokens

    actual_cost = (
        actual_input_tokens
        / 1_000_000
        * INPUT_PRICE_PER_MILLION_USD
        +
        actual_output_tokens
        / 1_000_000
        * OUTPUT_PRICE_PER_MILLION_USD
    )

    print("实际输入 Tokens:", actual_input_tokens)
    print("实际输出 Tokens:", actual_output_tokens)
    print("总 Tokens:", actual_total_tokens)
    print(
        "实际估算成本 USD:",
        f"${actual_cost:.6f}"
    )

    return response.output_text


# =========================
# 5. Trace Generator 主流程
# =========================

def generate_trace():

    memory = memory_text.get(
        "1.0",
        tk.END
    ).strip()

    if not memory:
        messagebox.showwarning(
            "提示",
            "请先输入一段记忆。"
        )
        return

    generate_button.config(
        state="disabled",
        text="生成中..."
    )

    try:

        result_text = call_ai(memory)

        # 用户在成本警告里选择取消
        if result_text is None:
            return

        trace = json.loads(result_text)

        # -------------------------
        # 显示结果
        # -------------------------

        result_box.delete(
            "1.0",
            tk.END
        )

        result_box.insert(
            tk.END,
            f"核心情绪：\n{trace['emotion']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"留下的痕迹：\n{trace['trace']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"场景内容：\n{trace['scene']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"视觉语言：\n{trace['visual']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"运动与变化：\n{trace['movement']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"镜头建议：\n{trace['shot']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"声音设计：\n{trace['sound']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"时长与节奏：\n{trace['duration']}\n\n"
        )

        result_box.insert(
            tk.END,
            f"AI 视频提示词：\n{trace['video_prompt']}\n"
        )

        # -------------------------
        # 保存 JSON
        # -------------------------

        timestamp = datetime.now().strftime(
            "%Y%m%d-%H%M%S"
        )

        output_path = (
            "08-Code/02-projects/"
            "trace-generator/outputs/"
            f"trace-{timestamp}.json"
        )

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                trace,
                file,
                ensure_ascii=False,
                indent=4
            )

        messagebox.showinfo(
            "完成",
            "分析完成，JSON 已保存。"
        )

    except json.JSONDecodeError:

        messagebox.showerror(
            "错误",
            "AI 返回的内容不是有效 JSON。"
        )

    except Exception as error:

        messagebox.showerror(
            "错误",
            str(error)
        )

    finally:

        generate_button.config(
            state="normal",
            text="生成 Trace"
        )


# =========================
# 6. GUI
# =========================

root = tk.Tk()

root.title("Trace Generator v0.2")
root.geometry("700x750")


title_label = tk.Label(
    root,
    text="Trace Generator v0.2",
    font=("Arial", 20)
)

title_label.pack(
    pady=15
)


instruction_label = tk.Label(
    root,
    text="请输入一段记忆："
)

instruction_label.pack()


memory_text = tk.Text(
    root,
    height=8,
    width=75,
    wrap="word"
)

memory_text.pack(
    padx=20,
    pady=10
)


generate_button = tk.Button(
    root,
    text="生成 Trace",
    command=generate_trace
)

generate_button.pack(
    pady=10
)


result_label = tk.Label(
    root,
    text="分析结果："
)

result_label.pack()


result_box = tk.Text(
    root,
    height=25,
    width=75,
    wrap="word"
)

result_box.pack(
    padx=20,
    pady=10
)


# =========================
# 7. 启动 GUI
# =========================

root.mainloop()