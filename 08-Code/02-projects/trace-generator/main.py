from openai import OpenAI
from dotenv import load_dotenv
import json
from datetime import datetime
import tkinter as tk
from tkinter import messagebox

load_dotenv()

client = OpenAI()

def generate_trace():
    memory = memory_text.get("1.0", tk.END).strip()

    if not memory:
        messagebox.showwarning("提示", "请先输入一段记忆。")
        return

    generate_button.config(state="disabled", text="生成中...")

    try:
        response = client.responses.create(
            model="gpt-5.6-luna",
            input=f"""
你是 Trace Generator，一个用于实验影像创作的 AI 分析工具。

请分析下面这段记忆：

{memory}

只返回 JSON，不要添加其他解释。

必须包含以下字段：

emotion
trace
scene
visual
movement
shot
sound
duration
video_prompt

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
每项控制在1到2句话。
不要输出 JSON 以外的任何文字。
""",
            max_output_tokens=700
        )

        result_text = response.output_text
        trace = json.loads(result_text)

        result_box.delete("1.0", tk.END)

        result_box.insert(tk.END, f"核心情绪：\n{trace['emotion']}\n\n")
        result_box.insert(tk.END, f"留下的痕迹：\n{trace['trace']}\n\n")
        result_box.insert(tk.END, f"场景内容：\n{trace['scene']}\n\n")
        result_box.insert(tk.END, f"视觉语言：\n{trace['visual']}\n\n")
        result_box.insert(tk.END, f"运动与变化：\n{trace['movement']}\n\n")
        result_box.insert(tk.END, f"镜头建议：\n{trace['shot']}\n\n")
        result_box.insert(tk.END, f"声音设计：\n{trace['sound']}\n\n")
        result_box.insert(tk.END, f"时长与节奏：\n{trace['duration']}\n\n")
        result_box.insert(tk.END, f"AI 视频提示词：\n{trace['video_prompt']}\n")

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

        output_path = (
            "08-Code/02-projects/"
            "trace-generator/outputs/"
            f"trace-{timestamp}.json"
        )

        with open(output_path, "w", encoding="utf-8") as file:
            json.dump(
                trace,
                file,
                ensure_ascii=False,
                indent=4
            )

        messagebox.showinfo("完成", "分析完成，JSON 已保存。")

    except Exception as error:
        messagebox.showerror("错误", str(error))

    finally:
        generate_button.config(state="normal", text="生成 Trace")


root = tk.Tk()
root.title("Trace Generator v0.1")
root.geometry("700x750")

title_label = tk.Label(
    root,
    text="Trace Generator v0.1",
    font=("Arial", 20)
)
title_label.pack(pady=15)

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
memory_text.pack(padx=20, pady=10)

generate_button = tk.Button(
    root,
    text="生成 Trace",
    command=generate_trace
)
generate_button.pack(pady=10)

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
result_box.pack(padx=20, pady=10)

root.mainloop()