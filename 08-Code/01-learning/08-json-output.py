from openai import OpenAI
from dotenv import load_dotenv
import json

load_dotenv()

client = OpenAI()

memory = "狗窝狗坐了离开后凹陷的痕迹。"

response = client.responses.create(
    model="gpt-5.6-luna",
    input=f"""
你是一名实验影像创作研究助手。

请分析下面这段记忆：

{memory}

只返回 JSON，不要添加其他解释。

JSON 必须包含以下六个字段：

emotion
trace
visual
sound
shot
video_prompt

每个字段简洁回答，控制在1到2句话。
""",
    max_output_tokens=500
)

result_text = response.output_text

print("AI 原始返回：")
print(result_text)

trace = json.loads(result_text)

print("\n单独读取 emotion：")
print(trace["emotion"])

print("\n单独读取 visual：")
print(trace["visual"])

with open(
    "08-Code/01-learning/trace-test.json",
    "w",
    encoding="utf-8"
) as file:
    json.dump(
        trace,
        file,
        ensure_ascii=False,
        indent=4
    )

print("\nJSON 文件保存成功")