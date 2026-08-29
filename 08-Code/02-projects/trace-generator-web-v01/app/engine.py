from datetime import datetime
import json
import math
from pathlib import Path
import uuid

from dotenv import load_dotenv
from openai import OpenAI


load_dotenv()

client = OpenAI()

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUTS_DIR = BASE_DIR / "outputs"

MODEL = "gpt-5.6-luna"
INPUT_PRICE_PER_MILLION_USD = 0.20
OUTPUT_PRICE_PER_MILLION_USD = 1.20
OUTPUT_WARNING_TOKENS = 700
MAX_OUTPUT_TOKENS = 1400
PARAMETER_MAX_OUTPUT_TOKENS = 200
INPUT_TOKEN_WARNING = 1500

TRACE_SCHEMA = {
    "type": "object",
    "properties": {
        "emotion": {"type": "string"},
        "trace": {"type": "string"},
        "scene": {"type": "string"},
        "visual": {"type": "string"},
        "movement": {"type": "string"},
        "shot": {"type": "string"},
        "sound": {"type": "string"},
        "duration": {"type": "string"},
        "video_prompt": {"type": "string"},
    },
    "required": [
        "emotion", "trace", "scene", "visual", "movement", "shot",
        "sound", "duration", "video_prompt",
    ],
    "additionalProperties": False,
}

PARAMETER_SCHEMA = {
    "type": "object",
    "properties": {
        "intensity": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "instability": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "persistence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "distance": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
    "required": ["intensity", "instability", "persistence", "distance"],
    "additionalProperties": False,
}
PARAMETER_FIELDS = tuple(PARAMETER_SCHEMA["required"])


class IncompleteNarrativeOutputError(RuntimeError):
    """The Narrative response stopped because it reached its output limit."""


def save_output_json(filename, payload):
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUTS_DIR / filename
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=4)
    return output_path


def unique_filename(prefix):
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    return f"{prefix}-{timestamp}-{uuid.uuid4().hex}.json"


def build_text_format(schema_name, schema):
    return {"format": {"type": "json_schema", "name": schema_name,
                        "strict": True, "schema": schema}}


def estimate_cost(prompt, schema, max_output_tokens):
    text_format = build_text_format("estimate", schema)
    token_count = client.responses.input_tokens.count(
        model=MODEL, input=prompt, text=text_format
    )
    estimated_input_tokens = token_count.input_tokens
    estimated_input_cost = estimated_input_tokens / 1_000_000 * INPUT_PRICE_PER_MILLION_USD
    estimated_max_output_cost = max_output_tokens / 1_000_000 * OUTPUT_PRICE_PER_MILLION_USD
    return {
        "input_tokens": estimated_input_tokens,
        "max_output_tokens": max_output_tokens,
        "estimated_max_cost_usd": estimated_input_cost + estimated_max_output_cost,
        "warning": estimated_input_tokens > INPUT_TOKEN_WARNING,
    }


def call_structured_ai(prompt, schema_name, schema, max_output_tokens):
    text_format = build_text_format(schema_name, schema)
    response = client.responses.create(
        model=MODEL, input=prompt, text=text_format,
        max_output_tokens=max_output_tokens,
    )
    actual_input_tokens = response.usage.input_tokens
    actual_output_tokens = response.usage.output_tokens
    actual_total_tokens = response.usage.total_tokens
    actual_cost = (
        actual_input_tokens / 1_000_000 * INPUT_PRICE_PER_MILLION_USD
        + actual_output_tokens / 1_000_000 * OUTPUT_PRICE_PER_MILLION_USD
    )
    print("实际输入 Tokens:", actual_input_tokens)
    print("实际输出 Tokens:", actual_output_tokens)
    print("总 Tokens:", actual_total_tokens)
    print("实际估算成本 USD:", f"${actual_cost:.6f}")
    if schema_name == "trace_analysis" and (
        getattr(response, "status", None) == "incomplete"
        or actual_output_tokens >= max_output_tokens
    ):
        raise IncompleteNarrativeOutputError(
            "Narrative output reached the configured token limit."
        )
    return response.output_text, {
        "input_tokens": actual_input_tokens,
        "output_tokens": actual_output_tokens,
        "total_tokens": actual_total_tokens,
        "estimated_cost_usd": actual_cost,
    }


