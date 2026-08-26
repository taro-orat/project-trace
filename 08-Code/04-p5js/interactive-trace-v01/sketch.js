// ==================================================
// Day 07
// interactive-trace-v01
//
// 白底 / 黑色痕迹
//
// MOVING
// 人移动时扰动空间中原本存在的浮尘痕迹
//
// STAYING
// 人停留后：
// - 沉积持续增加
// - 停得越久，形状越完整
// - 停得越久，颜色越深
// - 足够久可以接近纯黑
//
// LEAVE STOP
// - 少部分被观众带走
// - 大部分留在原地
//
// CONDITIONAL DECAY / 条件衰减
//
// 实际停留 < 约7秒：
// → 留下多少就是多少
// → 不额外衰减
//
// 实际停留 > 约7秒：
// → 离开以后开始慢慢变淡
// → 最终退到“约7秒停留”的浅痕迹程度
// → 不完全消失
//
// mouseX / mouseY 暂时代表人体中心
// ==================================================


// ==================================================
// SPACE
// ==================================================

const SOURCE_COUNT = 300;


// ==================================================
// VIEWER FIELD
// 假想人体区域
// ==================================================

const VIEWER_RX = 70;
const VIEWER_RY = 110;


// ==================================================
// MOVEMENT
// ==================================================

const MOVE_THRESHOLD = 1.5;

// 系统先判断大约1.5秒
// 才正式进入 STAYING
const STILL_THRESHOLD = 90;

const MOVEMENT_FIELD_SCALE = 1.7;

const LEAVE_PULSE_FRAMES = 35;


// ==================================================
// DEPOSIT
// ==================================================

const DEPOSIT_RX = 95;
const DEPOSIT_RY = 120;

const DEPOSIT_INTERVAL = 4;
const DEPOSIT_BURST = 1;


// ==================================================
// CARRY
// ==================================================

const CARRY_BASE = 2;

// 每多停约30秒
// 多带走一点
const CARRY_STEP_FRAMES = 1800;

const CARRY_MAX_PER_STOP = 12;


// ==================================================
// IMPRINT GROWTH
// ==================================================

// 大约4分钟以后
// 可以接近最大黑度
const FULL_IMPRINT_FRAMES = 14400;


// 大约正式 STAYING 3秒后
// 开始形成明显区域
const IMPRINT_FORM_START = 180;


// 大约20秒以后
// 形状趋于比较完整
const IMPRINT_FORM_MID = 1200;


// 大约15秒以后
// 开始进入明显的深色积累
const IMPRINT_DARK_START = 900;


// ==================================================
// 7 SECOND DECAY RULE
// ==================================================

// 用户现实中停下约7秒：
// 7 × 60 = 420帧
//
// 但前90帧已经用于判断 STAYING，
// 所以正式 STAYING 状态内部
// 大约再累计330帧。

const SEVEN_SECOND_FRAMES =
  420 - STILL_THRESHOLD;


// 超过这个时间
// 离开以后才需要衰减
const DECAY_TRIGGER_FRAMES =
  SEVEN_SECOND_FRAMES;


// 最后衰减回到
// “约7秒停留”的状态
const DECAY_TARGET_FRAMES =
  SEVEN_SECOND_FRAMES;


// 整体残影大约60秒逐渐退回浅影
const IMPRINT_DECAY_TIME = 3600;


// 原地粒子本身也慢慢退
// 但最终不会消失
const FRAGMENT_DECAY_TIME = 1800;


// ==================================================
// DATA
// ==================================================

let sources =
  new Array(SOURCE_COUNT);

let fragments = [];

let imprints = [];


// ==================================================
// VIEWER STATE
// ==================================================

let viewerState =
  "OUTSIDE";

let previousViewerState =
  "OUTSIDE";

let stillFrames = 0;

let previousMouseX = 0;
let previousMouseY = 0;

let viewerWasInside =
  false;

let viewerDX = 0;
let viewerDY = 0;

let viewerSpeed = 0;

let leavePulse = 0;


// ==================================================
// CURRENT STOP
// ==================================================

let currentStopId = 0;

let stopX = 0;
let stopY = 0;

let currentStopFrames = 0;

