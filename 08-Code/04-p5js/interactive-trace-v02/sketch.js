// ==================================================
// Day 07
// interactive-trace-v02
//
// <= 7 秒：
// 保持离开时已经形成的状态，不继续衰减。
//
// > 7 秒：
// 离开以后逐渐衰减，最终停在：
//
// 7秒 + (超过7秒的部分 × 10%)
//
// 8秒  -> 7.1秒
// 20秒 -> 8.3秒
// 60秒 -> 12.3秒
//
// 另外：
// 鼠标刚开始移动时，不立即让 carry / scatter / jitter
// 全部同时发生，避免视觉突然“跳一下”。
// ==================================================


// ==================================================
// SPACE
// ==================================================

const SOURCE_COUNT = 300;


// ==================================================
// VIEWER FIELD
// ==================================================

const VIEWER_RX = 70;
const VIEWER_RY = 110;


// ==================================================
// MOVEMENT
// ==================================================

const MOVE_THRESHOLD = 1.5;

// 约1.5秒以后才判断为正式 STAYING
const STILL_THRESHOLD = 90;

const MOVEMENT_FIELD_SCALE = 1.7;

const LEAVE_PULSE_FRAMES = 35;


// 鼠标刚离开停留状态以后，
// 先保留约0.5秒的空间稳定期。
//
// 注意：
// 这里只延迟
// carry / scatter / jitter / leavePulse。
//
// alpha 的逐渐衰减仍然可以继续。
const LEAVE_MOTION_HOLD_FRAMES = 30;


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

const CARRY_STEP_FRAMES = 1800;

const CARRY_MAX_PER_STOP = 12;


// ==================================================
// IMPRINT FORMATION
// ==================================================

const FULL_IMPRINT_FRAMES = 14400;

const IMPRINT_FORM_START = 180;

const IMPRINT_FORM_MID = 1200;

const IMPRINT_DARK_START = 900;


// ==================================================
// 7 SECOND RULE
// ==================================================

// 现实约7秒：
//
// 7 × 60 = 420帧
//
// 前90帧已经用于识别 STAYING
//
// 所以 STAYING 内部：
// 420 - 90 = 330帧

const SEVEN_SECOND_FRAMES =
  420 - STILL_THRESHOLD;


const DECAY_TRIGGER_FRAMES =
  SEVEN_SECOND_FRAMES;


// ==================================================
// V02 MEMORY
// ==================================================

const EXTRA_MEMORY_RETENTION = 0.10;


// ==================================================
// DECAY SPEED
// ==================================================

const IMPRINT_DECAY_TIME = 3600;

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

let viewerWasInside = false;

let viewerDX = 0;
let viewerDY = 0;

let viewerSpeed = 0;

let leavePulse = 0;


// 离开后的空间稳定期
let leaveCaptureFrames = 0;


// ==================================================
// CURRENT STOP
// ==================================================

let currentStopId = 0;

let stopX = 0;
let stopY = 0;

let currentStopFrames = 0;

let currentImprint = null;


// ==================================================
// CARRIED COUNT
// ==================================================

let carriedCountThisFrame = 0;


// ==================================================
// SETUP
// ==================================================

