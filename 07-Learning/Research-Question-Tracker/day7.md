

今天的问题

痕迹是否一开始就已经存在？
如果痕迹本来就存在，当人进入其中以后，它会因为人的作用持续聚集、消散，还是发生其他变化？
当人离开以后，痕迹是留在原地，还是会有一部分被一起带走？
如果不同的人不断进入、停留和离开，原本属于个人的痕迹最后会不会逐渐变成群体的痕迹？



今天做了什么

今天把之前 Processing 中关于痕迹、聚集和观众关系的实验迁移到了 p5.js，并开始制作 Interactive Trace。
我尝试让痕迹不是由观众凭空产生，而是在空间中原本就已经存在。
观众进入以后，会扰动已有痕迹；停留以后，痕迹逐渐在身体周围沉积；离开以后，一部分痕迹留在原地，一部分被带走。
同时开始测试停留时间和痕迹残留之间的关系。



我尝试了

把 Processing 项目迁移到 p5.js
用 MOVING / STAYING 等状态区分人的移动和停留
让空间中预先存在痕迹，而不是由鼠标直接生成痕迹
让停留时间影响痕迹的数量、完整程度和深浅
让短时间停留留下较浅、不完整的痕迹
让较长时间形成的痕迹在离开以后逐渐衰减
测试一部分痕迹被人带走，另一部分留在原地
测试不同停留产生的痕迹继续互相叠加
制作 Interactive Trace v01 和 v02
在 v02 中尝试：
长期痕迹 = 约 7 秒基础痕迹 + 超过 7 秒部分的 10%
同时使用 AI / Codex 不断修改和调试代码



我实际观察到

当痕迹被设定为在人进入以前就已经存在以后，人的角色开始发生变化。
人不再只是“制造痕迹”，而更像是在扰动、聚集、携带和重新分配已经存在的痕迹。
停留时间也开始让不同痕迹产生差异：有些痕迹很浅，有些因为停留更久而逐渐变深；人离开以后，一部分痕迹仍然留在原来的位置，而另一部分可以跟随人继续移动。
但是目前的视觉效果并不好。
它仍然很像普通的粒子互动练习：粒子绕来绕去，很糊，也有明显的像素玩具感。视觉语言很简单，功能也显得单一，还没有达到我想要的高级、自然和具有作品感的状态。
我更想要一种类似“萤火虫痕迹”的感觉，而不是一堆方形粒子。
今天有些画面偶尔又让我想到水墨，但我还不知道这是不是之后真正想继续发展的方向。
另外一个意外的观察来自 AI 本身。
在让 AI 修改代码的时候，即使某些部分之前已经成立，它也可能在解决新问题时把原本好的部分一起改掉。
同一套代码在不断修改的过程中，也会发生保留、覆盖、丢失和重新生成。
AI 好像也并没有稳定地“记住”之前已经发生过什么。



这个结果让我产生了什么新问题

如果人不是痕迹的制造者，而只是不断激活、扰动和重新排列已有痕迹，那么痕迹真正的来源是什么？
一个人留下的痕迹，在什么时候还属于这个人，又在什么时候因为不断被其他人覆盖和叠加，变成了群体的痕迹？
人自身会不会也可以被理解成一个痕迹的集合体——不断携带一些痕迹，又不断在不同地方留下另一些痕迹？
如果痕迹会随着时间不断积累、消散、覆盖和被带走，那么最终留下来的东西究竟由什么决定？
另外，AI 在不断修改过程中产生的遗忘、覆盖和丢失，是否也可以被看作一种数字痕迹的变化？
这个问题目前只作为观察保留，还不确定是否会进入主要研究方向。



Key Terms

已有痕迹 / Pre-existing Trace
互动痕迹 / Interactive Trace
聚集 / Accumulation
消散 / Dissipation
残留 / Residue
携带 / Carrying
覆盖 / Overwriting
叠加 / Layering
个体痕迹 / Individual Trace
群体痕迹 / Collective Trace
时间 / Time
遗忘 / Forgetting



English Seed

A trace may already exist before a person enters the space.
The viewer does not simply create traces, but disturbs, accumulates, carries, and redistributes what is already there.
As different traces remain, disappear, and overlap over time, an individual trace may gradually become part of a collective trace.
The instability of AI editing also makes me wonder whether forgetting, overwriting, and reconstruction can themselves become forms of digital trace.