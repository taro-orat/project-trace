// ==================================================
// Day 07
// interactive-trace-v03
//
// Day 08 parameter-mode test:
// - AI source = saturated blue
// - Human source = saturated red
// - purple / mixed appearance comes from overlapping red and blue passes
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

let traceData;
let aiParams;
let humanParams;

// ==================================================
// DAY 08 TEST COLORS
// 仅用于区分 AI / Human 来源，后续可以替换。
// ==================================================
const AI_TEST_COLOR = [0, 110, 255];
const HUMAN_TEST_COLOR = [255, 0, 70];

// carried cloud 内三种来源的可配置比例。
// mixed appearance is created by overlapping the red and blue passes;
// it is not a third source color.
const CARRY_MIXED_RATIO = 0.40;
const CARRY_AI_RATIO = 0.30;
const CARRY_HUMAN_RATIO = 0.30;

const CARRY_SOURCE_MODE_MIXED = "mixed";
const CARRY_SOURCE_MODE_AI = "ai";
const CARRY_SOURCE_MODE_HUMAN = "human";

const RESIDUAL_SOURCE_OFFSET = 2.5;
const FRAGMENT_SOURCE_OFFSET = 1.5;

const SOURCE_COUNT = 300;

let nextHumanSourceSerial = 1;
let nextAiSourceSerial = 1;


function createAmbientSourceId(sourceType) {

  if (sourceType === "human") {

    let serial =
      nextHumanSourceSerial;

    nextHumanSourceSerial++;

    return
      "human-"
      +
      String(serial).padStart(6, "0");
  }


  if (sourceType === "ai") {

    let serial =
      nextAiSourceSerial;

    nextAiSourceSerial++;

    return
      "ai-"
      +
      String(serial).padStart(6, "0");
  }


  throw new Error(
    "TraceSource sourceType must be human or ai"
  );
}


// ==================================================
// SOURCE PASSES
// ==================================================

// Purple / mixed appearance is produced by overlapping these independent
// AI-blue and Human-red passes, never by a fixed third source color.
function drawSourcePass(
  color,
  x,
  y,
  w,
  h,
  alpha
) {

  fill(
    color[0],
    color[1],
    color[2],
    alpha
  );

  rect(
    round(x),
    round(y),
    round(w),
    round(h)
  );
}


function drawAiMaterial(
  color,
  x,
  y,
  w,
  h,
  alpha
) {

  drawSourcePass(
    color,
    x,
    y,
    w,
    h,
    alpha
  );

  drawSourcePass(
    [120, 220, 255],
    x - 1,
    y - 1,
    max(1, w * 0.35),
    max(1, h * 0.22),
    alpha * 0.55
  );
}


function drawHumanMaterial(
  color,
  x,
  y,
  w,
  h,
  alpha
) {

  drawSourcePass(
    [245, 225, 198],
    x,
    y,
    w + 2,
    h + 2,
    alpha * 0.22
  );

  drawSourcePass(
    color,
    x,
    y,
    w,
    h,
    alpha
  );
}


function drawSourceMaterialAt(
  sourceType,
  x,
  y,
  w,
  h,
  alpha
) {

  if (sourceType === "ai") {

    drawAiMaterial(
      AI_TEST_COLOR,
      x,
      y,
      w,
      h,
      alpha
    );

    return;
  }


  drawHumanMaterial(
    HUMAN_TEST_COLOR,
    x,
    y,
    w,
    h,
    alpha
  );
}


function drawSourcePasses(
  mode,
  x,
  y,
  w,
  h,
  alpha,
  sourceGeometry = null
) {

  let aiX = x;
  let aiY = y;
  let humanX = x;
  let humanY = y;

  if (
    sourceGeometry !== null
  ) {

    aiX +=
      sourceGeometry.aiOffsetX;

    aiY +=
      sourceGeometry.aiOffsetY;

    humanX +=
      sourceGeometry.humanOffsetX;

    humanY +=
      sourceGeometry.humanOffsetY;
  }

  if (
    mode === CARRY_SOURCE_MODE_MIXED
    ||
    mode === CARRY_SOURCE_MODE_AI
  ) {

    drawSourcePass(
      AI_TEST_COLOR,
      aiX,
      aiY,
      w,
      h,
      alpha
    );
  }

  if (
    mode === CARRY_SOURCE_MODE_MIXED
    ||
    mode === CARRY_SOURCE_MODE_HUMAN
  ) {

    drawSourcePass(
      HUMAN_TEST_COLOR,
      humanX,
      humanY,
      w,
      h,
      alpha
    );
  }
}


// ==================================================
// VIEWER FIELD
// ==================================================

const VIEWER_RX = 70;
const VIEWER_RY = 110;


// ==================================================
// MOVEMENT
// ==================================================

const MOVE_THRESHOLD = 1.5;

// Keep the original movement threshold while comparing real-time speed.
const REFERENCE_TICK_MS = 1000 / 60;
const STILL_THRESHOLD_MS = 1500;

const MOVEMENT_FIELD_SCALE = 1.7;

const LEAVE_PULSE_DURATION_MS = 35 * REFERENCE_TICK_MS;


// 鼠标刚离开停留状态以后，
// 先保留约0.5秒的空间稳定期。
//
// 注意：
// 这里只延迟
// carry / scatter / jitter / leave pulse。
//
// alpha 的逐渐衰减仍然可以继续。
const LEAVE_TRANSITION_DURATION_MS = 500;

// ==================================================
// DEPOSIT
// ==================================================

const DEPOSIT_RX = 95;
const DEPOSIT_RY = 120;

const DEPOSIT_INTERVAL_MS = 4 * REFERENCE_TICK_MS;
const DEPOSIT_BURST = 1;


// ==================================================
// CARRY
// ==================================================

const CARRY_BASE = 2;

const CARRY_STEP_DURATION_MS = 1800 * REFERENCE_TICK_MS;

const CARRY_MAX_PER_STOP = 12;

const CARRY_EXTRA_COUNT = 10;

const DISTANCE_RADIUS_MIN = 70;
const DISTANCE_RADIUS_MAX = 180;

const FRAGMENTATION_DISPLACEMENT_MAX = 34;
const FRAGMENTATION_GAP_MAX = 22;

const CARRIED_CLUSTER_RADIUS = 72;
const CARRIED_MOVE_SMOOTHING = 0.055;
const CARRIED_LOSS_DURATION_MS = 9000;

const SOUND_MASTER_LEVEL = 0.035;


// ==================================================
// IMPRINT FORMATION
// ==================================================

const FULL_IMPRINT_DURATION_MS = 14400 * REFERENCE_TICK_MS;

const IMPRINT_FORM_START_MS = 180 * REFERENCE_TICK_MS;

const IMPRINT_FORM_MID_MS = 1200 * REFERENCE_TICK_MS;

const IMPRINT_DARK_START_MS = 900 * REFERENCE_TICK_MS;


// ==================================================
// 7 SECOND RULE
// ==================================================