function setup() {

  // ----------------------------------------------
  // 运行时版本标记
  //
  // 如果 Safari 标签不是这个名字，
  // 说明当前没有运行这份 v02 sketch.js。
  // ----------------------------------------------

  document.title =
    "interactive-trace-v02 | leave-fix";

  console.log(
    "RUNNING: interactive-trace-v02 | leave-fix"
  );


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
  // BEGIN STOP
  // ==================================================

  if (
    viewerState === "STAYING"
    &&
    previousViewerState !== "STAYING"
  ) {

    beginNewStop();
  }


  // ==================================================
  // LEAVE STOP
  // ==================================================

  if (
    previousViewerState === "STAYING"
    &&
    viewerState !== "STAYING"
  ) {

    handleLeaveStop();
  }


  // ==================================================
  // LEAVE PULSE COUNTDOWN
  // ==================================================

  if (
    leavePulse > 0
  ) {

    leavePulse--;
  }


  // ==================================================
  // STAYING
  // ==================================================

  if (
    viewerState === "STAYING"
  ) {

    currentStopFrames++;


    createDeposit();


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
  // 1. EXISTING SPACE TRACES
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
  // 2. RESIDUAL IMPRINTS
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
  // 3. DEPOSIT / CARRIED PARTICLES
  // ==================================================

  for (
    let i = fragments.length - 1;
    i >= 0;
    i--
  ) {

    fragments[i].update();

    fragments[i].display();
  }


  // ==================================================
  // LEAVE MOTION HOLD
  //
  // 这个放在 draw() 最后。
  //
  // 因此当前这一帧依然完整使用
  // leaveCaptureFrames > 0 的状态。
  // ==================================================

  if (
    leaveCaptureFrames > 0
  ) {

    leaveCaptureFrames--;


    // hold 真正结束以后
    // 才启动 leavePulse。

    if (
      leaveCaptureFrames === 0
    ) {

      leavePulse =
        LEAVE_PULSE_FRAMES;
    }
  }
}


// ==================================================
// CALCULATE FORM STRENGTH
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
// V02 MEMORY TARGET
// ==================================================

function calculateMemoryFrames(
  stopFrames
) {

  // ----------------------------------------------
  // <= 7秒
  //
  // 保留实际停留状态
  // ----------------------------------------------

  if (
    stopFrames <=
    DECAY_TRIGGER_FRAMES
  ) {

    return stopFrames;
  }


  // ----------------------------------------------
  // > 7秒
  //
  // 7秒 + 超出部分 × 10%
  // ----------------------------------------------

  let extraFrames =

    stopFrames
    -
    DECAY_TRIGGER_FRAMES;


  return

    DECAY_TRIGGER_FRAMES

    +

    extraFrames
    *
    EXTRA_MEMORY_RETENTION;
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
      VIEWER_RX
      *
      scale
    );


  let dy =

    (
      y - mouseY
    )

    /

    (
      VIEWER_RY
      *
      scale
    );


  return sqrt(
    dx * dx
    +
    dy * dy
  );
}


// ==================================================
// TRACE SOURCE
//
// 空间原本存在的痕迹
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


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    this.jitterX = 0;
    this.jitterY = 0;


    // ----------------------------------------------
    // leave hold 期间
    // 不立即启动环境痕迹扰动
    // ----------------------------------------------

    if (

      leaveCaptureFrames === 0

      &&

      (
        viewerState === "MOVING"
        ||
        leavePulse > 0
      )

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


  // ==================================================
  // DISPLAY
  // ==================================================

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

      round(
        this.w
      ),

      round(
        this.h
      )
    );
  }
}


// ==================================================
// RESIDUAL IMPRINT
// ==================================================

class ResidualImprint {

