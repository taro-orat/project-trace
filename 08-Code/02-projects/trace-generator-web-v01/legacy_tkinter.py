from openai import OpenAI
from dotenv import load_dotenv
import json
import math
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox


# =========================
# 1. 环境与 OpenAI
# =========================

load_dotenv()

client = OpenAI()

BASE_DIR = Path(__file__).resolve().parent
OUTPUTS_DIR = BASE_DIR / "outputs"


# =========================
# 2. API 与成本配置
# =========================

MODEL = "gpt-5.6-luna"

INPUT_PRICE_PER_MILLION_USD = 0.20
OUTPUT_PRICE_PER_MILLION_USD = 1.20

MAX_OUTPUT_TOKENS = 700
PARAMETER_MAX_OUTPUT_TOKENS = 200

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


PARAMETER_SCHEMA = {
    "type": "object",
    "properties": {
        "intensity": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0
        },
        "instability": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0
        },
        "persistence": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0
        },
        "fragmentation": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0
        },
        "distance": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0
        },
        "uncertainty": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0
        }
    },
    "required": [
        "intensity",
        "instability",
        "persistence",
        "fragmentation",
        "distance",
        "uncertainty"
    ],
    "additionalProperties": False
}


PARAMETER_FIELDS = tuple(
    PARAMETER_SCHEMA["required"]
)


def save_output_json(filename, payload):

    OUTPUTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path = OUTPUTS_DIR / filename

    try:

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                payload,
                file,
                ensure_ascii=False,
                indent=4
            )

    except OSError as error:

        raise OSError(
            f"文件保存失败：{output_path}：{error}"
        ) from error

    return output_path


# =========================
# 4. AI 调用
# =========================

