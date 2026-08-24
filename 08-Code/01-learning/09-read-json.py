import json

def read_trace():
    try:
        with open("08-Code/01-learning/trace-test.json", "r", encoding="utf-8") as file:
            trace = json.load(file)

        return trace

    except FileNotFoundError:
        print("错误：找不到 JSON 文件。")
        return None


trace_data = read_trace()

if trace_data is not None:
    print("情绪:", trace_data["emotion"])
    print("痕迹:", trace_data["trace"])
    print("视觉:", trace_data["visual"])
    print("声音:", trace_data["sound"])