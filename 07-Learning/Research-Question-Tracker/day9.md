（ai）
## 今天的问题

今天开始关注：当环境中原本存在的 Human / AI 痕迹被重新组织成影子，并继续被带到下一个位置时，什么才能让观众真正感受到“这是同一个痕迹在迁移”，而不是一个新的影子被重新生成？同时，`distance / fragmentation / persistence` 这些 Semantic Parameters 应该怎样进入交互系统，既产生真实差异，又不破坏 v03 已经成立的停留、离开、carry 和 residual 机制？

## 做了什么实验

今天先在 `interactive-trace-v04` 中尝试把 Human 和 AI 从原本同一个 `TraceSource` 里的红蓝双 pass，拆成具有独立 `sourceId` 和 `sourceType` 的真实环境元素，并进一步尝试建立 `Ambient → Imprint Membership → Carried Shape → Next Imprint` 的连续数据链。随后将 `distance` 用于 Human / AI 各自的停留作用范围，尝试让真实环境 source 进入同一个影子；将 `fragmentation` 定义为影子内部碎片的 gap 和局部错位；将 `persistence` 放到被带走的 cluster 内，控制 Human / AI 元素在移动过程中的保留程度。`uncertainty` 曾尝试用于移动和停留时的波动，但实际效果不成立，因此最终保留字段但暂不启用。

在浏览器测试中，这套重构出现了明显问题：STAYING 时附近环境痕迹会突然被清空，空白处又重新出现红色碎片；AI contribution 很弱；原本 v03 已经可以工作的 carry 被破坏，新的 cluster cut / carried shape 在视觉上没有真正出现；声音 first-pass 也变成了类似电视无信号的白噪音；Human / AI 的 material 仍然只是红蓝小点，没有真正变成“记忆图片碎片 + 半透明纸层”和“数据块”。因此最后停止继续修补当前 v04，决定保留它作为失败实验，从稳定的 v03 重新复制一份 `v04-rebuild`，优先保留 v03 已经成立的视觉和交互骨架，再增量加入新的参数、材质、切割和声音机制。

## 看到了什么

今天最明显的发现是：**数据连续性并不会自动产生感知连续性。** 即使程序内部证明某个 `sourceId` 从 Ambient 进入了 Imprint，如果视觉上表现为“原位置突然消失 → 人物位置重新出现”，观众仍然会把它理解成两个不同事件。相反，一个数据对象即使在程序里发生转换，只要材质、形状、运动方向和来源关系保持连续，反而更可能被感知成“同一个痕迹”。

今天也看到，环境痕迹的密度并不是单纯的背景视觉问题。如果严格按 Distance 只调用附近的真实 source，而环境本身过于稀疏，影子就没有足够材料形成。因此环境 source 的分布实际上已经成为交互机制的一部分。与此同时，Human / AI 的差异也不能只依赖红蓝颜色；如果它们未来要跨 Ambient、Imprint、Carry 和 Next Imprint 保持身份，那么 material 本身可能需要承担来源识别和连续性。最后，今天的失败实验也说明：在 Creative Technology 中，更“纯”的数据模型不一定带来更好的作品结果。当前更适合的策略，是先保住 v03 已经成立的视觉逻辑，再用 `sourceType / originSourceId` 等轻量 provenance 保留来源关系，而不是为了 canonical object continuity 破坏作品体验。

## 明天因此想问什么

如果不强求同一个 source object 在程序内部完整贯穿 Ambient、Imprint、Carry 和 Next Imprint，而是通过 provenance、材质身份、形状保持和连续运动去维持来源关系，是否反而能够更有效地让观众感受到“同一个痕迹在不同空间之间持续迁移”？

同时，新的 v04-rebuild 中，怎样在保留 v03 原有 carry 和 residual 感觉的前提下，让 `distance / fragmentation / persistence` 真正影响行为，而不是重新变成三种独立特效？

## Key Terms

Stable Identity｜稳定身份
Membership｜成员关系
Render Ownership｜渲染所有权
Perceptual Continuity｜感知连续性
Data Continuity｜数据连续性
Provenance｜来源追踪
Material Identity｜材质身份
State Transition｜状态切换
Visual Transition｜视觉过渡
Fragmentation｜碎片化 / 聚合破碎度
Persistence｜持续性
Distance Mapping｜距离映射
Carried Shape｜携带形状
Cluster Extraction｜连续簇提取
Recomposition｜重新组织
Scaffold｜脚手架 / 临时兼容结构

## English Seed

A trace can remain perceptually continuous even when its underlying data representation changes, as long as its provenance, material identity, shape, and movement remain recognizable.

Technical continuity does not automatically create perceptual continuity; the migration of a trace must also be visible as a continuous transformation rather than a disappearance and regeneration.

v04完全失败
Day 9 technical result:
v04 integration experiment failed browser acceptance.

Stable baseline remains:
interactive-trace-v03

Failed v04 attempts archived for research/reference.

Next implementation decision:
rebuild v04 incrementally from v03 with regression checks after every node.