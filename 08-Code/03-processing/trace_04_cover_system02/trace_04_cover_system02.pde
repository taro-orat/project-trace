// ==================================================
// Day 06
// Trace Cover System 02
//
// 底层痕迹一直存在
// 动态碎片缓慢贴附当前观众
// 越接近观众，视觉越厚
// 最后再溃散
// ==================================================


// --------------------------------------------------
// Array：固定盒子
// 永久存在的底层痕迹
// --------------------------------------------------

TraceSource[] sources = new TraceSource[100];


// --------------------------------------------------
// ArrayList：会伸缩的盒子
// 动态出生、死亡的碎片
// --------------------------------------------------

ArrayList<TraceFragment> fragments;



void setup() {

  size(800, 600);

  rectMode(CENTER);
  noStroke();

  fragments = new ArrayList<TraceFragment>();


  // 一开始空间里就已经存在痕迹
  for (int i = 0; i < sources.length; i++) {

    sources[i] = new TraceSource(
      random(width),
      random(height)
    );
  }
}



void draw() {

  background(0);


  // ==================================================
  // 1. 底层痕迹
  // ==================================================

  for (int i = 0; i < sources.length; i++) {

    TraceSource source = sources[i];

    source.update();
    source.display();


    // 当前底层痕迹和观众的距离
    float d = dist(
      source.x,
      source.y,
      mouseX,
      mouseY
    );


    // ------------------------------------------------
    // 观众靠近以后
    // 从附近已有痕迹中不断激活一些碎片
    // ------------------------------------------------

    if (
      d < 180 &&
      frameCount - source.lastEmit > 12 &&
      random(1) < 0.18
    ) {

      fragments.add(
        new TraceFragment(
          source.x,
          source.y
        )
      );


      // 记录上一次产生碎片的时间
      source.lastEmit = frameCount;


      // 观众经过的原位置会稍微变厚
      source.memory += 0.12;

      source.memory =
        constrain(source.memory, 0, 1);
    }
  }



  // ==================================================
  // 2. 动态碎片
  // ==================================================

  for (int i = fragments.size() - 1; i >= 0; i--) {

    TraceFragment fragment = fragments.get(i);

    fragment.update();
    fragment.display();


    if (fragment.isDead()) {

      fragments.remove(i);
    }
  }
}



// ==================================================
// CLASS 1
// TraceSource
//
// 原本就存在的底层痕迹
// ==================================================

class TraceSource {

  float x;
  float y;

  float w;
  float h;

  float baseAlpha;

  float memory;

  int lastEmit;



  // ------------------------------------------------
  // Constructor
  // 出生设置
  // ------------------------------------------------

  TraceSource(float startX, float startY) {

    x = startX;
    y = startY;

    w = random(70, 170);
    h = random(60, 150);

    baseAlpha = random(3, 8);

    memory = 0;

    lastEmit = -100;
  }



  // ------------------------------------------------
  // Update
  // ------------------------------------------------

  void update() {

    // 观众经过以后留下的厚度
    // 很缓慢地重新变淡
    memory -= 0.0012;

    memory =
      constrain(memory, 0, 1);
  }



  // ------------------------------------------------
  // Display
  // ------------------------------------------------

  void display() {

    float visibleAlpha =
      baseAlpha + memory * 12;

    fill(255, visibleAlpha);

    rect(
      x,
      y,
      w,
      h
    );
  }
}



// ==================================================
// CLASS 2
// TraceFragment
//
// 被激活出来、开始贴附观众的碎片
// ==================================================

class TraceFragment {

  float x;
  float y;

  float w;
  float h;

  float targetW;
  float targetH;

  float baseAlpha;

  float driftX;
  float driftY;

  float life;

  int age;



  // ------------------------------------------------
  // Constructor
  // ------------------------------------------------

  TraceFragment(
    float startX,
    float startY
  ) {

    x = startX;
    y = startY;


    // 每一个碎片的尺寸略有不同
    w = random(45, 105);
    h = random(40, 95);


    // 溃散以后产生一点形态变化
    targetW = w * random(0.75, 1.25);
    targetH = h * random(0.75, 1.25);


    baseAlpha = random(8, 18);


    // 每一个碎片自己的溃散方向
    driftX = random(-0.8, 0.8);
    driftY = random(-0.8, 0.8);


    // 生命周期拉长
    life = 420;

    age = 0;
  }



  // ------------------------------------------------
  // Update
  // ------------------------------------------------

  void update() {

    age++;


    // =================================================
    // 第一阶段
    // VERY SLOW ATTACHMENT
    // 非常缓慢地贴附观众
    //
    // 重点：
    // 这里直接使用当前 mouseX / mouseY
    // 所以观众移动以后，碎片仍然知道观众在哪里
    // =================================================

    if (age < 280) {

      x += (mouseX - x) * 0.004;
      y += (mouseY - y) * 0.004;
    }


    // =================================================
    // 第二阶段
    // 溃散
    // =================================================

    else {

      x += driftX;
      y += driftY;


      // 溃散过程中形态发生轻微改变
      w += (targetW - w) * 0.018;
      h += (targetH - h) * 0.018;
    }


    // 生命周期缓慢下降
    life -= 1.0;
  }



  // ------------------------------------------------
  // Display
  // ------------------------------------------------

  void display() {


    // 当前碎片离观众有多远
    float d =
      dist(x, y, mouseX, mouseY);


    // ------------------------------------------------
    // Proximity / 接近程度
    //
    // 远：
    // proximity ≈ 0
    //
    // 越接近观众：
    // proximity ≈ 1
    // ------------------------------------------------

    float proximity =
      map(
        constrain(d, 0, 180),
        0,
        180,
        1,
        0
      );


    // ------------------------------------------------
    // 越靠近观众
    // 视觉越厚
    // ------------------------------------------------

    float visibleAlpha =
      baseAlpha
      + proximity * 30;


    // ------------------------------------------------
    // 生命周期后期再慢慢淡掉
    // ------------------------------------------------

    float lifeFade =
      constrain(life / 140.0, 0, 1);


    visibleAlpha *= lifeFade;


    fill(
      255,
      visibleAlpha
    );


    rect(
      x,
      y,
      w,
      h
    );
  }



  // ------------------------------------------------
  // Lifecycle
  // ------------------------------------------------

  boolean isDead() {

    return life <= 0;
  }
}