let currentImprint = null;


// ==================================================
// CURRENT CARRIED COUNT
// ==================================================

let carriedCountThisFrame = 0;


// ==================================================
// SETUP
// ==================================================

function setup() {

  createCanvas(
    800,
    600
  );

  noSmooth();

  rectMode(CENTER);

  noStroke();


  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    sources[i] =
      new TraceSource(
        random(width),
        random(height)
      );
  }
}


// ==================================================
// DRAW
// ==================================================

function draw() {

  background(255);


  previousViewerState =
    viewerState;


  updateViewerState();


  // ==================================================
  // 开始一次新的停留
  // ==================================================

  if (
    viewerState === "STAYING"
    &&
    previousViewerState !== "STAYING"
  ) {

    beginNewStop();
  }


  // ==================================================
  // 离开这一次停留
  // ==================================================

  if (
    previousViewerState === "STAYING"
    &&
    viewerState !== "STAYING"
  ) {

    handleLeaveStop();

    leavePulse =
      LEAVE_PULSE_FRAMES;
  }


  if (
    leavePulse > 0
  ) {

    leavePulse--;
  }


  // ==================================================
  // 持续停留
  // ==================================================

  if (
    viewerState === "STAYING"
  ) {

    currentStopFrames++;


    createDeposit();


    // 残影跟着停留时间同步成长

    if (
      currentImprint !== null
    ) {

      currentImprint.grow(
        currentStopFrames
      );
    }
  }


  carriedCountThisFrame =
    countCarriedFragments();


  // ==================================================
  // 1. 空间原本存在的浮尘
  // ==================================================

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    sources[i].update();

    sources[i].display();
  }


  // ==================================================
  // 2. 历史停留残影
  // ==================================================

  for (
    let i = 0;
    i < imprints.length;
    i++
  ) {

    imprints[i].update();

    imprints[i].display();
  }


  // ==================================================
  // 3. 停留产生的粒子
  // ==================================================

  for (
    let i =
      fragments.length - 1;

    i >= 0;

    i--
  ) {

    fragments[i].update();

    fragments[i].display();
  }
}


// ==================================================
// CALCULATE FORM STRENGTH
// 根据停留时间计算形状完整度
// ==================================================

function calculateFormStrength(
  stopFrames
) {

  let formRaw =

    map(

      constrain(
        stopFrames,
        IMPRINT_FORM_START,
        IMPRINT_FORM_MID
      ),

      IMPRINT_FORM_START,
      IMPRINT_FORM_MID,

      0,
      1
    );


  return constrain(
    formRaw,
    0,
    1
  );
}


// ==================================================
// CALCULATE DARK STRENGTH
// 根据停留时间计算黑度
// ==================================================

function calculateDarkStrength(
  stopFrames
) {

  let darkRaw =

    map(

      constrain(
        stopFrames,
        IMPRINT_DARK_START,
        FULL_IMPRINT_FRAMES
      ),

      IMPRINT_DARK_START,
      FULL_IMPRINT_FRAMES,

      0,
      1
    );


  return constrain(
    darkRaw,
    0,
    1
  );
}


// ==================================================
// VIEWER FIELD DISTANCE
// ==================================================

function viewerFieldDistance(
  x,
  y,
  scale = 1
) {

  let dx =

    (
      x - mouseX
    )

    /

    (
      VIEWER_RX * scale
    );


  let dy =

    (
      y - mouseY
    )

    /

    (
      VIEWER_RY * scale
    );


  return sqrt(
    dx * dx
    +
    dy * dy
  );
}


// ==================================================
// TRACE SOURCE
// 空间本来就存在的痕迹
// ==================================================

class TraceSource {

  constructor(
    x,
    y
  ) {

    this.x = x;
    this.y = y;


    this.w =
      random(3, 9);

    this.h =
      random(3, 8);


    this.alpha =
      random(16, 32);


    this.t =
      random(1000);


    this.jitterX = 0;
    this.jitterY = 0;
  }