  constructor(
    x,
    y
  ) {

    this.x = x;
    this.y = y;


    this.active = true;

    this.age = 0;

    this.stopFrames = 0;


    this.formStrength = 0;

    this.darkStrength = 0;


    // ----------------------------------------------
    // 离开瞬间状态
    // ----------------------------------------------

    this.frozenFormStrength = 0;

    this.frozenDarkStrength = 0;


    // ----------------------------------------------
    // v02 最终目标
    // ----------------------------------------------

    this.memoryFrames = 0;

    this.targetFormStrength = 0;

    this.targetDarkStrength = 0;


    this.shouldDecay = false;


    // 离开后的第一帧
    // age 保持0

    this.leaveFramePending = false;


    // =================================================
    // INTERNAL FILL
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

        w:
          random(
            5,
            14
          ),

        h:
          random(
            4,
            11
          ),

        alpha:
          random(
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
    // IRREGULAR EDGE
    // =================================================

    this.edgePieces = [];


    for (
      let i = 0;
      i < 140;
      i++
    ) {

      // 制造断裂
      // 不形成完整椭圆轮廓

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

        w:
          random(
            7,
            20
          ),

        h:
          random(
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
    // DARK MASS
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

        w:
          random(
            16,
            42
          ),

        h:
          random(
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
  // ==================================================

  freeze() {

    this.active = false;

    this.age = 0;

    this.leaveFramePending = true;


    // ----------------------------------------------
    // 保存离开瞬间真实状态
    // ----------------------------------------------

    this.frozenFormStrength =
      this.formStrength;


    this.frozenDarkStrength =
      this.darkStrength;


    // ----------------------------------------------
    // <=7秒不衰减
    // >7秒才衰减
    // ----------------------------------------------

    this.shouldDecay =

      this.stopFrames
      >
      DECAY_TRIGGER_FRAMES;


    // ----------------------------------------------
    // v02长期记忆目标
    // ----------------------------------------------

    this.memoryFrames =

      calculateMemoryFrames(
        this.stopFrames
      );


    this.targetFormStrength =

      calculateFormStrength(
        this.memoryFrames
      );


    this.targetDarkStrength =

      calculateDarkStrength(
        this.memoryFrames
      );
  }


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    if (
      !this.active
    ) {

      // 第一帧 age 保持0

      if (
        this.leaveFramePending
      ) {

        this.leaveFramePending =
          false;
      }

      else {

        this.age++;
      }
    }
  }


  // ==================================================
  // DECAY FACTOR
  // ==================================================

  getDecayFactor() {

    return exp(
      -this.age
      /
      IMPRINT_DECAY_TIME
    );
  }


  // ==================================================
  // FILL ALPHA
  // ==================================================

  getFillAlphaAtState(
    piece,
    formStrength,
    darkStrength
  ) {

    if (
      piece.threshold
      >
      formStrength
    ) {

      return 0;
    }


    let fillBase =

      2

      +

      formStrength * 26

      +

      darkStrength * 70;


    return min(

      255,

      piece.alpha
      +
      fillBase
    );
  }


  // ==================================================
  // EDGE ALPHA
  // ==================================================

  getEdgeAlphaAtState(
    piece,
    formStrength,
    darkStrength
  ) {

    if (
      piece.threshold
      >
      formStrength
    ) {

      return 0;
    }


    let edgeBase =

      3

      +

      formStrength * 40

      +

      darkStrength * 80;


    return min(

      255,

      piece.alpha
      +
      edgeBase
    );
  }


  // ==================================================
  // MASS ALPHA
  // ==================================================

  getMassAlphaAtState(
    piece,
    darkStrength
  ) {

    if (
      piece.threshold
      >
      darkStrength
    ) {

      return 0;
    }


    let massBase =

      255

      *

      pow(
        darkStrength,
        1.15
      );


    return min(

      255,

      massBase
      *
      piece.alphaFactor
    );
  }


  // ==================================================
  // SMOOTH ALPHA
  // ==================================================

  getSmoothAlpha(
    startAlpha,
    targetAlpha
  ) {

    // 仍在停留

    if (
      this.active
    ) {

      return startAlpha;
    }


    // <=7秒
    // 完全冻结

    if (
      !this.shouldDecay
    ) {

      return startAlpha;
    }


    // >7秒
    // 从离开瞬间慢慢走向最终状态

    let decay =
      this.getDecayFactor();


    return

      targetAlpha

      +

      (
        startAlpha
        -
        targetAlpha
      )

      *
      decay;
  }


  // ==================================================
  // DISPLAY
  // ==================================================

  display() {

    push();


    translate(
      this.x,
      this.y
    );


    noStroke();


    // ----------------------------------------------
    // STAYING
    // ----------------------------------------------

    if (
      this.active
    ) {

      this.displayLive();

      pop();

      return;
    }


    // ----------------------------------------------
    // AFTER LEAVE
    // ----------------------------------------------

    this.displayAfterLeave();


    pop();
  }


  // ==================================================
  // DISPLAY LIVE
  // ==================================================

  displayLive() {

    // =================================================
    // INTERNAL FILL
    // =================================================

    let fillBase =

      2

      +

      this.formStrength * 26

      +

      this.darkStrength * 70;


    for (
      let i = 0;
      i < this.fillPieces.length;
      i++
    ) {

      let piece =
        this.fillPieces[i];


      if (
        piece.threshold
        >
        this.formStrength
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
    // EDGE
    // =================================================

    let edgeBase =

      3

      +

      this.formStrength * 40

      +

      this.darkStrength * 80;


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
        this.formStrength
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
    // DARK MASS
    // =================================================

    let massBase =

      255

      *

      pow(
        this.darkStrength,
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
        this.darkStrength
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
  }


  // ==================================================
  // DISPLAY AFTER LEAVE
  // ==================================================

  displayAfterLeave() {

    // =================================================
    // INTERNAL FILL
    // =================================================

    for (
      let i = 0;
      i < this.fillPieces.length;
      i++
    ) {

      let piece =
        this.fillPieces[i];


      let startAlpha =

        this.getFillAlphaAtState(
          piece,
          this.frozenFormStrength,
          this.frozenDarkStrength
        );


      let targetAlpha =

        this.getFillAlphaAtState(
          piece,
          this.targetFormStrength,
          this.targetDarkStrength
        );


      let alpha =

        this.getSmoothAlpha(
          startAlpha,
          targetAlpha
        );


      if (
        alpha <= 0.3
      ) {

        continue;
      }


      fill(
        0,
        alpha
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
    // EDGE
    // =================================================

    for (
      let i = 0;
      i < this.edgePieces.length;
      i++
    ) {

      let piece =
        this.edgePieces[i];


      let startAlpha =

        this.getEdgeAlphaAtState(
          piece,
          this.frozenFormStrength,
          this.frozenDarkStrength
        );


      let targetAlpha =

        this.getEdgeAlphaAtState(
          piece,
          this.targetFormStrength,
          this.targetDarkStrength
        );


      let alpha =

        this.getSmoothAlpha(
          startAlpha,
          targetAlpha
        );


      if (
        alpha <= 0.3
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
        alpha
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
    // DARK MASS
    // =================================================

    for (
      let i = 0;
      i < this.massPieces.length;
      i++
    ) {

      let piece =
        this.massPieces[i];


      let startAlpha =

        this.getMassAlphaAtState(
          piece,
          this.frozenDarkStrength
        );


      let targetAlpha =

        this.getMassAlphaAtState(
          piece,
          this.targetDarkStrength
        );


      let alpha =

        this.getSmoothAlpha(
          startAlpha,
          targetAlpha
        );


      if (
        alpha <= 0.5
      ) {

        continue;
      }


      fill(
        0,
        alpha
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
  }
}


// ==================================================
// TRACE FRAGMENT
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


    this.settled = false;

    this.carried = false;


    this.shouldDecay = false;


    this.settledStartMultiplier =
      1;


    // =================================================
    // SCATTER
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


    this.settleAge = 0;


    // 第一帧先不推进 scatter

    this.settleFramePending = true;


    this.residualFloor =
      random(
        0.20,
        0.32
      );


    // =================================================
    // OLD TRACE DISTURBANCE
    // =================================================

    this.localT =
      random(1000);


    this.displayJitterX = 0;
    this.displayJitterY = 0;


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
  // ==================================================

  settle(
    stopFrames
  ) {

    this.settled = true;

    this.settleAge = 0;


    this.shouldDecay =

      stopFrames
      >
      DECAY_TRIGGER_FRAMES;


    // <=7秒
    // 不发生离开后的永久溃散

    if (
      !this.shouldDecay
    ) {

      this.scatterX = 0;
      this.scatterY = 0;
    }


    let stayStrength =

      1

      -

      exp(
        -stopFrames
        /
        600
      );


    // 和 STAYING 最后一帧
    // 使用相同透明度公式

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

    this.displayJitterX = 0;

    this.displayJitterY = 0;


    // ----------------------------------------------
    // 当前这次停留刚刚结束，
    // 并且还处于空间稳定期。
    // ----------------------------------------------

    let inLeaveMotionHold =

      leaveCaptureFrames > 0

      &&

      this.stopId === currentStopId;


    // =================================================
    // CARRIED
    // =================================================

    if (
      this.carried
    ) {

      // ----------------------------------------------
      // hold 期间：
      // 先不要立刻飞向鼠标。
      // ----------------------------------------------

      if (
        inLeaveMotionHold
      ) {

        return;
      }


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

      let settlingNow =
        this.settleFramePending;


      if (
        this.settleFramePending
      ) {

        this.settleFramePending =
          false;
      }

      else {

        this.settleAge++;
      }


      // =================================================
      // SCATTER
      //
      // >7秒才允许。
      //
      // 而且刚离开那段 hold 时间内
      // 不立即 scatter。
      // =================================================

      if (

        this.shouldDecay

        &&

        !settlingNow

        &&

        !inLeaveMotionHold

      ) {

        this.x +=
          this.scatterX;


        this.y +=
          this.scatterY;


        this.scatterX *=
          0.955;


        this.scatterY *=
          0.955;
      }


      // =================================================
      // OLD TRACE DISTURBANCE
      // =================================================

      if (

        viewerState === "MOVING"

        &&

        !inLeaveMotionHold

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
    // CURRENT DEPOSIT
    // =================================================

    this.y +=
      0.006;
  }


  // ==================================================
  // DISPLAY
  // ==================================================

  display() {

    let inLeaveMotionHold =

      leaveCaptureFrames > 0

      &&

      this.stopId === currentStopId;


    let alpha =
      this.baseAlpha;


    let displayW =
      this.w;


    let displayH =
      this.h;


    // =================================================
    // CURRENT STAY
    //
    // carry 已经被选中，
    // 但 hold 期间仍然按照离开前的样子显示。
    // =================================================

    if (

      !this.settled

      &&

      (
        !this.carried
        ||
        inLeaveMotionHold
      )

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
    // LEFT BEHIND
    // =================================================

    if (
      this.settled
    ) {

      let multiplier;


      // ----------------------------------------------
      // <=7秒
      // 不继续减淡
      // ----------------------------------------------

      if (
        !this.shouldDecay
      ) {

        multiplier =
          this.settledStartMultiplier;
      }


      // ----------------------------------------------
      // >7秒
      // 逐渐减淡
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
    // CARRIED
    //
    // hold 结束以后
    // 才切换到 carried cloud 的视觉。
    // =================================================

    if (

      this.carried

      &&

      !inLeaveMotionHold

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


  currentStopFrames = 0;


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
// SPAWN DEPOSIT
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
  // LEAVE MOTION HOLD
  //
  // 之前只有1帧。
  //
  // 下一帧 carry / scatter / jitter
  // 就一起启动，所以肉眼仍然像：
  //
  // “鼠标一动，画面立刻跳了一档。”
  //
  // 现在保留约0.5秒空间稳定期。
  // =================================================

  leaveCaptureFrames =
    LEAVE_MOTION_HOLD_FRAMES;


  // hold期间不启动旧 leavePulse

  leavePulse = 0;


  // =================================================
  // FIND CURRENT STOP PARTICLES
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
  // FREEZE IMPRINT
  // =================================================

  if (
    currentImprint !== null
  ) {

    currentImprint.freeze();


    currentImprint = null;
  }


  // =================================================
  // CARRY COUNT
  // =================================================

  let carryCount =

    currentStopFrames
    <=
    DECAY_TRIGGER_FRAMES

      ?

      floor(

        currentStopFrames

        /

        DECAY_TRIGGER_FRAMES

        *

        CARRY_BASE
      )

      :

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
      0,
      CARRY_MAX_PER_STOP
    );


  carryCount =

    min(
      carryCount,
      candidates.length
    );


  // =================================================
  // CARRY A SMALL PART
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


    // ----------------------------------------------
    // 这里只先标记 carried。
    //
    // 真正开始移动和改变 carried 视觉，
    // 要等 leave hold 结束以后。
    // ----------------------------------------------

    chosen.carried = true;


    candidates.splice(
      index,
      1
    );
  }


  // =================================================
  // MOST REMAIN
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


  // =================================================
  // CONSOLE TEST
  // =================================================

  let actualStaySeconds =

    (
      currentStopFrames
      +
      STILL_THRESHOLD
    )

    /
    60;


  let memoryFrames =

    calculateMemoryFrames(
      currentStopFrames
    );


  let memorySeconds =

    (
      memoryFrames
      +
      STILL_THRESHOLD
    )

    /
    60;


  console.log(

    "STOP",

    currentStopId,

    "| stayed:",

    actualStaySeconds.toFixed(1),

    "sec",

    "| final memory:",

    memorySeconds.toFixed(1),

    "sec",

    "| carried:",

    carryCount
  );
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

    // =================================================
    // FIRST ENTER
    // =================================================

    if (
      !viewerWasInside
    ) {

      stillFrames = 0;


      viewerState =
        "MOVING";
    }


    // =================================================
    // ALMOST STILL
    // =================================================

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


    // =================================================
    // MOVING AGAIN
    // =================================================

    else {

      stillFrames = 0;


      viewerState =
        "MOVING";
    }
  }


  // =================================================
  // OUTSIDE
  // =================================================

  else {

    viewerState =
      "OUTSIDE";


    stillFrames = 0;
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

  let count = 0;


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