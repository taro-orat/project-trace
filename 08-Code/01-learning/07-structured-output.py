from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

memory = input("请输入一段记忆：")

response = client.responses.create(
    model="gpt-5.6",
    input=f"""
你是一名实验影像创作研究助手。

请分析下面这段记忆：

{memory}

请严格按照以下结构回答：

核心情绪：
留下的痕迹：
视觉元素：
声音元素：
镜头建议：
AI视频提示词：
""",
    max_output_tokens=200
)

result = response.output_text

print(result)