  update() {

    this.jitterX = 0;
    this.jitterY = 0;


    if (
      viewerState === "MOVING"
      ||
      leavePulse > 0
    ) {

      let fieldDistance =

        viewerFieldDistance(
          this.x,
          this.y,
          MOVEMENT_FIELD_SCALE
        );


      if (
        fieldDistance < 1
      ) {

        this.t +=
          0.05;


        let proximity =
          1 - fieldDistance;


        let speedStrength =

          constrain(
            viewerSpeed / 12,
            0,
            1
          );


        let strength =

          2

          +

          proximity * 3

          +

          speedStrength * 2;


        if (
          leavePulse > 0
        ) {

          strength +=

            2

            *

            (
              leavePulse
              /
              LEAVE_PULSE_FRAMES
            );
        }


        this.jitterX =

          map(
            noise(this.t),
            0,
            1,
            -strength,
            strength
          );


        this.jitterY =

          map(
            noise(
              this.t
              +
              1000
            ),
            0,
            1,
            -strength,
            strength
          );


        this.jitterX +=
          viewerDX * 0.04;


        this.jitterY +=
          viewerDY * 0.04;
      }
    }
  }


  display() {

    fill(
      0,
      this.alpha
    );


    rect(

      round(
        this.x
        +
        this.jitterX
      ),

      round(
        this.y
        +
        this.jitterY
      ),

      round(this.w),

      round(this.h)
    );
  }
}


// ==================================================
// RESIDUAL IMPRINT
//
// STAYING：
// 随着停留时间一点点长出来。
//
// LEAVE：
// 不创造新的完整形。
//
// < 7秒：
// 不衰减。
//
// > 7秒：
// 慢慢退回约7秒状态。
// ==================================================

class ResidualImprint {

  constructor(
    x,
    y
  ) {

    this.x = x;
    this.y = y;


    this.active =
      true;


    this.age =
      0;


    this.stopFrames =
      0;


    // 当前强度

    this.formStrength =
      0;

    this.darkStrength =
      0;


    // 离开瞬间的强度

    this.frozenFormStrength =
      0;

    this.frozenDarkStrength =
      0;


    this.shouldDecay =
      false;


    // =================================================
    // INTERNAL FILL PIECES
    // =================================================

    this.fillPieces = [];


    for (
      let i = 0;
      i < 240;
      i++
    ) {

      let angle =
        random(TWO_PI);


      let radius =
        sqrt(
          random(1)
        );


      let x =

        cos(angle)

        *
        radius

        *
        DEPOSIT_RX

        *
        random(
          0.72,
          1.03
        );


      let y =

        sin(angle)

        *
        radius

        *
        DEPOSIT_RY

        *
        random(
          0.70,
          1.03
        );


      this.fillPieces.push({

        x: x,

        y: y,

        w: random(
          5,
          14
        ),

        h: random(
          4,
          11
        ),

        alpha: random(
          3,
          10
        ),

        threshold:
          random(
            0,
            1
          )
      });
    }


    // =================================================
    // EDGE PIECES
    // =================================================

    this.edgePieces = [];


    for (
      let i = 0;
      i < 140;
      i++
    ) {

      // 制造缺口
      // 不形成完整的人工描边

      if (
        random(1)
        <
        0.28
      ) {

        continue;
      }


      let angle =
        random(TWO_PI);


      let edgeRadius =
        random(
          0.86,
          1.12
        );


      let x =

        cos(angle)

        *
        DEPOSIT_RX

        *
        edgeRadius;


      let y =

        sin(angle)

        *
        DEPOSIT_RY

        *
        edgeRadius;


      this.edgePieces.push({

        x: x,

        y: y,

        w: random(
          7,
          20
        ),

        h: random(
          3,
          9
        ),

        rotation:
          random(
            -0.9,
            0.9
          ),

        alpha:
          random(
            7,
            18
          ),

        threshold:
          random(
            0.18,
            1
          )
      });
    }


    // =================================================
    // MASS PIECES
    //
    // 长时间停留以后
    // 才逐渐出现的深色质量。
    // =================================================

    this.massPieces = [];


    for (
      let i = 0;
      i < 170;
      i++
    ) {

      let angle =
        random(TWO_PI);


      let radius =
        pow(
          random(1),
          0.65
        );


      let x =

        cos(angle)

        *
        radius

        *
        DEPOSIT_RX

        *
        random(
          0.70,
          1
        );


      let y =

        sin(angle)

        *
        radius

        *
        DEPOSIT_RY

        *
        random(
          0.68,
          1
        );


      this.massPieces.push({

        x: x,

        y: y,

        w: random(
          16,
          42
        ),

        h: random(
          12,
          34
        ),

        alphaFactor:
          random(
            0.45,
            1
          ),

        threshold:
          random(
            0.45,
            1
          )
      });
    }
  }