// The first 1.5 seconds are used to recognize STAYING. The original
// seven-second rule therefore applies to the following 5.5 seconds.
const SEVEN_SECOND_DURATION_MS = 7000;
const DECAY_TRIGGER_MS =
  SEVEN_SECOND_DURATION_MS - STILL_THRESHOLD_MS;


// ==================================================
// V02 MEMORY
// ==================================================

const EXTRA_MEMORY_RETENTION = 0.10;


// ==================================================
// DECAY SPEED
// ==================================================

const IMPRINT_DECAY_DURATION_MS = 3600 * REFERENCE_TICK_MS;

const FRAGMENT_DECAY_DURATION_MS = 1800 * REFERENCE_TICK_MS;


// ==================================================
// DATA
// ==================================================

let sources =
  new Array(SOURCE_COUNT);

let sourceById =
  new Map();

let fragments = [];

let imprints = [];

let carriedShapes = [];

let audioContext = null;
let audioMasterGain = null;
let soundNodes = null;
let audioStarted = false;


// ==================================================
// VIEWER STATE
// ==================================================

let viewerState =
  "OUTSIDE";

let previousViewerState =
  "OUTSIDE";

let stillTimeMs = 0;

let previousMouseX = 0;
let previousMouseY = 0;

let viewerWasInside = false;

let viewerDX = 0;
let viewerDY = 0;

let viewerSpeed = 0;

let leavePulseRemainingMs = 0;
let leaveTransitionStartTimeMs = 0;
let leaveTransitionProgress = 0;


// ==================================================
// CURRENT STOP
// ==================================================

let currentStopId = 0;

let stopX = 0;
let stopY = 0;

let currentStopTimeMs = 0;

let depositAccumulatorMs = 0;

let frameDeltaMs = 0;

let currentImprint = null;


// ==================================================
// CARRIED COUNT
// ==================================================

let carriedCountThisFrame = 0;


function getLeaveTransitionEase() {

  let t =
    constrain(
      leaveTransitionProgress,
      0,
      1
    );


  // Smoothstep keeps both ends of the visual transition continuous.
  return t * t * (3 - 2 * t);
}


function getLeavePulseInfluence() {

  if (viewerState === "LEAVING") {
    return getLeaveTransitionEase();
  }


  if (leavePulseRemainingMs <= 0) {
    return 0;
  }


  return constrain(
    leavePulseRemainingMs / LEAVE_PULSE_DURATION_MS,
    0,
    1
  );
}


function getSourceParams(sourceType) {

  return sourceType === "ai"
    ? aiParams
    : humanParams;
}


function mapDistanceRadius(value) {

  return map(
    constrain(value, 0, 1),
    0,
    1,
    DISTANCE_RADIUS_MIN,
    DISTANCE_RADIUS_MAX
  );
}


function mapFragmentationDisplacement(value) {

  return map(
    constrain(value, 0, 1),
    0,
    1,
    0,
    FRAGMENTATION_DISPLACEMENT_MAX
  );
}


function mapFragmentationGap(value) {

  return map(
    constrain(value, 0, 1),
    0,
    1,
    0,
    FRAGMENTATION_GAP_MAX
  );
}


function getStableValue(source, salt) {

  return noise(
    source.t
    +
    salt
  );
}


function getRetentionValue(member) {

  return constrain(
    member.retentionValue,
    0,
    1
  );
}


function startTraceAudio() {

  if (
    audioStarted
  ) {

    if (
      audioContext !== null
      &&
      audioContext.state === "suspended"
    ) {

      audioContext.resume();
    }

    return;
  }


  let AudioContextClass =
    window.AudioContext
    ||
    window.webkitAudioContext;


  if (
    AudioContextClass === undefined
  ) {

    return;
  }


  audioContext =
    new AudioContextClass();

  audioMasterGain =
    audioContext.createGain();

  audioMasterGain.gain.value =
    SOUND_MASTER_LEVEL;

  audioMasterGain.connect(
    audioContext.destination
  );

  let humanOscillator =
    audioContext.createOscillator();

  let aiOscillator =
    audioContext.createOscillator();

  let carryOscillator =
    audioContext.createOscillator();

  let humanGain =
    audioContext.createGain();

  let aiGain =
    audioContext.createGain();

  let carryGain =
    audioContext.createGain();

  humanOscillator.type = "triangle";
  aiOscillator.type = "square";
  carryOscillator.type = "sine";

  humanOscillator.frequency.value = 165;
  aiOscillator.frequency.value = 330;
  carryOscillator.frequency.value = 110;

  humanGain.gain.value = 0;
  aiGain.gain.value = 0;
  carryGain.gain.value = 0;

  humanOscillator.connect(humanGain);
  aiOscillator.connect(aiGain);
  carryOscillator.connect(carryGain);

  humanGain.connect(audioMasterGain);
  aiGain.connect(audioMasterGain);
  carryGain.connect(audioMasterGain);

  humanOscillator.start();
  aiOscillator.start();
  carryOscillator.start();

  soundNodes = {
    humanGain,
    aiGain,
    carryGain
  };

  audioStarted = true;
}


function setTraceSoundGain(node, value) {

  if (
    audioContext === null
    ||
    node === undefined
  ) {

    return;
  }

  node.gain.setTargetAtTime(
    constrain(value, 0, 1),
    audioContext.currentTime,
    0.08
  );
}


function updateTraceSound() {

  if (
    !audioStarted
    ||
    soundNodes === null
  ) {

    return;
  }

  let movingLevel =
    viewerState === "MOVING"
    ||
    viewerState === "LEAVING"
      ? constrain(viewerSpeed / 500, 0, 1)
        +
        getLeavePulseInfluence() * 0.3
      : 0;

  let stayingLevel =
    currentImprint !== null
      ? currentImprint.formStrength
      : 0;

  let carryLevel =
    min(
      1,
      carriedShapes.length * 0.2
      +
      viewerSpeed / 800
    );

  setTraceSoundGain(
    soundNodes.humanGain,
    movingLevel * humanParams.intensity * 0.45
    +
    stayingLevel * humanParams.intensity * 0.55
  );

  setTraceSoundGain(
    soundNodes.aiGain,
    movingLevel * aiParams.intensity * 0.45
    +
    stayingLevel * aiParams.intensity * 0.55
  );

  setTraceSoundGain(
    soundNodes.carryGain,
    carryLevel * 0.7
  );
}


function mousePressed() {

  startTraceAudio();
}


