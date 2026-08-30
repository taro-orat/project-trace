# Day 13 — Research Question Tracker

原计划日期：2026-09-02

## 1. 今天的问题

今天主要的问题是：怎样让真实影像、AI 影像和身体交互真正进入现有 Trace System，而不是继续停留在“图片只是贴在画面上、鼠标只是一个操作工具”的阶段。

同时，今天开始暴露出一个更大的问题：虽然系统已经累积了 Behaviour、Media、Carry、Residual、Sound、Human/AI provenance 等机制，但当它们同时运行时，视觉层级不清楚，参数关系也不够明确。

今天的问题因此逐渐从“这个功能能不能工作”转向：

这些机制放在一起以后，是否还能形成一个清晰、可读、可继续发展的交互作品系统？

## 2. 做了什么实验

今天基于 interactive-trace-v08 创建并推进 interactive-trace-v09。

主要实验：

- 将 Human / AI Media 从显示图片进一步变成可读取的数据源
- 使用 loadPixels()、pixels[]、RGBA、brightness()、Sampling 和 map() 建立 Media Profile
- 接入 Camera 作为实时输入源
- 使用低密度 Pixel Sampling 和 Frame Difference 检测身体运动
- 获得 motionAmount 与 motionCenterX / Y
- 建立统一 Viewer Input，使 Camera 可以代替 Mouse 驱动现有 Behaviour
- Mouse 保留为 fallback
- 测试 Camera 驱动 MOVING、STAYING、Gathering、Leaving / OUTSIDE、Carry、Residual 与 Re-entry
- 使用简化 Debug HUD 测试 Camera Presence / Leaving heuristic
- 完成 v09 Overall Ugly Run，让现有机制联合运行，而不是继续只测试单个功能

## 3. 看到了什么

技术上，Camera 已经可以粗略代替 Mouse 成为观众输入。身体移动、停留、离场和重新进入基本能够触发现有 Behaviour。

这说明：

Input 可以被替换，而 Behaviour 不一定需要跟着整体重写。

但联合运行后暴露出明显问题：

- Human / AI 图片整体太暗，而且大量方块重复后非常像规则纹理或 wallpaper
- 均匀 source 分布缺乏层级、空区和局部密度变化
- Gathering 虽然机制成立，但视觉上进一步放大了方块化问题
- STAYING Shadow → Leaving → Residual 的视觉接力不连续
- 离开后 Residual / Leaving Visual 虽然代码上仍存在，但视觉过弱，肉眼容易感觉影子突然消失
- 单纯通过不断叠黑、增加 alpha 表达痕迹积累，可能最终形成无法区分历史层次的一团暗块
- 灰色 Carry 当前具有一定视觉潜力，可继续作为测试候选
- distance / intensity / instability / persistence 等现有参数是否全部必要，需要重新判断
- Sound 目前还没有真正成为系统材料
- 当前系统最大问题已经不只是视觉丑，而是模块耦合较强，修改一处容易牵动其他部分
- Camera STAYING 响应仍偏慢，但对于当前 prototype 暂时接受

因此 v09 更像一个成功的诊断原型：它没有证明旧系统应该继续精修，而是证明正式版本需要重新搭架构。

## 4. 明天因此想问什么

Day 14 继续把当前旧系统尽可能完整地跑完，而不是提前正式重构。

明天主要想确认：

当 Camera、Media-as-Data、Human/AI provenance、Gathering、Carry、Residual、Sound、Web Bridge 等现有机制真正联合运行时，这套旧系统还会暴露哪些问题？

尤其需要进一步确认：

- Sound 是否真正与交互过程形成关系
- 长时间运行后视觉是否越来越混乱
- Carry / Residual / Media 在完整生命周期中的接力是否成立
- Human / AI 的区别是否仍能被感知
- 哪些机制只是技术上存在，但对作品实际上没有贡献
- 哪些问题值得在 v10 做最低限度粗修，哪些必须留到正式重构

Day 14 的目标不是把旧系统变漂亮，而是把旧体系彻底跑完并形成完整问题清单。

## 5. Key Terms

- Pixel — 像素
- RGBA — 红 / 绿 / 蓝 / 透明度通道
- Pixel Sampling — 像素采样
- Brightness — 亮度
- Media as Data — 媒体作为数据
- Frame Difference — 帧差分
- Motion Detection — 运动检测
- Motion Amount — 运动量
- Motion Center — 运动中心
- Viewer Input — 观众输入
- Input Layer — 输入层
- Behaviour Layer — 行为层
- Presence Detection — 在场检测
- Fallback — 备用输入 / 降级方案
- Visual Continuity — 视觉连续性
- Residual — 残留痕迹
- Carry — 携带痕迹
- Modularity — 模块化
- Replaceability — 可替代性
- Quality Profile — 质量配置
- Ugly Final / Diagnostic Prototype — 粗糙终版 / 诊断原型

## 6. English Seed

The camera was introduced as a new viewer input rather than a replacement for the existing behaviour system.

The experiment revealed that the main problem was no longer whether each mechanism worked, but whether the mechanisms could remain readable when combined into one system.

The next version should treat input, behaviour, interpretation, material and output as replaceable layers instead of tightly coupled parts.