  // ==================================================
  // GROW
  // ==================================================

  grow(
    stopFrames
  ) {

    this.stopFrames =
      stopFrames;


    this.formStrength =

      calculateFormStrength(
        stopFrames
      );


    this.darkStrength =

      calculateDarkStrength(
        stopFrames
      );
  }


  // ==================================================
  // FREEZE
  //
  // 人离开这一停留点
  // ==================================================

  freeze() {

    this.active =
      false;


    this.age =
      0;


    this.frozenFormStrength =
      this.formStrength;


    this.frozenDarkStrength =
      this.darkStrength;


    // =================================================
    // 7 SECOND RULE
    //
    // 小于等于约7秒：
    // 不需要继续淡化。
    //
    // 超过约7秒：
    // 离开后慢慢退到约7秒状态。
    // =================================================

    this.shouldDecay =

      this.stopFrames
      >
      DECAY_TRIGGER_FRAMES;
  }


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    if (
      !this.active
    ) {

      this.age++;
    }
  }


  // ==================================================
  // DISPLAY FORM STRENGTH
  // ==================================================

  getDisplayFormStrength() {

    // 还在停留
    if (
      this.active
    ) {

      return this.formStrength;
    }


    // 短停
    // 保持离开时的状态

    if (
      !this.shouldDecay
    ) {

      return this.frozenFormStrength;
    }


    // ----------------------------------------------
    // 长停以后离开
    // 慢慢退回约7秒的形状完整度
    // ----------------------------------------------

    let decay =

      exp(
        -this.age
        /
        IMPRINT_DECAY_TIME
      );


    let targetForm =

      calculateFormStrength(
        DECAY_TARGET_FRAMES
      );


    let result =

      targetForm

      +

      (
        this.frozenFormStrength
        -
        targetForm
      )

      *
      decay;


    return constrain(
      result,
      targetForm,
      1
    );
  }


  // ==================================================
  // DISPLAY DARK STRENGTH
  // ==================================================

  getDisplayDarkStrength() {

    if (
      this.active
    ) {

      return this.darkStrength;
    }


    if (
      !this.shouldDecay
    ) {

      return this.frozenDarkStrength;
    }


    let decay =

      exp(
        -this.age
        /
        IMPRINT_DECAY_TIME
      );


    let targetDark =

      calculateDarkStrength(
        DECAY_TARGET_FRAMES
      );


    let result =

      targetDark

      +

      (
        this.frozenDarkStrength
        -
        targetDark
      )

      *
      decay;


    return constrain(
      result,
      targetDark,
      1
    );
  }


  // ==================================================
  // DISPLAY
  // ==================================================

  display() {

    let displayForm =
      this.getDisplayFormStrength();


    let displayDark =
      this.getDisplayDarkStrength();


    push();


    translate(
      this.x,
      this.y
    );


    noStroke();


    // =================================================
    // 1. 最淡内部碎痕
    // =================================================

    let fillBase =

      2

      +

      displayForm * 26

      +

      displayDark * 70;


    for (
      let i = 0;
      i < this.fillPieces.length;
      i++
    ) {

      let piece =
        this.fillPieces[i];


      // 形状越完整
      // 出现的点越多

      if (
        piece.threshold
        >
        displayForm
      ) {

        continue;
      }


      fill(

        0,

        min(
          255,

          piece.alpha
          +
          fillBase
        )
      );


      rect(

        round(
          piece.x
        ),

        round(
          piece.y
        ),

        round(
          piece.w
        ),

        round(
          piece.h
        )
      );
    }


    // =================================================
    // 2. 不规则轮廓碎块
    // =================================================

    let edgeBase =

      3

      +

      displayForm * 40

      +

      displayDark * 80;


    for (
      let i = 0;
      i < this.edgePieces.length;
      i++
    ) {

      let piece =
        this.edgePieces[i];


      if (
        piece.threshold
        >
        displayForm
      ) {

        continue;
      }


      push();


      translate(
        piece.x,
        piece.y
      );


      rotate(
        piece.rotation
      );


      fill(

        0,

        min(

          255,

          piece.alpha
          +
          edgeBase
        )
      );


      rect(

        0,
        0,

        round(
          piece.w
        ),

        round(
          piece.h
        )
      );


      pop();
    }


    // =================================================
    // 3. 深色质量
    //
    // 长时间停留后可以接近纯黑。
    //
    // 人离开以后，
    // 这一层逐渐退掉。
    // =================================================

    let massBase =

      255

      *

      pow(
        displayDark,
        1.15
      );


    for (
      let i = 0;
      i < this.massPieces.length;
      i++
    ) {

      let piece =
        this.massPieces[i];


      if (
        piece.threshold
        >
        displayDark
      ) {

        continue;
      }


      let alpha =

        massBase

        *

        piece.alphaFactor;


      if (
        alpha <= 0.5
      ) {

        continue;
      }


      fill(

        0,

        min(
          255,
          alpha
        )
      );


      rect(

        round(
          piece.x
        ),

        round(
          piece.y
        ),

        round(
          piece.w
        ),

        round(
          piece.h
        )
      );
    }


    pop();
  }
}


