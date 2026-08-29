# Day 12 Research Question Tracker

Planned Date: 2026-09-01

## 1. 今天的问题

当真实照片和 AI 生成影像进入 interactive-trace 系统之后，它们怎样才能真正成为“痕迹”，而不是只是被贴在原有 source 上的图片？

今天的实验让我发现，媒体进入系统之后，问题不只在视觉本身，还会同时影响性能、状态之间的连续性，以及不同 Visual Layer 之间的关系。因此，后续需要继续研究：如何让 Human / AI 的媒体材质能够在不修改 Behaviour 的情况下，自然地贯穿 MOVING、STAYING、gathering、carry 和 residual 等状态。

## 2. 做了什么实验

今天在 `interactive-trace-v08` 中加入了 Human 和 AI 两类静态影像。

AI source 使用 AI 生成影像，Human source 使用真实照片。最初先将图片接入 ambient source，随后尝试继续接入 STAYING / gathering 状态。

同时测试了：

- 图片加载与 fallback；
- 图片尺寸和透明度调整；
- 图片分辨率压缩；
- p5.js 图片绘制性能；
- Canvas `drawImage()`；
- Human / AI 双来源媒体化；
- 原有抽象材质与新媒体材质之间的兼容关系；
- Trace Log v0.1 的基础结构。

## 3. 看到了什么

真实影像进入系统后，并不会自动变成一个成立的“痕迹”。

首先，大量 source 同时绘制图片会明显增加运行负担。即使降低图片分辨率，仍然存在一定卡顿，说明问题不仅来自素材尺寸，也来自大量实时图片绘制和合成。

其次，当 ambient source 改成图片后，STAYING、gathering、carry、residual 等状态仍然可能继续使用原来的抽象材质，因此不同阶段会出现视觉不连续。

这说明目前 Behaviour Layer 与 Visual Layer 已经基本分离，但 Visual Layer 内部仍然存在较强耦合。未来如果只是分别修改每一个绘制函数，那么每次更换视觉语言都会产生大量重复修改。

今天因此确认：后续需要建立更统一的 Material / Media Renderer，使 Human 和 AI 的视觉材质可以被整体替换，而 Behaviour 不需要跟着重做。

## 4. 明天因此想问什么

如果 Human / AI 的视觉不再分别写死在 ambient、gathering、carry、residual 等函数中，而是通过一个统一的 Material Renderer 管理，那么怎样设计这个接口，才能让同一套 Behaviour 在图片、视频、纹理或其他媒体之间自由切换？

同时需要继续验证：新的媒体视觉架构能否完整贯穿 MOVING → STAYING → gathering → LEAVING → carry → residual，而不破坏原有 provenance 和 interaction logic。

## 5. Key Terms

- Media Trace — 媒体痕迹
- Material Renderer — 材质渲染器
- Media Renderer — 媒体渲染器
- Visual Layer — 视觉层
- Behaviour Layer — 行为层
- State-to-Visual Mapping — 状态到视觉的映射
- Rendering Performance — 渲染性能
- Fallback — 回退机制
- Traceability — 可追踪性
- Reproducibility — 可复现性
- Trace Log — 运行轨迹日志
- JSONL / JSON Lines — JSON 行格式
- Visual Coupling — 视觉耦合
- Provenance — 来源追踪

## 6. English Seed

Media does not automatically become a trace simply by replacing abstract particles with images.

The next step is to separate visual material from behaviour, so that the same interaction system can support different media without rebuilding its underlying logic.