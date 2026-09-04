# Day 14 — Research / Development Log

原计划日期：2026-09-03

## Day14 总结

Day14 完成了 Case01《消逝的痕迹》的 Ugly Final 收束。

interactive-trace-v09 现在是一个完整但粗糙的功能诊断原型：它证明了旧实验能力可以被串成一条运行链，也暴露了正式重建时必须解决的架构、视觉、声音和长期运行问题。它不是最终作品，也不是正式 System01。

总体判断：

- Ugly Final functional prototype — **PASS**
- Trace Log v0.2 — **PASS**
- 已导出生命周期链的连续验证 — **PASS**，但不包含本次运行的 OUTSIDE → MOVING 证据
- OUTSIDE → MOVING → STAYING 的完整本次导出证据 — **INCONCLUSIVE**
- Sound 技术接入 — **PASS**
- Sound 作为正式 Case01 声音方案 — **FAIL**
- Long-run performance — **INCONCLUSIVE**
- Day14 继续修 v09 — **PASS：按计划停止**

## 1. 今天的问题

今天的问题是：旧 Project Trace 的实验机制能否在不继续视觉重设计和不进行正式重构的前提下，形成一条可观察、可重复、可交接的完整运行链？

需要特别确认：

- Behaviour 是否能完成停留、离开、携带、残留和重新进入
- Sound 是否只读取 Behaviour，而不会反向污染 Behaviour
- Trace Log 是否能记录一次真实运行的关键事件
- 长时间运行风险是否已经被确认，还是仍然只能作为风险
- 哪些问题应当停止在 v09，交给 Day15 的独立 System / Case 重建

## 2. 做了什么实验

### 2.1 Ugly Final 联合运行

运行 interactive-trace-v09，让既有的 Input、Behaviour、Media、Gathering、Carry、Residual、Sound 和 Web Bridge 联合工作。

结果：**PASS**。v09 形成了 Case01《消逝的痕迹》的完整但粗糙功能模型。

### 2.2 Trace Log v0.2

在不改变 Behaviour、视觉、Sound、Camera 或 fragment 生命周期的前提下，加入轻量事件型日志：

- `RUN_START`
- `INPUT_SOURCE_CHANGE`
- `STATE_CHANGE`
- `STOP_BEGIN`
- `STOP_LEAVE`
- `CARRY_ASSIGNED`
- `RESIDUAL_FROZEN`
- `REENTRY_DETECTED`
- `STOP_SUMMARY`
- `SOUND_UNLOCKED`
- `SOUND_UNAVAILABLE`
- `PERFORMANCE_SAMPLE`
- `TRACE_RESET`

同时提供：

```js
window.exportTraceLog()
window.clearTraceLog()
```

结果：**PASS**。日志已经足够支持 Day14 的诊断型生命周期记录；没有增加逐帧日志，也没有建立 UI 或自动下载流程。

### 2.3 生命周期验证

通过人工操作和 Trace Log 重复验证以下链路：

```text
STAYING
→ MOVING
→ STOP_LEAVE
→ RESIDUAL_FROZEN
→ CARRY_ASSIGNED
→ STAYING
→ REENTRY_DETECTED
→ STOP_BEGIN
```

结果：**PASS**。该链重复运行多次成功。

边界：本次正式导出的 Trace 从已经处于 `STAYING` 的状态开始，因此没有形成 `OUTSIDE → MOVING` 的完整证据。完整 OUTSIDE lifecycle 结论为 **INCONCLUSIVE**，不能写成已完全验证。

### 2.4 Sound 检查

确认 Sound 读取 Behaviour 和相关 source / ghost / residual 数据，没有发现反向写入 Behaviour 的路径。

结果：

- 技术功能 — **PASS**
- 反向污染 Behaviour — **PASS：未发现**
- 当前固定 oscillator / 高频低频音作为正式声音 — **FAIL**

当前音频只能作为 technical placeholder。Case01 Rebuild 应改用导入的真实或设计音频素材，未来 System01 的 Sound Module 需要支持可替换的 Case audio source。Debug / fallback tone 可以保留，但不能成为正式作品声音。

### 2.5 Debug HUD 检查

当前 `STATE / CANDIDATE / LEAVING` HUD 对诊断有帮助。

结果：**PASS：作为 Debug 工具**；**FAIL：作为正式视觉**。Case01 Rebuild 中应默认隐藏或提供切换，不应把 Debug HUD 当作作品视觉的一部分。

### 2.6 Long-run 观察

在本次 Trace 中观察到 `fragments` 和 `imprints` 数量持续增加。

结果：**INCONCLUSIVE**。这说明存在潜在长期性能风险，但由于用户提前结束 long-run test，不能确认系统最终一定卡顿，也不能确认风险的具体阈值。

Day14 不再继续测试或优化。正式 long-run test 留给 Clean Rebuild 完成后执行。

## 3. 看到了什么

### 已确认

- 旧系统可以形成一条可重复的 stop / leave / residual / carry / re-entry 运行链。
- Trace Log v0.2 可以记录关键事件，而不需要逐帧记录。
- Sound 可以作为读取层存在，没有发现其反向改变 Behaviour。
- v09 足以作为 Ugly Final 和 Day15 handoff 的诊断证据。

### 未确认

