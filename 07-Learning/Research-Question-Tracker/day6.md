
今天的问题

今天开始关注的重点已经不只是“痕迹可以呈现成什么视觉效果”，而是痕迹与进入画面的主体之间能够形成什么关系。实验过程中逐渐明确，我目前更感兴趣的并不是“观众经过以后制造新的痕迹”，而是一个已经存在痕迹的空间：观众进入以后，原有痕迹被激活，并开始贴附、覆盖或包围观众。这里暂时不确定这些行为最终意味着什么，也不确定“覆盖”“包围”是否会成为最终机制。



做了什么实验

今天用 Processing 建立了一个多对象系统。先实验了由观众位置直接产生覆盖层，后来改为让痕迹预先存在，再由观众激活它们。过程中继续拆分成固定存在的 TraceSource 和动态产生、具有生命周期的 TraceFragment。动态碎片会向当前观众位置缓慢贴附，之后溃散，而底层痕迹仍然留在空间中。之后又实验了 PImage，把几何对象替换为可以携带不同图片的二维图像对象，并开始把同样的 Class / Object / Array 思维迁移到 p5.js。



看到了什么

最开始让所有痕迹直接追随观众，会导致它们迅速聚集成一个白色团块，同时其他区域被抽空。让痕迹离开观众以后重新回到原位置也不成立，因为这样互动结束后系统实际上没有发生真正改变。把系统拆成“底层痕迹 + 动态碎片”以后，空间能够持续保有痕迹，同时局部发生贴附、覆盖和溃散，这个机制目前更接近想继续观察的方向。视觉上目前仍然比较初步，白色矩形只是测试材料，并不代表最终视觉语言。



明天因此想问什么

如果痕迹本来已经存在，而观众只是激活它们，那么一次激活之后，这些痕迹究竟应该发生什么不可逆的变化？另外，如果同时存在多个观众，每个人面对的是同一个痕迹系统，还是每个人都会激活不同的一部分？不同人的进入是否应该累积成同一空间的历史状态？这些问题暂时保留给后面的实验验证，而不是现在直接给答案。



Key Terms

Object System — 对象系统
State — 状态
Lifecycle — 生命周期
Activation — 激活
Attachment — 贴附
Accumulation — 累积
Fragment — 碎片
Trace Source — 痕迹源 / 底层痕迹
Viewer — 观看者 / 参与者
Interaction — 交互
Persistent State — 持续状态 / 保留状态
Transformation — 转变
6｜English Seed



English Seed

The viewer does not necessarily create the trace; their presence may activate traces that already exist.What changes when a trace acts upon the viewer instead of being produced by the viewer?