// ==================================================
// TRACE FRAGMENT
//
// 停留时形成的单个小痕迹。
// ==================================================

class TraceFragment {

  constructor(
    x,
    y,
    stopId
  ) {

    this.x = x;
    this.y = y;


    this.stopId =
      stopId;


    this.w =
      random(
        5,
        12
      );


    this.h =
      random(
        4,
        10
      );


    this.baseAlpha =
      random(
        24,
        48
      );


    this.settled =
      false;


    this.carried =
      false;


    // =================================================
    // 离开以后是否需要衰减
    // =================================================

    this.shouldDecay =
      false;


    // 离开瞬间的透明度倍率
    this.settledStartMultiplier =
      1;


    // =================================================
    // 原地溃散
    // =================================================

    this.scatterX =
      random(
        -0.18,
        0.18
      );


    this.scatterY =
      random(
        -0.18,
        0.18
      );


    this.settleAge =
      0;


    // 最终不会彻底消失

    this.residualFloor =
      random(
        0.20,
        0.32
      );


    // =================================================
    // 再次经过时扰动
    // =================================================

    this.localT =
      random(1000);


    this.displayJitterX =
      0;


    this.displayJitterY =
      0;


    // =================================================
    // CARRIED CLOUD
    // =================================================

    let angle =
      random(TWO_PI);


    let radius =
      sqrt(
        random(1)
      );


    this.bodyOffsetX =

      cos(angle)

      *

      radius

      *

      VIEWER_RX

      +

      random(
        -30,
        30
      );


    this.bodyOffsetY =

      sin(angle)

      *

      radius

      *

      VIEWER_RY

      +

      random(
        -35,
        35
      );


    this.carryT =
      random(1000);
  }


  // ==================================================
  // SETTLE
  //
  // 人离开以后，
  // 告诉这个粒子：
  //
  // 这次停留是否超过7秒？
  // ==================================================

  settle(
    stopFrames
  ) {

    this.settled =
      true;


    this.settleAge =
      0;


    this.shouldDecay =

      stopFrames
      >
      DECAY_TRIGGER_FRAMES;


    // 离开瞬间
    // 保留它当时的可见程度

    let stayStrength =

      1

      -

      exp(
        -stopFrames
        /
        600
      );


    this.settledStartMultiplier =

      0.55

      +

      stayStrength
      *
      0.45;
  }


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    this.displayJitterX =
      0;


    this.displayJitterY =
      0;


    // =================================================
    // CARRIED
    // =================================================