function touchStarted() {

  startTraceAudio();
}
// ==================================================
// SETUP
// ==================================================
async function setup() {

  // ==================================================
  // LOAD JSON
  // p5.js 2.x：等待 JSON 读取完成以后再继续 setup
  // ==================================================

  try {

    traceData =
      await loadJSON(
        "./trace-data.json"
      );

    aiParams =
      traceData.ai_parameters;

    humanParams =
      traceData.human_parameters;

    console.log(
      "TRACE DATA LOADED:",
      traceData
    );

    console.log(
      "AI instability:",
      aiParams.instability
    );

    console.log(
      "Human instability:",
      humanParams.instability
    );

  }

  catch (error) {

    console.error(
      "TRACE DATA LOAD FAILED:",
      error
    );

    // 安全后备值：
    // 即使 JSON 暂时读取失败，程序也不会因为参数为空直接崩掉。
    aiParams = {
      intensity: 0.35,
      instability: 0.75,
      persistence: 0.40,
      fragmentation: 0.80,
      distance: 0.60,
      uncertainty: 0.70
    };

    humanParams = {
      intensity: 0.80,
      instability: 0.30,
      persistence: 0.85,
      fragmentation: 0.35,
      distance: 0.45,
      uncertainty: 0.25
    };
  }


  // ----------------------------------------------
  // 运行时版本标记
  //
  // 如果 Safari 标签不是这个名字，
  // 说明当前没有运行这份 v03 sketch.js。
  // ----------------------------------------------

  document.title =
    "interactive-trace-v04 | material-behaviour | time-state";

  console.log(
    "RUNNING: interactive-trace-v04 | material-behaviour | time-state"
  );


  createCanvas(
    800,
    600
  );


  noSmooth();

  rectMode(CENTER);

  noStroke();


  sources = [];
  sourceById.clear();


  for (
    let i = 0;
    i < SOURCE_COUNT;
    i++
  ) {

    let legacySlotGeometry = {
      x: random(width),
      y: random(height),
      w: random(3, 9),
      h: random(3, 8),
      alpha: random(16, 32),
      t: random(1000)
    };


    // Keep the old per-slot order: AI pass, then Human pass.
    sources.push(
      new TraceSource(
        legacySlotGeometry,
        "ai"
      )
    );

    sources.push(
      new TraceSource(
        legacySlotGeometry,
        "human"
      )
    );

    sourceById.set(
      sources[sources.length - 2].sourceId,
      sources[sources.length - 2]
    );

    sourceById.set(
      sources[sources.length - 1].sourceId,
      sources[sources.length - 1]
    );
  }
}


// ==================================================
// DRAW
// ==================================================