- 本次导出没有证明 OUTSIDE → MOVING 的完整链路。
- 未确认 5–10 分钟 long-run 后系统是否最终卡顿。
- 未确认 fragments / imprints 的持续增长在真实长时间运行中的最终影响。
- 未确认当前 Sound placeholder 是否能形成可接受的 Case01 审美体验；目前作为正式方案应判定为 FAIL。

### 诊断性问题

- 旧系统的模块已经过度耦合，继续精修容易牵动多个层 — **PASS：作为 Day15 重建判断**。
- 现有视觉、材质和 Sound placeholder 不能直接成为正式作品方案 — **FAIL：作为正式方案**。
- Camera heuristic、fragment / imprint 生命周期和状态表达都适合在新的架构中重新定义 — **INCONCLUSIVE：作为长期方案，留待重建验证**。
- Debug 能力对验证很有价值，但不应混入正式视觉 — **PASS：作为诊断工具；FAIL：作为正式视觉**。

## 4. Day14 决策

Day14 不再修改以下内容：

- 不拆分 10k 行 `sketch.js`
- 不重做 Behaviour state machine
- 不把 `LEAVING` 改成正式 viewer state
- 不重构 fragment / imprint lifecycle
- 不重做 Camera heuristic
- 不重做视觉、材质或 Sound
- 不重构 Web Bridge
- 不做正式性能优化

这些事项统一交给 Clean Rebuild，不在 v09 上继续累积修补。

## 5. Day15 Handoff

Day15 不继续修 interactive-trace-v09。

### 独立 AI Systems 工程

在 Mac Documents 中新建独立工程，起点为：

- `System01`
- 后续 `System02 / System03 / System04`

它们完全独立于旧 Project Trace。System01 未来负责可复用能力：

- Input
- Interpretation
- Behaviour
- Renderer
- Media
- Sound
- Logging / Observability

### 新 Project Trace Rebuild

在 Mac Documents 中另开新的 Project Trace Rebuild。它仍然是 Case01《消逝的痕迹》，但与旧 Project Trace 分离。

Case01 Rebuild 负责：

- Concept
- Research
- Assets
- Creative Direction
- Case-specific configuration / logic
- Portfolio / Documentation

新 Case01 Rebuild 调用 System01；System 与 Case 不再混在同一工程架构里。旧 Project Trace 保留为历史项目。

## 6. Research Question Tracker

### 今天的问题

旧 Project Trace 的机制能否形成一条可重复、可观察的完整运行链，并能否在 Day14 明确区分已经证明的能力、失败的正式方案和仍然未确认的长期风险？

### 做了什么实验

- 对 interactive-trace-v09 进行 Ugly Final 联合运行
- 增加事件型 Trace Log v0.2
- 重复人工验证 STAYING、leave、residual、carry、re-entry 和新 stop
- 检查 Sound 是否读取 Behaviour 且不反向污染 Behaviour
- 观察 fragments / imprints 的增长趋势
- 保持 v01–v08 只读，不进行 Day15 重构

### 看到了什么

- **PASS**：v09 是完整但粗糙的 Case01 功能模型。
- **PASS**：Trace Log v0.2 能记录关键生命周期事件。
- **PASS**：`STAYING → MOVING → STOP_LEAVE → RESIDUAL_FROZEN → CARRY_ASSIGNED → STAYING → REENTRY_DETECTED → STOP_BEGIN` 重复成功。
- **PASS**：Sound 技术读取层未发现反向污染 Behaviour。
- **FAIL**：当前 oscillator / 固定音频不适合作为正式 Case01 声音。
- **FAIL**：Debug HUD 不应成为正式作品视觉。
- **INCONCLUSIVE**：本次导出没有 OUTSIDE → MOVING 证据。
- **INCONCLUSIVE**：long-run 最终性能影响未确认。

### 明天因此想问什么

在完全独立的 System01 与 Project Trace Rebuild 中，如何把已经验证的交互能力重新组织成可替换、可测试、可复用的模块，同时让 Case01 保持自己的概念、素材、声音和创作方向？

### Key Terms 中英

- Ugly Final — 粗糙终版
- Diagnostic Prototype — 诊断原型
- Lifecycle Verification — 生命周期验证
- Event-driven Logging — 事件驱动日志
- Observability — 可观测性
- State Transition — 状态转移
- Stop Event — 停留事件
- Residual Imprint — 残留印记
- Carry Assignment — 携带分配
- Re-entry — 重新进入
- Technical Placeholder — 技术占位方案
- Replaceable Audio Source — 可替换音频源
- Long-run Performance — 长时间运行性能
- Inconclusive Result — 未定论结果
- System / Case Separation — 系统与案例分离
- Clean Rebuild — 清洁重建

### English Seed

Day 14 closed the old prototype as an Ugly Final diagnostic model for Case01, “Traces of Disappearance.” The system repeatedly demonstrated the core handoff from staying to leaving, residual memory, carried traces, re-entry, and a new stop. Trace Log v0.2 made these transitions observable without changing the behaviour system.

The result is intentionally not a final artwork or System01. Sound passed as a technical read-only layer but failed as a formal artistic solution because the current oscillator tones are only placeholders. Long-run performance remains inconclusive because the test ended before system failure could be established.

Day 15 will begin two independent projects: a reusable AI Systems project starting with System01, and a new Project Trace Rebuild for Case01. The old Project Trace remains a historical record.