    if (
      this.carried
    ) {

      this.carryT +=
        0.018;


      let driftX =

        map(
          noise(
            this.carryT
          ),
          0,
          1,
          -10,
          10
        );


      let driftY =

        map(
          noise(
            this.carryT
            +
            1000
          ),
          0,
          1,
          -10,
          10
        );


      let targetX =

        mouseX

        +

        this.bodyOffsetX

        +

        driftX;


      let targetY =

        mouseY

        +

        this.bodyOffsetY

        +

        driftY;


      this.x +=

        (
          targetX
          -
          this.x
        )

        *
        0.055;


      this.y +=

        (
          targetY
          -
          this.y
        )

        *
        0.055;


      return;
    }


    // =================================================
    // SETTLED
    // =================================================

    if (
      this.settled
    ) {

      this.settleAge++;


      // 轻微溃散

      this.x +=
        this.scatterX;


      this.y +=
        this.scatterY;


      // 很快停止
      // 不彻底散成碎屑

      this.scatterX *=
        0.955;


      this.scatterY *=
        0.955;


      // ----------------------------------------------
      // 以后再次有人经过
      // 旧痕迹仍然会轻微受到扰动
      // ----------------------------------------------

      if (
        viewerState
        ===
        "MOVING"
      ) {

        let fieldDistance =

          viewerFieldDistance(
            this.x,
            this.y,
            1.45
          );


        if (
          fieldDistance < 1
        ) {

          this.localT +=
            0.04;


          let strength =
            1.1;


          if (
            leavePulse > 0
          ) {

            strength +=

              1.4

              *

              (
                leavePulse
                /
                LEAVE_PULSE_FRAMES
              );
          }


          this.displayJitterX =

            map(
              noise(
                this.localT
              ),
              0,
              1,
              -strength,
              strength
            );


          this.displayJitterY =

            map(
              noise(
                this.localT
                +
                1000
              ),
              0,
              1,
              -strength,
              strength
            );
        }
      }


      return;
    }


    // =================================================
    // 正在沉积
    // =================================================

    this.y +=
      0.006;
  }


  // ==================================================
  // DISPLAY
  // ==================================================

  display() {

    let alpha =
      this.baseAlpha;


    let displayW =
      this.w;


    let displayH =
      this.h;


    // =================================================
    // 还在停留
    // =================================================

    if (
      !this.settled
      &&
      !this.carried
    ) {

      let stayStrength =

        1

        -

        exp(
          -currentStopFrames
          /
          600
        );


      alpha *=

        0.55

        +

        stayStrength
        *
        0.45;
    }


    // =================================================
    // 已经留在原地
    // =================================================

    if (
      this.settled
    ) {

      let multiplier;


      // ----------------------------------------------
      // 短于约7秒
      //
      // 不额外减淡。
      // ----------------------------------------------

      if (
        !this.shouldDecay
      ) {

        multiplier =
          this.settledStartMultiplier;
      }


      // ----------------------------------------------
      // 长于约7秒
      //
      // 慢慢退到很浅的残留值。
      // ----------------------------------------------

      else {

        let decay =

          exp(
            -this.settleAge
            /
            FRAGMENT_DECAY_TIME
          );


        multiplier =

          this.residualFloor

          +

          (
            this.settledStartMultiplier
            -
            this.residualFloor
          )

          *
          decay;
      }


      alpha *=
        multiplier;
    }


    // =================================================
    // 被带走
    // =================================================

    if (
      this.carried
    ) {

      let accumulation =

        1

        -

        exp(
          -carriedCountThisFrame
          /
          70
        );


      alpha *=

        0.55

        +

        accumulation
        *
        0.45;


      displayW *=

        1.15

        +

        accumulation
        *
        0.50;


      displayH *=

        1.10

        +

        accumulation
        *
        0.40;
    }


    fill(
      0,
      alpha
    );


    rect(

      round(
        this.x
        +
        this.displayJitterX
      ),

      round(
        this.y
        +
        this.displayJitterY
      ),

      round(
        displayW
      ),

      round(
        displayH
      )
    );
  }
}


// ==================================================
// BEGIN NEW STOP
// ==================================================

function beginNewStop() {

  currentStopId++;


  stopX =
    mouseX;


  stopY =
    mouseY;


  currentStopFrames =
    0;


  // 一开始只是空的“潜在残影”
  // 后面随着停留逐渐长出来

  currentImprint =

    new ResidualImprint(
      stopX,
      stopY
    );


  imprints.push(
    currentImprint
  );
}


