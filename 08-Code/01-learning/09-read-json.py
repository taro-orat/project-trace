import json

with open("08-Code/01-learning/trace-test.json", "r", encoding="utf-8") as file:
    trace = json.load(file)

print("情绪：", trace["emotion"])
print("痕迹：", trace["trace"])
print("视觉：", trace["visual"])
print("声音：", trace["sound"])