def _constraint_text(items):
    return "\n".join(f"- {item}" for item in items) or "- 无"


def build_trace_prompt(memory, creative_lock, must_avoid):
    return f"""
你是 Trace Generator，一个用于实验影像创作的 AI 分析工具。

请分析下面这段记忆：

{memory}

用户指定的 Creative Lock（必须保留的视觉元素）：
{_constraint_text(creative_lock)}

用户指定的 Must Avoid（绝对禁止出现的内容）：
{_constraint_text(must_avoid)}

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


def build_parameter_prompt(memory, creative_lock, must_avoid):
    return f"""
你是 Trace Generator 的 Parameter Mode。

你的任务是把用户提供的语言、记忆和 Human Constraints 翻译成四个 semantic parameters。你只负责语义翻译，不负责决定最终视觉。

Memory / Prompt：
{memory}

Creative Lock（Human Input / Human Constraint，必须保留）：
{_constraint_text(creative_lock)}

Must Avoid（Human Input / Human Constraint，必须避免）：
{_constraint_text(must_avoid)}

请只输出四个归一化的 semantic parameters，每个值在 0.0 到 1.0 之间。

intensity：这段记忆整体的感受强度、心理显著程度。0 = 极弱 / 几乎没有显著性；1 = 极强 / 极度显著。

instability：已存在痕迹的位置、形态或状态的不稳定程度，判断痕迹是否容易偏移、摇摆、变形或持续变化。0 = 稳定、固定；1 = 高度偏移、波动、不稳定。不要把记忆内容是否真实或清楚当作 instability。

persistence：这段记忆持续存在、反复返回、不易消失的程度。0 = 很容易消退；1 = 极强地持续存在 / 反复返回。

distance：这段记忆与“现在”的心理 / 时间距离感。0 = 感觉非常接近现在；1 = 感觉非常遥远。

这些是 Semantic Parameters，不是 Visual Parameters。不要输出或推导 particleCount、circleSize、whiteness、颜色、decay、尺寸、p5.js 参数或任何 final visual setting。

Creative Lock 和 Must Avoid 只是 Human Constraints：不能成为输出字段，不能被重写，也不能被转换成视觉参数。
"""


def validate_parameter_output(parameter_output):
    if not isinstance(parameter_output, dict):
        raise ValueError("Parameter 输出必须是 JSON object。")
    expected_keys = set(PARAMETER_FIELDS)
    actual_keys = set(parameter_output.keys())
    if actual_keys != expected_keys:
        missing = expected_keys - actual_keys
        extra = actual_keys - expected_keys
        details = []
        if missing:
            details.append("缺少字段：" + ", ".join(sorted(missing)))
        if extra:
            details.append("额外字段：" + ", ".join(sorted(extra)))
        raise ValueError("Parameter 字段不符合要求。 " + "；".join(details))
    validated = {}
    for field in PARAMETER_FIELDS:
        value = parameter_output[field]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"Parameter {field} 必须是 number。")
        if not math.isfinite(value) or not 0.0 <= value <= 1.0:
            raise ValueError(f"Parameter {field} 必须在 0.0 到 1.0 之间。")
        validated[field] = float(value)
    return validated


def build_parameter_payload(memory, creative_lock, must_avoid, ai_parameters):
    validated = validate_parameter_output(ai_parameters)
    return {
        "mode": "parameter",
        "schema_version": "parameter-v1",
        "input": {"memory": memory,
                   "creative_lock": {"source": "user", "items": creative_lock},
                   "must_avoid": {"source": "user", "items": must_avoid}},
        "ai_parameters": validated,
        "human_parameters": dict(validated),
        "provenance": {"input": "human", "ai_parameters": "ai",
                        "human_parameters": "human_editable_copy"},
    }