def call_structured_ai(
    prompt,
    schema_name,
    schema,
    max_output_tokens
):

    text_format = {
        "format": {
            "type": "json_schema",
            "name": schema_name,
            "strict": True,
            "schema": schema
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
        max_output_tokens
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
        f"最大输出：{max_output_tokens} Tokens\n"
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
        max_output_tokens=max_output_tokens
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


def call_ai(memory, creative_lock, must_avoid):

    creative_lock_text = "\n".join(
        f"- {item}" for item in creative_lock
    ) or "- 无"

    must_avoid_text = "\n".join(
        f"- {item}" for item in must_avoid
    ) or "- 无"

    prompt = f"""
你是 Trace Generator，一个用于实验影像创作的 AI 分析工具。

请分析下面这段记忆：

{memory}

用户指定的 Creative Lock（必须保留的视觉元素）：
{creative_lock_text}

用户指定的 Must Avoid（绝对禁止出现的内容）：
{must_avoid_text}

要求：

- emotion：概括这段记忆最核心的情绪
- trace：指出消逝之后仍然留下的痕迹
- scene：描述这一镜具体发生什么；必须遵守 Creative Lock，并让其中的每个视觉元素真实出现在画面描述中，不得忽略或替换；不得加入 Must Avoid 中的元素、视觉内容或概念
- visual：描述画面的视觉语言，包括色调、光线、空间、材质、构图和整体风格；必须遵守 Creative Lock，并让其中的每个视觉元素真实出现在画面描述中，不得忽略或替换；不得加入 Must Avoid 中的元素、视觉内容或概念
- movement：描述主体、环境或画面内部如何运动或变化
- shot：给出可以实际执行的摄影机与镜头建议；必须遵守 Creative Lock，确保这些元素在镜头中真实出现；不得加入 Must Avoid 中的元素、视觉内容或概念
- sound：给出具体的声音设计方向
- duration：给出这一镜建议时长和基本节奏
- video_prompt：整合以上内容，生成一条可直接用于 AI 视频生成的英文 Prompt；必须遵守 Creative Lock，确保每个元素真实出现在画面描述中，不得忽略或替换；不得加入 Must Avoid 中的元素、视觉内容或概念

Creative Lock 只约束 scene、visual、shot、video_prompt 中的视觉内容。不要机械要求 emotion、trace、movement、sound、duration 等字段重复 Creative Lock 元素。
Must Avoid 适用于 AI 生成结果中的所有相关视觉内容和概念。

所有字段都要简洁、具体。
每项控制在 1 到 2 句话。
"""

    return call_structured_ai(
        prompt,
        "trace_analysis",
        TRACE_SCHEMA,
        MAX_OUTPUT_TOKENS
    )


def build_parameter_prompt(memory, creative_lock, must_avoid):

    creative_lock_text = "\n".join(
        f"- {item}" for item in creative_lock
    ) or "- 无"

    must_avoid_text = "\n".join(
        f"- {item}" for item in must_avoid
    ) or "- 无"

    return f"""
你是 Trace Generator 的 Parameter Mode。

你的任务是把用户提供的语言、记忆和 Human Constraints 翻译成六个
semantic parameters。你只负责语义翻译，不负责决定最终视觉。

Memory / Prompt：
{memory}

Creative Lock（Human Input / Human Constraint，必须保留）：
{creative_lock_text}

Must Avoid（Human Input / Human Constraint，必须避免）：
{must_avoid_text}

请只输出六个归一化的 semantic parameters，每个值在 0.0 到 1.0 之间。

intensity：
这段记忆整体的感受强度、心理显著程度。
0 = 极弱 / 几乎没有显著性；1 = 极强 / 极度显著。

instability：
这段记忆本身的不稳定、波动、易变化程度。
0 = 稳定、固定；1 = 极不稳定、不断变化。

persistence：
这段记忆持续存在、反复返回、不易消失的程度。
0 = 很容易消退；1 = 极强地持续存在 / 反复返回。

fragmentation：
这段记忆的碎片化、不连续程度。
0 = 连续、完整；1 = 极度破碎、不连续。

distance：
这段记忆与“现在”的心理 / 时间距离感。
0 = 感觉非常接近现在；1 = 感觉非常遥远。

uncertainty：
记忆内容本身的模糊、不确定、无法确认程度。
0 = 非常确定、清晰；1 = 极度模糊、不确定。

这些是 Semantic Parameters，不是 Visual Parameters。
不要输出或推导 particleCount、circleSize、whiteness、颜色、decay、尺寸、
p5.js 参数或任何 final visual setting。

Creative Lock 和 Must Avoid 只是 Human Constraints：
不能成为输出字段，不能被重写，也不能被转换成视觉参数。
"""


def call_parameter_ai(memory, creative_lock, must_avoid):

    prompt = build_parameter_prompt(
        memory,
        creative_lock,
        must_avoid
    )

    return call_structured_ai(
        prompt,
        "trace_parameters",
        PARAMETER_SCHEMA,
        PARAMETER_MAX_OUTPUT_TOKENS
    )


def validate_parameter_output(parameter_output):

    if not isinstance(parameter_output, dict):
        raise ValueError("Parameter 输出必须是 JSON object。")

    expected_keys = set(PARAMETER_FIELDS)
    actual_keys = set(parameter_output.keys())

    if actual_keys != expected_keys:
        missing_keys = expected_keys - actual_keys
        extra_keys = actual_keys - expected_keys
        details = []

        if missing_keys:
            details.append(
                "缺少字段：" + ", ".join(sorted(missing_keys))
            )

        if extra_keys:
            details.append(
                "额外字段：" + ", ".join(sorted(extra_keys))
            )

        raise ValueError(
            "Parameter 字段不符合要求。"
            + (" " + "；".join(details) if details else "")
        )

    validated = {}

    for field in PARAMETER_FIELDS:
        value = parameter_output[field]

        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(
                f"Parameter {field} 必须是 number。"
            )

        if not math.isfinite(value):
            raise ValueError(
                f"Parameter {field} 必须是有限数字。"
            )

        if not 0.0 <= value <= 1.0:
            raise ValueError(
                f"Parameter {field} 必须在 0.0 到 1.0 之间。"
            )

        validated[field] = float(value)

    return validated


# =========================
# 5. Trace Generator 主流程
# =========================

def generate_trace():

    memory = memory_text.get(
        "1.0",
        tk.END
    ).strip()

    creative_lock = [
        item.strip()
        for item in creative_lock_text.get("1.0", tk.END).splitlines()
        if item.strip()
    ]

    must_avoid = [
        item.strip()
        for item in must_avoid_text.get("1.0", tk.END).splitlines()
        if item.strip()
    ]

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

        result_text = call_ai(
            memory,
            creative_lock,
            must_avoid
        )

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

        output_path = save_output_json(
            f"trace-{timestamp}.json",
            {
                "input": {
                    "memory": memory,
                    "creative_lock": {
                        "source": "user",
                        "items": creative_lock
                    },
                    "must_avoid": {
                        "source": "user",
                        "items": must_avoid
                    }
                },
                "ai_output": trace
            }
        )

        messagebox.showinfo(
            "完成",
            f"分析完成，JSON 已保存：\n{output_path}"
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


def generate_parameters():

    memory = memory_text.get(
        "1.0",
        tk.END
    ).strip()

    creative_lock = [
        item.strip()
        for item in creative_lock_text.get("1.0", tk.END).splitlines()
        if item.strip()
    ]

    must_avoid = [
        item.strip()
        for item in must_avoid_text.get("1.0", tk.END).splitlines()
        if item.strip()
    ]

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

        result_text = call_parameter_ai(
            memory,
            creative_lock,
            must_avoid
        )

        # 用户在成本预检里选择取消
        if result_text is None:
            return

        ai_parameters = validate_parameter_output(
            json.loads(result_text)
        )

        # 使用独立 dict，后续 Human 修改不会覆盖 AI 原始结果。
        human_parameters = dict(ai_parameters)

        timestamp = datetime.now().strftime(
            "%Y%m%d-%H%M%S"
        )

        output_path = save_output_json(
            f"parameter-{timestamp}.json",
            {
                "mode": "parameter",
                "schema_version": "parameter-v1",
                "input": {
                    "memory": memory,
                    "creative_lock": {
                        "source": "user",
                        "items": creative_lock
                    },
                    "must_avoid": {
                        "source": "user",
                        "items": must_avoid
                    }
                },
                "ai_parameters": ai_parameters,
                "human_parameters": human_parameters,
                "provenance": {
                    "input": "human",
                    "ai_parameters": "ai",
                    "human_parameters": "human_editable_copy"
                }
            }
        )

        result_box.delete(
            "1.0",
            tk.END
        )

        result_box.insert(
            tk.END,
            "AI Parameters：\n"
            +
            json.dumps(
                ai_parameters,
                ensure_ascii=False,
                indent=4
            )
            +
            "\n\nHuman Parameters = initial editable copy：\n"
            +
            json.dumps(
                human_parameters,
                ensure_ascii=False,
                indent=4
            )
            +
            f"\n\nSaved:\n{output_path}"
        )

        messagebox.showinfo(
            "完成",
            f"Parameter JSON 已保存：\n{output_path}"
        )

    except json.JSONDecodeError:

        messagebox.showerror(
            "错误",
            "AI 返回的内容不是有效 JSON。"
        )

    except ValueError as error:

        messagebox.showerror(
            "Parameter 校验错误",
            str(error)
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


def generate_current_mode():

    if mode_var.get() == "Parameter Mode":
        generate_parameters()
    else:
        generate_trace()


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


mode_var = tk.StringVar(
    value="Narrative Mode"
)


mode_label = tk.Label(
    root,
    text="生成模式："
)

mode_label.pack()


mode_selector = tk.OptionMenu(
    root,
    mode_var,
    "Narrative Mode",
    "Parameter Mode"
)

mode_selector.pack(
    pady=5
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


creative_lock_label = tk.Label(
    root,
    text="必须保留的元素（Creative Lock）："
)

creative_lock_label.pack()


creative_lock_text = tk.Text(
    root,
    height=4,
    width=75,
    wrap="word"
)

creative_lock_text.pack(
    padx=20,
    pady=5
)


must_avoid_label = tk.Label(
    root,
    text="禁止出现的内容（Must Avoid）："
)

must_avoid_label.pack()


must_avoid_text = tk.Text(
    root,
    height=4,
    width=75,
    wrap="word"
)

must_avoid_text.pack(
    padx=20,
    pady=5
)


generate_button = tk.Button(
    root,
    text="生成 Trace",
    command=generate_current_mode
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