function draw() {

  background(255);

  frameDeltaMs =
    max(deltaTime, 0);


  previousViewerState =
    viewerState;


  updateViewerState();


  if (
    previousViewerState === "LEAVING"
    &&
    viewerState !== "LEAVING"
    &&
    leaveTransitionProgress >= 1
  ) {

    cleanupTemporaryMembership();
  }


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
    viewerState === "LEAVING"
  ) {

    handleLeaveStop();
  }


  // ==================================================
  // LEAVE PULSE COUNTDOWN
  // ==================================================

  leavePulseRemainingMs =
    max(
      0,
      leavePulseRemainingMs - frameDeltaMs
    );


  // ==================================================
  // STAYING
  // ==================================================

  if (
    viewerState === "STAYING"
  ) {

    currentStopTimeMs += frameDeltaMs;


    if (
      currentImprint !== null
    ) {

      currentImprint.grow(
        currentStopTimeMs
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
  // 4. REAL CARRIED SHAPES
  // ==================================================

  for (
    let i = carriedShapes.length - 1;
    i >= 0;
    i--
  ) {

    carriedShapes[i].update();
    carriedShapes[i].display();
  }


  updateTraceSound();


  // ==================================================
}


// ==================================================
// CALCULATE FORM STRENGTH
// ==================================================

function calculateFormStrength(
  stopTimeMs
) {

  let formRaw =

    map(

      constrain(
        stopTimeMs,
        IMPRINT_FORM_START_MS,
        IMPRINT_FORM_MID_MS
      ),

      IMPRINT_FORM_START_MS,
      IMPRINT_FORM_MID_MS,

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
  stopTimeMs
) {

  let darkRaw =

    map(

      constrain(
        stopTimeMs,
        IMPRINT_DARK_START_MS,
        FULL_IMPRINT_DURATION_MS
      ),

      IMPRINT_DARK_START_MS,
      FULL_IMPRINT_DURATION_MS,

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

function calculateMemoryTimeMs(
  stopTimeMs
) {

  // ----------------------------------------------
  // <= 7秒
  //
  // 保留实际停留状态
  // ----------------------------------------------

  if (
    stopTimeMs <=
    DECAY_TRIGGER_MS
  ) {

    return stopTimeMs;
  }


  // ----------------------------------------------
  // > 7秒
  //
  // 7秒 + 超出部分 × 10%
  // ----------------------------------------------

  let extraTimeMs =

    stopTimeMs
    -
    DECAY_TRIGGER_MS;


  return

    DECAY_TRIGGER_MS

    +

    extraTimeMs
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
    legacySlotGeometry,
    sourceType
  ) {

    this.sourceType = sourceType;
    this.sourceId =
      createAmbientSourceId(sourceType);

    this.state = "AMBIENT";

    // Both independent source objects copy one legacy slot's initial
    // geometry and noise phase. No second random geometry is generated.
    this.x = legacySlotGeometry.x;
    this.y = legacySlotGeometry.y;
    this.w = legacySlotGeometry.w;
    this.h = legacySlotGeometry.h;
    this.alpha = legacySlotGeometry.alpha;
    this.t = legacySlotGeometry.t;


    this.jitterX = 0;
    this.jitterY = 0;

    this.lastRenderX = this.x;
    this.lastRenderY = this.y;
    this.lastRenderW = this.w;
    this.lastRenderH = this.h;
    this.lastRenderAlpha = 0;
    this.hasRenderSnapshot = false;


  }


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    if (
      this.state !== "AMBIENT"
    ) {

      return;
    }

    this.jitterX = 0;
    this.jitterY = 0;
    // ----------------------------------------------
    // Environmental disturbance is also part of the continuous leave
    // transition; its influence is zero at transition progress 0.
    // ----------------------------------------------

    if (

      (
        (
          viewerState === "MOVING"
          ||
          viewerState === "LEAVING"
        )
        ||
        getLeavePulseInfluence() > 0
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
          0.05 * frameDeltaMs / REFERENCE_TICK_MS;


        let proximity =
          1 - fieldDistance;


        let speedStrength =

          constrain(
            viewerSpeed / 12,
            0,
            1
          );


        let movementInfluence =
          viewerState === "LEAVING"
            ? getLeaveTransitionEase()
            : 1;


        let strength =

          2

          +

          proximity * 3

          +

          speedStrength * 2;


        strength *= movementInfluence;


        if (
          getLeavePulseInfluence() > 0
        ) {

          strength +=

            2

            *

            getLeavePulseInfluence();
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
          viewerDX * 0.04 * movementInfluence;


        this.jitterY +=
          viewerDY * 0.04 * movementInfluence;


      }
    }
  }


  // ==================================================
  // DISPLAY
  // ==================================================

  display() {

    if (
      this.state !== "AMBIENT"
    ) {

      return;
    }

    this.displayAt(
      this.x,
      this.y,
      this.jitterX,
      this.jitterY
    );
  }


  displayAt(
    x,
    y,
    jitterX = 0,
    jitterY = 0,
    alphaScale = 1
  ) {

    if (this.sourceType === "ai") {

      let aiAlpha =
        map(
          aiParams.intensity,
          0,
          1,
          8,
          60
        ) * alphaScale;

      let aiSpread =
        map(
          aiParams.instability,
          0,
          1,
          0,
          10
        );

      let aiOffsetX =
        map(
          noise(this.t + 2000),
          0,
          1,
          -aiSpread,
          aiSpread
        );

      let aiOffsetY =
        map(
          noise(this.t + 3000),
          0,
          1,
          -aiSpread,
          aiSpread
        );

      let renderX = x + jitterX + aiOffsetX;
      let renderY = y + jitterY + aiOffsetY;

      this.lastRenderX = renderX;
      this.lastRenderY = renderY;
      this.lastRenderW = this.w;
      this.lastRenderH = this.h;
      this.lastRenderAlpha = aiAlpha;
      this.hasRenderSnapshot = true;

      drawAiMaterial(
        AI_TEST_COLOR,
        renderX,
        renderY,
        this.w,
        this.h,
        aiAlpha
      );

      return;
    }


      let humanAlpha =
      map(
        humanParams.intensity,
        0,
        1,
          8,
          60
      ) * alphaScale;

    let humanSpread =
      map(
        humanParams.instability,
        0,
        1,
        0,
        10
      );

    let humanOffsetX =
      map(
        noise(this.t + 4000),
        0,
        1,
        -humanSpread,
        humanSpread
      );

    let humanOffsetY =
      map(
        noise(this.t + 5000),
        0,
        1,
        -humanSpread,
        humanSpread
      );

    let renderX = x + jitterX + humanOffsetX;
    let renderY = y + jitterY + humanOffsetY;

    this.lastRenderX = renderX;
    this.lastRenderY = renderY;
    this.lastRenderW = this.w;
    this.lastRenderH = this.h;
    this.lastRenderAlpha = humanAlpha;
    this.hasRenderSnapshot = true;

    drawHumanMaterial(
      HUMAN_TEST_COLOR,
      renderX,
      renderY,
      this.w,
      this.h,
      humanAlpha
    );
  }


  displayMember(
    member,
    progress,
    alphaScale = 1
  ) {

    let snapshotX = member.startX;

    let snapshotY = member.startY;

    let x = lerp(
      snapshotX,
      member.targetX,
      constrain(progress, 0, 1)
    );

    let y = lerp(
      snapshotY,
      member.targetY,
      constrain(progress, 0, 1)
    );

    let w = member.startW || this.w;

    let h = member.startH || this.h;

    let alpha = member.startAlpha || map(
        getSourceParams(this.sourceType).intensity,
        0,
        1,
        8,
        60
      );

    drawSourceMaterialAt(
      this.sourceType,
      x,
      y,
      w,
      h,
      alpha * alphaScale
    );
  }
}


// ==================================================
// RESIDUAL IMPRINT
// ==================================================

class ResidualImprint {

  constructor(
    x,
    y,
    stopId
  ) {

    this.x = x;
    this.y = y;
    this.stopId = stopId;

    this.members = [];
    this.membershipActive = false;
    this.membershipProgress = 0;
    this.consumedScaffoldPieces = [];
    this.membershipMode = "REAL";


    this.active = true;

    this.ageMs = 0;

    this.stopTimeMs = 0;


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

    this.memoryTimeMs = 0;

    this.targetFormStrength = 0;

    this.targetDarkStrength = 0;


    this.shouldDecay = false;


    // 离开后的第一次更新保持 age 为0

    this.leavePending = false;


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

        aiOffsetX:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        aiOffsetY:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        humanOffsetX:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        humanOffsetY:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

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

        aiOffsetX:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        aiOffsetY:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        humanOffsetX:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        humanOffsetY:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

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

        aiOffsetX:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        aiOffsetY:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        humanOffsetX:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

        humanOffsetY:
          random(
            -RESIDUAL_SOURCE_OFFSET,
            RESIDUAL_SOURCE_OFFSET
          ),

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
  // TEMPORARY SOURCE MEMBERSHIP
  // ==================================================

  addTemporaryMember(
    source,
    targetPiece,
    startXOverride = null,
    startYOverride = null
  ) {

    let sourceParams =
      getSourceParams(source.sourceType);

    let fragmentation =
      constrain(
        sourceParams.fragmentation,
        0,
        1
      );

    let displacement =
      mapFragmentationDisplacement(
        fragmentation
      );

    let gap =
      mapFragmentationGap(
        fragmentation
      );

    let angle =
      noise(source.t + targetPiece.x + 4000)
      *
      TWO_PI;

    let offsetMagnitude =
      (displacement + gap)
      *
      noise(source.t + targetPiece.y + 5000);

    let fragmentationOffsetX =
      cos(angle) * offsetMagnitude;

    let fragmentationOffsetY =
      sin(angle) * offsetMagnitude;

    let targetLocalX =
      targetPiece.x + fragmentationOffsetX;

    let targetLocalY =
      targetPiece.y + fragmentationOffsetY;

    let member = {
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      stopId: this.stopId,
      state: "IN_IMPRINT",
      startX: startXOverride === null
        ? source.hasRenderSnapshot
          ? source.lastRenderX
          : source.x
        : startXOverride,
      startY: startYOverride === null
        ? source.hasRenderSnapshot
          ? source.lastRenderY
          : source.y
        : startYOverride,
      localX: targetLocalX,
      localY: targetLocalY,
      targetX: this.x + targetLocalX,
      targetY: this.y + targetLocalY,
      targetPiece: targetPiece,
      retentionValue: noise(source.t + 6000),
      startW: source.hasRenderSnapshot
        ? source.lastRenderW
        : source.w,
      startH: source.hasRenderSnapshot
        ? source.lastRenderH
        : source.h,
      startAlpha: source.hasRenderSnapshot
        ? source.lastRenderAlpha
        : map(
          sourceParams.intensity,
          0,
          1,
          8,
          60
        )
    };


    this.members.push(member);
    this.membershipActive = true;
    source.state = "IN_IMPRINT";
  }


  updateTemporaryMembers() {

    if (
      !this.membershipActive
      ||
      viewerState === "LEAVING"
    ) {

      return;
    }


    this.membershipProgress =
      max(
        this.membershipProgress,
        this.formStrength
      );

    let formationProgress =
      constrain(
        this.membershipProgress,
        0,
        1
      );


    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      let member = this.members[i];
      let source = sourceById.get(member.sourceId);


      if (
        source === undefined
      ) {

        continue;
      }


      source.jitterX = 0;
      source.jitterY = 0;
    }
  }


  displayTemporaryMembers() {

    if (
      !this.membershipActive
    ) {

      return;
    }


    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      let member = this.members[i];
      let source = sourceById.get(member.sourceId);


      if (
        source === undefined
      ) {

        continue;
      }


      if (
        member.state === "CARRIED"
      ) {

        continue;
      }

      let alphaScale =
        this.active || !this.shouldDecay
          ? 1
          : this.residualFloor
            +
            (1 - this.residualFloor)
            *
            this.getDecayFactor();

      source.displayMember(
        member,
        this.membershipProgress,
        alphaScale
      );
    }
  }


  isTemporaryScaffoldPiece(piece) {

    if (
      this.consumedScaffoldPieces.indexOf(piece) !== -1
    ) {

      return true;
    }

    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      if (
        this.members[i].targetPiece === piece
      ) {

        return true;
      }
    }


    return false;
  }


  clearTemporaryMembership() {

    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      let member = this.members[i];
      let source = sourceById.get(member.sourceId);


      if (
        source !== undefined
      ) {

        source.x = member.startX;
        source.y = member.startY;
        source.jitterX = 0;
        source.jitterY = 0;
        source.state = "AMBIENT";
      }
    }


    this.members = [];
    this.membershipActive = false;
  }


  // ==================================================
  // GROW
  // ==================================================

  grow(
    stopTimeMs
  ) {

    this.stopTimeMs =
      stopTimeMs;


    this.formStrength =

      calculateFormStrength(
        stopTimeMs
      );


    this.darkStrength =

      calculateDarkStrength(
        stopTimeMs
      );
  }


  // ==================================================
  // FREEZE
  // ==================================================

  freeze() {

    this.active = false;

    this.ageMs = 0;

    this.leavePending = true;


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

      this.stopTimeMs
      >
      DECAY_TRIGGER_MS;


    // ----------------------------------------------
    // v02长期记忆目标
    // ----------------------------------------------

    this.memoryTimeMs =

      calculateMemoryTimeMs(
        this.stopTimeMs
      );


    this.targetFormStrength =

      calculateFormStrength(
        this.memoryTimeMs
      );


    this.targetDarkStrength =

      calculateDarkStrength(
        this.memoryTimeMs
      );
  }


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    this.updateTemporaryMembers();

    if (
      !this.active
    ) {

      // 离开后的第一次更新保持 age 为0

      if (
        this.leavePending
      ) {

        this.leavePending =
          false;
      }

      else {

        this.ageMs += frameDeltaMs;
      }
    }
  }


  // ==================================================
  // DECAY FACTOR
  // ==================================================

  getDecayFactor() {

    return exp(
      -this.ageMs
      /
      IMPRINT_DECAY_DURATION_MS
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

    this.displayTemporaryMembers();

    // During the active stop, real source membership is the only primary
    // imprint visual. Synthetic pieces remain available for post-leave
    // residual compatibility but must not create a second STAYING shadow.
    if (
      this.active
      &&
      this.stopId === currentStopId
    ) {

      return;
    }

    push();


    translate(
      this.x,
      this.y
    );


    noStroke();


    // Both live and post-leave rendering use the same piece renderer.
    // While active, copy the actual live strengths into the same start
    // slots used by the leave renderer; this makes t=0 a direct replay.
    if (this.active) {
      this.frozenFormStrength = this.formStrength;
      this.frozenDarkStrength = this.darkStrength;
      this.targetFormStrength = this.formStrength;
      this.targetDarkStrength = this.darkStrength;
    }

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
        this.isTemporaryScaffoldPiece(piece)
      ) {

        continue;
      }


      if (
        piece.threshold
        >
        this.formStrength
      ) {

        continue;
      }


      drawSourcePasses(
        CARRY_SOURCE_MODE_MIXED,
        piece.x,
        piece.y,
        piece.w,
        piece.h,
        min(
          255,
          piece.alpha
          +
          fillBase
        ),
        piece
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
        this.isTemporaryScaffoldPiece(piece)
      ) {

        continue;
      }


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


      drawSourcePasses(
        CARRY_SOURCE_MODE_MIXED,
        0,
        0,
        piece.w,
        piece.h,
        min(
          255,
          piece.alpha
          +
          edgeBase
        ),
        piece
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
        this.isTemporaryScaffoldPiece(piece)
      ) {

        continue;
      }


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


      drawSourcePasses(
        CARRY_SOURCE_MODE_MIXED,
        piece.x,
        piece.y,
        piece.w,
        piece.h,
        min(
          255,
          alpha
        ),
        piece
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


      if (
        this.isTemporaryScaffoldPiece(piece)
      ) {

        continue;
      }


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


      drawSourcePasses(
        CARRY_SOURCE_MODE_MIXED,
        piece.x,
        piece.y,
        piece.w,
        piece.h,
        alpha,
        piece
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


      if (
        this.isTemporaryScaffoldPiece(piece)
      ) {

        continue;
      }


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


      drawSourcePasses(
        CARRY_SOURCE_MODE_MIXED,
        0,
        0,
        piece.w,
        piece.h,
        alpha,
        piece
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


      if (
        this.isTemporaryScaffoldPiece(piece)
      ) {

        continue;
      }


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


      drawSourcePasses(
        CARRY_SOURCE_MODE_MIXED,
        piece.x,
        piece.y,
        piece.w,
        piece.h,
        alpha,
        piece
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

    // This mode is assigned only when the fragment becomes carried.
    // Before then, all fragment states use both independent source passes.
    this.carrySourceMode = CARRY_SOURCE_MODE_MIXED;

    // Stable, related micro-geometry for the two source layers.
    this.aiOffsetX =
      random(
        -FRAGMENT_SOURCE_OFFSET,
        FRAGMENT_SOURCE_OFFSET
      );

    this.aiOffsetY =
      random(
        -FRAGMENT_SOURCE_OFFSET,
        FRAGMENT_SOURCE_OFFSET
      );

    this.humanOffsetX =
      random(
        -FRAGMENT_SOURCE_OFFSET,
        FRAGMENT_SOURCE_OFFSET
      );

    this.humanOffsetY =
      random(
        -FRAGMENT_SOURCE_OFFSET,
        FRAGMENT_SOURCE_OFFSET
      );


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


    this.settleAgeMs = 0;


    // 刚 settle 的第一次更新先不推进 scatter

    this.settlePending = true;


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


    // Exact visual values used by the last STAYING frame.  LEAVING
    // interpolates from this record instead of reconstructing that frame.
    this.leaveVisualSnapshot = null;
  }


  // ==================================================
  // SETTLE
  // ==================================================

  settle(
    stopTimeMs
  ) {

    this.settled = true;

    this.settleAgeMs = 0;


    this.shouldDecay =

      stopTimeMs
      >
      DECAY_TRIGGER_MS;


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
        -stopTimeMs
        /
        (600 * REFERENCE_TICK_MS)
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


  captureLeaveVisualSnapshot(
    stopTimeMs
  ) {

    let stayStrength =

      1

      -

      exp(
        -stopTimeMs
        /
        (600 * REFERENCE_TICK_MS)
      );


    let stayMultiplier =
      0.55 + stayStrength * 0.45;


    this.leaveVisualSnapshot = {
      x: this.x,
      y: this.y,
      width: this.w,
      height: this.h,
      alpha: this.baseAlpha * stayMultiplier,
      jitterX: this.displayJitterX,
      jitterY: this.displayJitterY,
      sourceMode: CARRY_SOURCE_MODE_MIXED
    };
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

    let inLeaveTransition =

      viewerState === "LEAVING"

      &&

      this.stopId === currentStopId;


    let transitionEase =
      inLeaveTransition
        ? getLeaveTransitionEase()
        : 1;


    // =================================================
    // CARRIED
    // =================================================

    if (
      this.carried
    ) {

      // ----------------------------------------------
      // During LEAVING, position is interpolated from the captured
      // STAYING visual state toward the carry target.
      // ----------------------------------------------

      this.carryT +=
        0.018 * frameDeltaMs / REFERENCE_TICK_MS;


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


      if (
        inLeaveTransition
        &&
        this.leaveVisualSnapshot !== null
      ) {

        this.x = lerp(
          this.leaveVisualSnapshot.x,
          targetX,
          transitionEase
        );

        this.y = lerp(
          this.leaveVisualSnapshot.y,
          targetY,
          transitionEase
        );

        return;
      }


      this.x +=

        (
          targetX
          -
          this.x
        )

        *
        (1 - pow(1 - 0.055, frameDeltaMs / REFERENCE_TICK_MS));


      this.y +=

        (
          targetY
          -
          this.y
        )

        *
        (1 - pow(1 - 0.055, frameDeltaMs / REFERENCE_TICK_MS));


      return;
    }


    // =================================================
    // SETTLED
    // =================================================

    if (
      this.settled
    ) {

      let settlingNow =
        this.settlePending;


      if (
        this.settlePending
      ) {

        this.settlePending =
          false;
      }

      else {

        this.settleAgeMs += frameDeltaMs;
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

        transitionEase > 0

      ) {

        this.x +=
          this.scatterX
          * frameDeltaMs / REFERENCE_TICK_MS
          * transitionEase;


        this.y +=
          this.scatterY
          * frameDeltaMs / REFERENCE_TICK_MS
          * transitionEase;


        this.scatterX *=
          pow(0.955, frameDeltaMs / REFERENCE_TICK_MS);


        this.scatterY *=
          pow(0.955, frameDeltaMs / REFERENCE_TICK_MS);
      }


      // =================================================
      // OLD TRACE DISTURBANCE
      // =================================================

      if (

        viewerState === "MOVING"
        ||
        viewerState === "LEAVING"

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
            0.04 * frameDeltaMs / REFERENCE_TICK_MS;


          let strength =
            1.1;


          strength *= transitionEase;


          if (
            getLeavePulseInfluence() > 0
          ) {

            strength +=

              1.4

              *

              getLeavePulseInfluence();
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
      0.006 * frameDeltaMs / REFERENCE_TICK_MS;
  }


  // ==================================================
  // DISPLAY
  // ==================================================

  display() {

    // Once a real source-based carried shape exists, the legacy carried
    // fragment remains as data for residual compatibility but is no longer
    // rendered. This prevents a second carry cloud and saturated red-only
    // legacy pass from competing with the real shape.
    if (
      this.carried
      &&
      carriedShapes.length > 0
    ) {

      return;
    }

    let inLeaveTransition =

      viewerState === "LEAVING"

      &&

      this.stopId === currentStopId;


    if (
      inLeaveTransition
      &&
      this.leaveVisualSnapshot !== null
    ) {

      let p = getLeaveTransitionEase();
      let snapshot = this.leaveVisualSnapshot;
      let alpha = snapshot.alpha;
      let displayW = snapshot.width;
      let displayH = snapshot.height;
      let displayX = this.x;
      let displayY = this.y;
      let jitterX = inLeaveTransition
        ? lerp(snapshot.jitterX, this.displayJitterX, p)
        : this.displayJitterX;
      let jitterY = inLeaveTransition
        ? lerp(snapshot.jitterY, this.displayJitterY, p)
        : this.displayJitterY;
      let sourceMode = snapshot.sourceMode;


      if (this.settled && this.shouldDecay) {
        let decay = exp(
          -this.settleAgeMs / FRAGMENT_DECAY_DURATION_MS
        );
        let targetAlpha = this.baseAlpha * this.residualFloor;
        alpha = targetAlpha + (alpha - targetAlpha) * decay;
      }


      if (this.carried) {
        let accumulation = 1 - exp(
          -carriedCountThisFrame / 70
        );
        let carriedAlpha = alpha * (0.55 + accumulation * 0.45);
        let carriedW = this.w * (1.15 + accumulation * 0.50);
        let carriedH = this.h * (1.10 + accumulation * 0.40);

        alpha = lerp(alpha, carriedAlpha, p);
        displayW = lerp(displayW, carriedW, p);
        displayH = lerp(displayH, carriedH, p);
        sourceMode = this.carrySourceMode;
      }


      if (this.carried && sourceMode !== snapshot.sourceMode) {
        drawSourcePasses(
          snapshot.sourceMode,
          displayX + jitterX,
          displayY + jitterY,
          displayW,
          displayH,
          alpha * (1 - p),
          this
        );

        drawSourcePasses(
          sourceMode,
          displayX + jitterX,
          displayY + jitterY,
          displayW,
          displayH,
          alpha * p,
          this
        );
      }

      else {
        drawSourcePasses(
          sourceMode,
          displayX + jitterX,
          displayY + jitterY,
          displayW,
          displayH,
          alpha,
          this
        );
      }

      return;
    }


    let alpha =
      this.carried
      &&
      this.leaveVisualSnapshot !== null
        ? this.leaveVisualSnapshot.alpha
        : this.baseAlpha;


    let displayW =
      this.w;


    let displayH =
      this.h;


    // =================================================
    // CURRENT STAY
    //
    // carry 已经被选中，
    // The transition branch above replays the captured visual state first.
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
          -currentStopTimeMs
          /
          (600 * REFERENCE_TICK_MS)
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
            -this.settleAgeMs
            /
            FRAGMENT_DECAY_DURATION_MS
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
    // Legacy/post-transition carried rendering.
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


    let isCarriedCloud =

      this.carried;


    // Purple / mixed appearance comes from overlapping red and blue passes.
    // Only the carried cloud uses its assigned source mode.
    drawSourcePasses(
      isCarriedCloud
        ? this.carrySourceMode
        : CARRY_SOURCE_MODE_MIXED,
      this.x + this.displayJitterX,
      this.y + this.displayJitterY,
      displayW,
      displayH,
      alpha,
      this
    );
  }
}


// ==================================================
// BEGIN NEW STOP
// ==================================================

class CarriedShape {

  constructor(
    members,
    x,
    y
  ) {

    this.members = members;
    this.x = x;
    this.y = y;
    this.ageMs = 0;
    this.phase = random(1000);


    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      let member = this.members[i];
      let source = sourceById.get(member.sourceId);

      let initialX =
        member.carryOriginX === undefined
          ? member.targetX
          : member.carryOriginX;

      let initialY =
        member.carryOriginY === undefined
          ? member.targetY
          : member.carryOriginY;

      member.state = "CARRIED";
      member.carryOffsetX = initialX - x;
      member.carryOffsetY = initialY - y;
      member.carryX = initialX;
      member.carryY = initialY;

      if (source !== undefined) {
        source.state = "CARRIED";
      }
    }
  }


  update() {

    this.ageMs += frameDeltaMs;

    let targetX = mouseX;
    let targetY = mouseY;

    this.x +=
      (targetX - this.x)
      *
      (1 - pow(
        1 - CARRIED_MOVE_SMOOTHING,
        frameDeltaMs / REFERENCE_TICK_MS
      ));

    this.y +=
      (targetY - this.y)
      *
      (1 - pow(
        1 - CARRIED_MOVE_SMOOTHING,
        frameDeltaMs / REFERENCE_TICK_MS
      ));

    let driftX =
      map(
        noise(this.phase + this.ageMs * 0.0007),
        0,
        1,
        -4,
        4
      );

    let driftY =
      map(
        noise(this.phase + 1000 + this.ageMs * 0.0007),
        0,
        1,
        -4,
        4
      );


    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      let member = this.members[i];
      let source = sourceById.get(member.sourceId);


      if (source === undefined) {
        continue;
      }

      member.carryX =
        this.x + member.carryOffsetX + driftX;

      member.carryY =
        this.y + member.carryOffsetY + driftY;
    }
  }


  isMemberRetained(member) {

    let persistence =
      constrain(
        getSourceParams(member.sourceType).persistence,
        0,
        1
      );

    let lifetime =
      CARRIED_LOSS_DURATION_MS
      *
      (0.35 + 1.65 * persistence);

    return
      this.ageMs < lifetime
      ||
      member.forceRetain === true;
  }


  getVisibleMemberCount(sourceType) {

    let count = 0;

    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      if (
        this.members[i].sourceType === sourceType
        &&
        this.isMemberRetained(this.members[i])
      ) {

        count++;
      }
    }

    return count;
  }


  display() {

    for (
      let i = 0;
      i < this.members.length;
      i++
    ) {

      let member = this.members[i];
      let source = sourceById.get(member.sourceId);


      if (
        source === undefined
        ||
        !this.isMemberRetained(member)
      ) {

        continue;
      }

      let alphaScale =
        map(
          constrain(
            getSourceParams(member.sourceType).persistence,
            0,
            1
          ),
          0,
          1,
          0.45,
          1
        );

      source.displayAt(
        member.carryX,
        member.carryY,
        0,
        0,
        alphaScale
      );
    }
  }


  getSeedMembers() {

    let result = [];
    let sourceTypes = ["human", "ai"];


    for (
      let t = 0;
      t < sourceTypes.length;
      t++
    ) {

      let sourceType = sourceTypes[t];
      let fallback = null;

      for (
        let i = 0;
        i < this.members.length;
        i++
      ) {

        let member = this.members[i];

        if (
          member.sourceType === sourceType
        ) {

          if (fallback === null) {
            fallback = member;
          }

          if (this.isMemberRetained(member)) {
            result.push(member);
          }
        }
      }


      if (
        !result.some(
          member => member.sourceType === sourceType
        )
        &&
        fallback !== null
      ) {

        fallback.forceRetain = true;
        result.push(fallback);
      }
    }


    return result;
  }
}


function extractCarriedCluster(imprint) {

  if (
    imprint === null
    ||
    imprint.members.length < 1
  ) {

    return;
  }

  let centerMember =
    imprint.members[0];

  let centerDistance = Infinity;


  for (
    let i = 0;
    i < imprint.members.length;
    i++
  ) {

    let member = imprint.members[i];
    let distance = dist(
      member.targetX,
      member.targetY,
      imprint.x,
      imprint.y
    );

    if (distance < centerDistance) {
      centerDistance = distance;
      centerMember = member;
    }
  }


  let selected = [];

  for (
    let i = 0;
    i < imprint.members.length;
    i++
  ) {

    let member = imprint.members[i];

    if (
      dist(
        member.targetX,
        member.targetY,
        centerMember.targetX,
        centerMember.targetY
      ) <= CARRIED_CLUSTER_RADIUS
    ) {

      selected.push(member);
    }
  }


  for (
    let i = 0;
    i < imprint.members.length;
    i++
  ) {

    let member = imprint.members[i];

    if (
      !selected.some(
        selectedMember => selectedMember === member
      )
      &&
      !selected.some(
        selectedMember =>
          selectedMember.sourceType === member.sourceType
      )
    ) {

      selected.push(member);
    }
  }


  if (selected.length === 0) {

    selected.push(centerMember);
  }


  let selectedSet = new Set(selected);
  let remaining = [];


  for (
    let i = 0;
    i < selected.length;
    i++
  ) {

    let member = selected[i];
    let progress = constrain(
      imprint.membershipProgress,
      0,
      1
    );

    member.carryOriginX = lerp(
      member.startX,
      member.targetX,
      progress
    );

    member.carryOriginY = lerp(
      member.startY,
      member.targetY,
      progress
    );
  }


  for (
    let i = 0;
    i < imprint.members.length;
    i++
  ) {

    let member = imprint.members[i];

    if (selectedSet.has(member)) {
      imprint.consumedScaffoldPieces.push(member.targetPiece);
    }

    else {
      member.state = "RESIDUAL";
      let source = sourceById.get(member.sourceId);

      if (source !== undefined) {
        source.state = "RESIDUAL";
      }

      remaining.push(member);
    }
  }


  imprint.members = remaining;
  imprint.membershipActive = imprint.members.length > 0;

  carriedShapes.push(
    new CarriedShape(
      selected,
      imprint.x,
      imprint.y
    )
  );

  console.log(
    "LEAVE",
    imprint.stopId,
    "| imprint members:",
    selected.length + remaining.length,
    "| carried cluster:",
    selected.length,
    "| carried human:",
    selected.filter(
      member => member.sourceType === "human"
    ).length,
    "| carried ai:",
    selected.filter(
      member => member.sourceType === "ai"
    ).length,
    "| residual remaining:",
    remaining.length
  );
}

function beginNewStop() {

  currentStopId++;


  stopX =
    mouseX;


  stopY =
    mouseY;


  currentStopTimeMs = 0;
  depositAccumulatorMs = 0;


  currentImprint =

    new ResidualImprint(
      stopX,
      stopY,
      currentStopId
    );


  imprints.push(
    currentImprint
  );


  selectTemporaryMemberships(
    currentImprint
  );

  let selectedHumanCount =
    currentImprint.members.filter(
      member => member.sourceType === "human"
    ).length;

  let selectedAiCount =
    currentImprint.members.filter(
      member => member.sourceType === "ai"
    ).length;

  console.log(
    "STOP",
    currentStopId,
    "| selected human:",
    selectedHumanCount,
    "| selected ai:",
    selectedAiCount,
    "| members:",
    currentImprint.members.length
  );
}


// FORMAL DISTANCE PARTICIPANT SELECTION
// Human and AI use the same radius mapping, with their own parameter value.
function selectTemporaryMemberships(imprint) {

  let scaffoldPieces = [];


  for (
    let i = 0;
    i < imprint.fillPieces.length;
    i++
  ) {

    scaffoldPieces.push(imprint.fillPieces[i]);
  }


  for (
    let i = 0;
    i < imprint.edgePieces.length;
    i++
  ) {

    scaffoldPieces.push(imprint.edgePieces[i]);
  }


  for (
    let i = 0;
    i < imprint.massPieces.length;
    i++
  ) {

    scaffoldPieces.push(imprint.massPieces[i]);
  }


  let candidates = [];


  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];


    if (
      source.state !== "AMBIENT"
    ) {

      continue;
    }


    let sourceParams =
      getSourceParams(source.sourceType);

    let radius =
      mapDistanceRadius(
        sourceParams.distance
      );

    let sourceDistance =
      dist(
        source.x,
        source.y,
        imprint.x,
        imprint.y
      );


    if (
      sourceDistance <= radius
    ) {

      candidates.push(source);
    }
  }


  let memberCount =
    min(
      candidates.length,
      scaffoldPieces.length
    );


  for (
    let i = 0;
    i < memberCount;
    i++
  ) {

    imprint.addTemporaryMember(
      candidates[i],
      scaffoldPieces[i]
    );
  }


  absorbCarriedSeeds(
    imprint,
    scaffoldPieces,
    memberCount
  );
}


function absorbCarriedSeeds(
  imprint,
  scaffoldPieces,
  startIndex
) {

  let scaffoldIndex = startIndex;


  for (
    let shapeIndex = carriedShapes.length - 1;
    shapeIndex >= 0;
    shapeIndex--
  ) {

    let shape = carriedShapes[shapeIndex];
    let seedMembers = shape.getSeedMembers();
    let consumed = new Set(seedMembers);


    for (
      let i = 0;
      i < seedMembers.length;
      i++
    ) {

      if (
        scaffoldIndex >= scaffoldPieces.length
      ) {

        break;
      }

      let member = seedMembers[i];
      let source = sourceById.get(member.sourceId);


      if (
        source === undefined
      ) {

        continue;
      }

      imprint.addTemporaryMember(
        source,
        scaffoldPieces[scaffoldIndex],
        member.carryX,
        member.carryY
      );

      scaffoldIndex++;
    }


    shape.members = shape.members.filter(
      member => !consumed.has(member)
    );


    if (
      shape.members.length === 0
    ) {

      carriedShapes.splice(shapeIndex, 1);
    }
  }
}


// TEST-ONLY bridge: real membership remains owned by the imprint through
// the existing LEAVING transition, then returns to its original ambient slot.
function cleanupTemporaryMembership() {

  for (
    let i = 0;
    i < imprints.length;
    i++
  ) {

    let imprint = imprints[i];


    if (
      imprint.membershipMode === "TEMPORARY"
      &&
      imprint.membershipActive
      &&
      imprint.stopId === currentStopId
    ) {

      imprint.clearTemporaryMembership();
    }
  }
}


// ==================================================
// CREATE DEPOSIT
// ==================================================

function createDeposit(frameDeltaMs) {

  depositAccumulatorMs += frameDeltaMs;

  while (depositAccumulatorMs >= DEPOSIT_INTERVAL_MS) {

    depositAccumulatorMs -= DEPOSIT_INTERVAL_MS;

    for (
      let i = 0;
      i < DEPOSIT_BURST;
      i++
    ) {

      spawnDepositParticle();
    }
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

function chooseCarrySourceMode() {

  let totalRatio =

    CARRY_MIXED_RATIO
    +
    CARRY_AI_RATIO
    +
    CARRY_HUMAN_RATIO;


  if (
    totalRatio <= 0
  ) {

    return CARRY_SOURCE_MODE_MIXED;
  }


  let choice =
    random(totalRatio);


  if (
    choice < CARRY_MIXED_RATIO
  ) {

    return CARRY_SOURCE_MODE_MIXED;
  }


  if (
    choice <
    CARRY_MIXED_RATIO
    +
    CARRY_AI_RATIO
  ) {

    return CARRY_SOURCE_MODE_AI;
  }


  return CARRY_SOURCE_MODE_HUMAN;
}

function handleLeaveStop() {

  let candidates = [];


  // =================================================
  // LEAVE VISUAL TRANSITION
  //
    // 之前只保持很短的延迟。
  //
    // 延迟结束后 carry / scatter / jitter
  // 就一起启动，所以肉眼仍然像：
  //
  // “鼠标一动，画面立刻跳了一档。”
  //
  // 现在使用约0.5秒连续过渡。
  // =================================================

  leaveTransitionStartTimeMs = millis();
  leaveTransitionProgress = 0;


  leavePulseRemainingMs = 0;


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

      fragment.captureLeaveVisualSnapshot(
        currentStopTimeMs
      );

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

    extractCarriedCluster(
      currentImprint
    );

    currentImprint.freeze();


    currentImprint = null;
  }


  // =================================================
  // CARRY COUNT
  // =================================================

  let carryCount =

    currentStopTimeMs
    <=
    DECAY_TRIGGER_MS

      ?

      floor(

        currentStopTimeMs

        /

        DECAY_TRIGGER_MS

        *

        CARRY_BASE
      )

      :

      CARRY_BASE

      +

      floor(

        currentStopTimeMs

        /

        CARRY_STEP_DURATION_MS
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


  // Preserve the original calculated carry amount, then add the
  // configurable extra cloud fragments without exceeding candidates.
  carryCount +=
    CARRY_EXTRA_COUNT;


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

    chosen.carrySourceMode =
      chooseCarrySourceMode();


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
      currentStopTimeMs
    );
  }


  // =================================================
  // CONSOLE TEST
  // =================================================

  let actualStaySeconds =

    (
      currentStopTimeMs
      +
      STILL_THRESHOLD_MS
    )

    /
    1000;


  let memoryTimeMs =

    calculateMemoryTimeMs(
      currentStopTimeMs
    );


  let memorySeconds =

    (
      memoryTimeMs
      +
      STILL_THRESHOLD_MS
    )

    /
    1000;


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
    )
    /
    max(frameDeltaMs, 1)
    *
    1000;

  const isMoving =
    viewerSpeed >= MOVE_THRESHOLD * 60;

  if (viewerState === "LEAVING") {

    leaveTransitionProgress = constrain(
      (millis() - leaveTransitionStartTimeMs)
      /
      LEAVE_TRANSITION_DURATION_MS,
      0,
      1
    );

    if (leaveTransitionProgress >= 1) {
      viewerState = inside ? "MOVING" : "OUTSIDE";
      leaveTransitionProgress = 1;

      if (leavePulseRemainingMs === 0) {
        leavePulseRemainingMs = LEAVE_PULSE_DURATION_MS;
      }
    }
  }

  else if (!inside) {
    if (viewerState === "STAYING") {
      viewerState = "LEAVING";
      leaveTransitionStartTimeMs = millis();
      leaveTransitionProgress = 0;
    }

    else {
      viewerState = "OUTSIDE";
    }

    stillTimeMs = 0;
  }

  else if (!viewerWasInside) {
    viewerState = "MOVING";
    stillTimeMs = 0;
  }

  else if (isMoving) {
    if (viewerState === "STAYING") {
      viewerState = "LEAVING";
      leaveTransitionStartTimeMs = millis();
      leaveTransitionProgress = 0;
    }

    else {
      viewerState = "MOVING";
    }

    stillTimeMs = 0;
  }

  else if (viewerState !== "STAYING") {
    stillTimeMs += frameDeltaMs;

    viewerState =
      stillTimeMs >= STILL_THRESHOLD_MS
        ? "STAYING"
        : "MOVING";
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