// ==================================================
// CREATE DEPOSIT
// ==================================================

function createDeposit() {

  if (
    frameCount
    %
    DEPOSIT_INTERVAL
    !==
    0
  ) {

    return;
  }


  for (
    let i = 0;
    i < DEPOSIT_BURST;
    i++
  ) {

    spawnDepositParticle();
  }
}


// ==================================================
// SPAWN DEPOSIT PARTICLE
// ==================================================

function spawnDepositParticle() {

  let angle =
    random(TWO_PI);


  let radius =
    sqrt(
      random(1)
    );


  let x =

    stopX

    +

    cos(angle)

    *
    radius

    *
    DEPOSIT_RX;


  let y =

    stopY

    +

    sin(angle)

    *
    radius

    *
    DEPOSIT_RY;


  fragments.push(

    new TraceFragment(
      x,
      y,
      currentStopId
    )

  );
}


// ==================================================
// LEAVE STOP
// ==================================================

function handleLeaveStop() {

  let candidates = [];


  // =================================================
  // 找到本次停留产生的所有粒子
  // =================================================

  for (
    let i = 0;
    i < fragments.length;
    i++
  ) {

    let fragment =
      fragments[i];


    if (
      fragment.stopId
      ===
      currentStopId

      &&

      !fragment.carried

      &&

      !fragment.settled
    ) {

      candidates.push(
        fragment
      );
    }
  }


  // =================================================
  // 冻结整体残影
  // =================================================

  if (
    currentImprint !== null
  ) {

    currentImprint.freeze();

    currentImprint =
      null;
  }


  // =================================================
  // 计算带走多少
  // =================================================

  let carryCount =

    CARRY_BASE

    +

    floor(

      currentStopFrames

      /

      CARRY_STEP_FRAMES
    );


  carryCount =

    constrain(
      carryCount,
      CARRY_BASE,
      CARRY_MAX_PER_STOP
    );


  carryCount =

    min(
      carryCount,
      candidates.length
    );


  // =================================================
  // 少部分带走
  // =================================================

  for (
    let i = 0;
    i < carryCount;
    i++
  ) {

    let index =

      floor(
        random(
          candidates.length
        )
      );


    let chosen =
      candidates[index];


    chosen.carried =
      true;


    candidates.splice(
      index,
      1
    );
  }


  // =================================================
  // 大部分留下
  //
  // 每一个粒子也知道：
  // 本次停留有没有超过7秒。
  // =================================================

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {

    candidates[i].settle(
      currentStopFrames
    );
  }
}


// ==================================================
// VIEWER STATE
// ==================================================

function updateViewerState() {

  let inside =

    mouseX >= 0

    &&

    mouseX <= width

    &&

    mouseY >= 0

    &&

    mouseY <= height;


  viewerDX =
    mouseX
    -
    previousMouseX;


  viewerDY =
    mouseY
    -
    previousMouseY;


  viewerSpeed =

    dist(
      mouseX,
      mouseY,
      previousMouseX,
      previousMouseY
    );


  if (
    inside
  ) {

    // 刚进入画布

    if (
      !viewerWasInside
    ) {

      stillFrames =
        0;


      viewerState =
        "MOVING";
    }


    // 基本没动

    else if (
      viewerSpeed
      <
      MOVE_THRESHOLD
    ) {

      stillFrames++;


      if (
        stillFrames
        >=
        STILL_THRESHOLD
      ) {

        viewerState =
          "STAYING";
      }


      else {

        viewerState =
          "MOVING";
      }
    }


    // 再次移动

    else {

      stillFrames =
        0;


      viewerState =
        "MOVING";
    }
  }


  else {

    viewerState =
      "OUTSIDE";


    stillFrames =
      0;
  }


  viewerWasInside =
    inside;


  previousMouseX =
    mouseX;


  previousMouseY =
    mouseY;
}


// ==================================================
// COUNT CARRIED
// ==================================================

function countCarriedFragments() {

  let count =
    0;


  for (
    let i = 0;
    i < fragments.length;
    i++
  ) {

    if (
      fragments[i].carried
    ) {

      count++;
    }
  }


  return count;
}