# Trace Log

Trace Log 用于记录一次运行“发生了什么”。

- README：项目怎么工作
- Trace Log：一次运行发生了什么
- Research Question Tracker：从实验中发现了什么
- Portfolio：为什么作品值得展示

当前格式为 JSONL（JSON Lines），一行代表一次 run。

v0.1 只记录关键事件，不记录每帧 position、所有粒子状态、音频波形或大量 performance profiling。

后续可以从手工记录升级为显式导出，再到后端自动接收，最后考虑 Evals / quality monitoring。
