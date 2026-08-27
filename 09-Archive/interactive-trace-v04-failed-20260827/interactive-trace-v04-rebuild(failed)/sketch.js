// ==================================================
// Day 09
// interactive-trace-v04-rebuild
//
// Day 09 rebuild:
// - Human and AI are independent ambient source elements.
// - Real source elements bridge into the existing v03 imprint / fragment chain.
// - Material differences are restrained tints and procedural structure, not
//   saturated test colors.
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
// Legacy colors are retained for the v03 residual / carried renderer. Ambient
// sources use the material renderer below, so these are not the main visual.
// ==================================================
const AI_TEST_COLOR = [86, 125, 176];
const HUMAN_TEST_COLOR = [182, 112, 124];

const HUMAN_MATERIAL_TINT = [196, 137, 142];
const AI_MATERIAL_TINT = [112, 148, 184];

const AMBIENT_COLUMNS = 36;
const AMBIENT_ROWS = 25;
const SOURCE_COUNT = AMBIENT_COLUMNS * AMBIENT_ROWS;

const DISTANCE_RADIUS_MIN = 58;
const DISTANCE_RADIUS_MAX = 178;
const BRIDGE_GAP_MAX = 9;
const BRIDGE_DISPLACEMENT_MAX = 8;

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

let nextHumanSourceNumber = 1;
let nextAiSourceNumber = 1;

let legacySlots = [];

let carriedShapes = [];

let audioContext = null;
let audioMaster = null;
let audioHuman = null;
let audioAi = null;
let audioCarry = null;
let audioStarted = false;


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

const CARRY_EXTRA_COUNT = 10;


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
  // ----------------------------------------------

  document.title =
    "interactive-trace-v04-rebuild | material-trace";

  console.log(
    "RUNNING: interactive-trace-v04-rebuild | material-trace"
  );


  createCanvas(
    800,
    600
  );


  noSmooth();

  rectMode(CENTER);

  noStroke();


  sources = [];
  legacySlots = [];
  nextHumanSourceNumber = 1;
  nextAiSourceNumber = 1;

  for (let i = 0; i < SOURCE_COUNT; i++) {
    let slot = createLegacySpatialSlot(i);
    let sourceType = i % 2 === 0 ? "ai" : "human";

    legacySlots.push(slot);
    sources.push(
      new TraceSource(
        slot,
        sourceType,
        createSourceId(sourceType)
      )
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

    if (fragments[i].managedByCarriedShape) {
      continue;
    }

    fragments[i].update();

    fragments[i].display();
  }


  // Real source fragments that are being carried stay grouped as one
  // organic shape. The underlying TraceFragment objects remain the source of
  // truth; this wrapper only supplies shared v03-style carry motion.
  for (let i = 0; i < carriedShapes.length; i++) {
    carriedShapes[i].update();
    carriedShapes[i].display();
  }

  updateTraceSound();


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
// AMBIENT SOURCE SUPPORT
// ==================================================

function createSourceId(sourceType) {
  let number;

  if (sourceType === "human") {
    number = nextHumanSourceNumber++;
  }
  else {
    number = nextAiSourceNumber++;
  }

  return sourceType + "-" + String(number).padStart(6, "0");
}


function createLegacySpatialSlot(index) {
  let column = index % AMBIENT_COLUMNS;
  let row = floor(index / AMBIENT_COLUMNS);
  let cellW = width / AMBIENT_COLUMNS;
  let cellH = height / AMBIENT_ROWS;

  return {
    slotId: "slot-" + String(index + 1).padStart(4, "0"),
    x: (column + 0.5) * cellW + random(-cellW * 0.38, cellW * 0.38),
    y: (row + 0.5) * cellH + random(-cellH * 0.38, cellH * 0.38),
    w: random(3, 8),
    h: random(3, 8),
    alpha: random(16, 32),
    t: random(1000),
    jitterX: 0,
    jitterY: 0,
    lastUpdateFrame: -1
  };
}


function getSourceParameters(sourceType) {
  return sourceType === "human" ? humanParams : aiParams;
}


function getDistanceRadius(sourceType) {
  let params = getSourceParameters(sourceType);

  return map(
    constrain(params.distance, 0, 1),
    0,
    1,
    DISTANCE_RADIUS_MIN,
    DISTANCE_RADIUS_MAX
  );
}


function getSourceAlpha(sourceType) {
  let params = getSourceParameters(sourceType);

  return map(
    constrain(params.intensity, 0, 1),
    0,
    1,
    8,
    60
  );
}


function updateLegacySlotMovement(slot) {
  if (slot.lastUpdateFrame === frameCount) {
    return;
  }

  slot.lastUpdateFrame = frameCount;
  slot.jitterX = 0;
  slot.jitterY = 0;

  if (
    leaveCaptureFrames === 0
    &&
    (
      viewerState === "MOVING"
      ||
      leavePulse > 0
    )
  ) {
    let fieldDistance = viewerFieldDistance(
      slot.x,
      slot.y,
      MOVEMENT_FIELD_SCALE
    );

    if (fieldDistance < 1) {
      slot.t += 0.05;

      let proximity = 1 - fieldDistance;
      let speedStrength = constrain(viewerSpeed / 12, 0, 1);
      let strength = 2 + proximity * 3 + speedStrength * 2;

      if (leavePulse > 0) {
        strength += 2 * (leavePulse / LEAVE_PULSE_FRAMES);
      }

      slot.jitterX = map(noise(slot.t), 0, 1, -strength, strength);
      slot.jitterY = map(
        noise(slot.t + 1000),
        0,
        1,
        -strength,
        strength
      );

      slot.jitterX += viewerDX * 0.04;
      slot.jitterY += viewerDY * 0.04;
    }
  }
}


function drawHumanMaterial(x, y, w, h, alpha, seed) {
  let texture = noise(seed + x * 0.008, y * 0.008);
  let paperAlpha = constrain(alpha * (0.50 + texture * 0.25), 0, 255);

  fill(
    HUMAN_MATERIAL_TINT[0],
    HUMAN_MATERIAL_TINT[1],
    HUMAN_MATERIAL_TINT[2],
    paperAlpha
  );
  rect(round(x), round(y), round(w), round(h));

  fill(235, 205, 194, constrain(alpha * 0.34, 0, 255));
  rect(round(x - w * 0.12), round(y - h * 0.08), round(w * 0.52), round(h * 0.24));

  fill(116, 79, 92, constrain(alpha * 0.24, 0, 255));
  rect(round(x + w * 0.18), round(y + h * 0.18), round(w * 0.28), round(h * 0.18));
}


function drawAiMaterial(x, y, w, h, alpha, seed) {
  let scan = noise(seed + x * 0.006, y * 0.006);

  fill(
    AI_MATERIAL_TINT[0],
    AI_MATERIAL_TINT[1],
    AI_MATERIAL_TINT[2],
    constrain(alpha * (0.52 + scan * 0.22), 0, 255)
  );
  rect(round(x), round(y), round(w), round(h));

  fill(36, 75, 111, constrain(alpha * 0.30, 0, 255));
  rect(round(x - w * 0.14), round(y - h * 0.14), round(w * 0.18), round(h * 0.72));
  rect(round(x + w * 0.16), round(y + h * 0.12), round(w * 0.38), round(h * 0.16));

  fill(178, 209, 218, constrain(alpha * 0.24, 0, 255));
  rect(round(x + w * 0.18), round(y - h * 0.22), round(w * 0.46), round(h * 0.12));
}


function drawMaterialBySourceType(sourceType, x, y, w, h, alpha, seed) {
  if (sourceType === "human") {
    drawHumanMaterial(x, y, w, h, alpha, seed);
  }
  else {
    drawAiMaterial(x, y, w, h, alpha, seed);
  }
}


function getCurrentFormationProgress() {
  if (currentImprint === null) {
    return 1;
  }

  return constrain(currentImprint.formStrength, 0, 1);
}


// ==================================================
// TRACE SOURCE
//
// 空间原本存在的痕迹
// ==================================================

/*
Legacy dual-pass implementation retained here only as historical reference.
It is intentionally not executable in the rebuild: ambient sources below are
single-source elements.
class LegacyDualPassTraceSource {

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

    // ==================================================
    // AI PARAMETERS → TEST VISUAL
    // ==================================================

    let aiAlpha =

      map(
        aiParams.intensity,
        0,
        1,
        8,
        60
      );


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
        noise(
          this.t + 2000
        ),
        0,
        1,
        -aiSpread,
        aiSpread
      );


    let aiOffsetY =

      map(
        noise(
          this.t + 3000
        ),
        0,
        1,
        -aiSpread,
        aiSpread
      );


    fill(
      AI_TEST_COLOR[0],
      AI_TEST_COLOR[1],
      AI_TEST_COLOR[2],
      aiAlpha
    );


    rect(

      round(
        this.x
        +
        this.jitterX
        +
        aiOffsetX
      ),

      round(
        this.y
        +
        this.jitterY
        +
        aiOffsetY
      ),

      round(
        this.w
      ),

      round(
        this.h
      )
    );


    // ==================================================
    // HUMAN PARAMETERS → TEST VISUAL
    // ==================================================

    let humanAlpha =

      map(
        humanParams.intensity,
        0,
        1,
        8,
        60
      );


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
        noise(
          this.t + 4000
        ),
        0,
        1,
        -humanSpread,
        humanSpread
      );


    let humanOffsetY =

      map(
        noise(
          this.t + 5000
        ),
        0,
        1,
        -humanSpread,
        humanSpread
      );


    fill(
      HUMAN_TEST_COLOR[0],
      HUMAN_TEST_COLOR[1],
      HUMAN_TEST_COLOR[2],
      humanAlpha
    );


    rect(

      round(
        this.x
        +
        this.jitterX
        +
        humanOffsetX
      ),

      round(
        this.y
        +
        this.jitterY
        +
        humanOffsetY
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
*/


// ==================================================
// TRACE SOURCE (INDEPENDENT AMBIENT ELEMENT)
// ==================================================

class TraceSource {

  constructor(slot, sourceType, sourceId) {
    this.sourceId = sourceId;
    this.sourceType = sourceType;
    this.slot = slot;

    this.x = slot.x;
    this.y = slot.y;
    this.w = slot.w;
    this.h = slot.h;
    this.alpha = slot.alpha;
    this.t = slot.t;
    this.materialSeed = random(10000);
    this.instabilitySeed = random(10000);

    this.jitterX = 0;
    this.jitterY = 0;
    this.lastRenderX = this.x;
    this.lastRenderY = this.y;
    this.membership = null;
  }


  update() {
    updateLegacySlotMovement(this.slot);
    this.t = this.slot.t;
    this.jitterX = this.slot.jitterX;
    this.jitterY = this.slot.jitterY;
  }


  beginMembership(fragment) {
    this.membership = {
      fragment: fragment,
      startX: this.lastRenderX,
      startY: this.lastRenderY,
      stopId: fragment.stopId
    };
  }


  getInstabilityOffset() {
    let params = getSourceParameters(this.sourceType);
    let spread = map(
      constrain(params.instability, 0, 1),
      0,
      1,
      0,
      10
    );
    let sourceOffset = this.sourceType === "human" ? 4000 : 2000;

    return {
      x: map(noise(this.t + sourceOffset, this.instabilitySeed), 0, 1, -spread, spread),
      y: map(noise(this.t + sourceOffset + 1000, this.instabilitySeed), 0, 1, -spread, spread)
    };
  }


  display() {
    let instabilityOffset = this.getInstabilityOffset();
    let ambientX = this.x + this.jitterX + instabilityOffset.x;
    let ambientY = this.y + this.jitterY + instabilityOffset.y;
    let progress = 0;
    let displayX = ambientX;
    let displayY = ambientY;
    let alphaScale = 1;

    if (this.membership !== null) {
      progress = this.getMembershipProgress();
      displayX = lerp(this.membership.startX, ambientX, progress);
      displayY = lerp(this.membership.startY, ambientY, progress);
      alphaScale = 1 - progress;
    }

    this.lastRenderX = displayX;
    this.lastRenderY = displayY;

    drawMaterialBySourceType(
      this.sourceType,
      displayX,
      displayY,
      this.w,
      this.h,
      this.alpha * getSourceAlpha(this.sourceType) / 24 * alphaScale,
      this.materialSeed
    );
  }


  getMembershipProgress() {
    if (this.membership === null) {
      return 0;
    }

    if (
      currentImprint !== null
      &&
      this.membership.stopId === currentStopId
    ) {
      return getCurrentFormationProgress();
    }

    return 1;
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

    // The active stop is represented by real ambient members. These legacy
    // pieces remain as a target scaffold and become the v03 residual after
    // the stop is left; they are not a second synthetic shadow during stay.
    this.suppressLivePieces = true;
    this.excludedTargetPoints = [];

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


  excludeBridgeFragment(fragment) {
    this.excludedTargetPoints.push({
      x: fragment.bridgeTargetX,
      y: fragment.bridgeTargetY,
      radius: max(fragment.w, fragment.h) * 1.8 + 6
    });
  }


  isPieceExcluded(piece) {
    let worldX = this.x + piece.x;
    let worldY = this.y + piece.y;

    for (let i = 0; i < this.excludedTargetPoints.length; i++) {
      let point = this.excludedTargetPoints[i];
      if (dist(worldX, worldY, point.x, point.y) <= point.radius) {
        return true;
      }
    }

    return false;
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

    if (this.isPieceExcluded(piece)) {
      return 0;
    }

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

    if (this.isPieceExcluded(piece)) {
      return 0;
    }

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

    if (this.isPieceExcluded(piece)) {
      return 0;
    }

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

      if (this.suppressLivePieces) {
        pop();
        return;
      }

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
    stopId,
    sourceType = null,
    originSourceId = null,
    sourceRef = null
  ) {

    this.x = x;
    this.y = y;


    this.stopId =
      stopId;

    this.sourceType = sourceType;
    this.originSourceId = originSourceId;
    this.sourceRef = sourceRef;
    this.isMembershipBridge = sourceRef !== null;
    this.bridgeStartX = x;
    this.bridgeStartY = y;
    this.bridgeTargetX = x;
    this.bridgeTargetY = y;
    this.carryCluster = null;
    this.managedByCarriedShape = false;


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

    // Real members already carry their visible source alpha into the bridge.
    // Do not apply a second synthetic alpha step when they settle.
    if (this.isMembershipBridge) {
      this.settledStartMultiplier = 1;
    }
  }


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    this.displayJitterX = 0;

    this.displayJitterY = 0;

    if (this.managedByCarriedShape) {
      return;
    }

    // A real ambient member travels from the exact position captured before
    // membership assignment. The existing imprint form curve supplies the
    // destination progress; no second aggregation trajectory is introduced.
    if (
      this.isMembershipBridge
      &&
      !this.carried
      &&
      !this.settled
    ) {
      let progress = getCurrentFormationProgress();

      this.x = lerp(this.bridgeStartX, this.bridgeTargetX, progress);
      this.y = lerp(this.bridgeStartY, this.bridgeTargetY, progress);
      return;
    }


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

    if (
      this.managedByCarriedShape
      &&
      this.carryCluster === null
    ) {
      return;
    }

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

    if (this.isMembershipBridge) {
      let bridgeAlpha = this.baseAlpha;
      let bridgeW = this.sourceRef === null ? displayW : this.sourceRef.w;
      let bridgeH = this.sourceRef === null ? displayH : this.sourceRef.h;

      if (!this.settled && !this.carried) {
        bridgeAlpha *= getCurrentFormationProgress();
      }

      if (this.settled) {
        bridgeAlpha *= this.shouldDecay
          ? this.residualFloor + (this.settledStartMultiplier - this.residualFloor) * exp(-this.settleAge / FRAGMENT_DECAY_TIME)
          : this.settledStartMultiplier;
      }

      if (this.carried) {
        bridgeAlpha *= 0.72;
        bridgeW *= 1.15;
        bridgeH *= 1.10;
      }

      drawMaterialBySourceType(
        this.sourceType,
        this.x + this.displayJitterX,
        this.y + this.displayJitterY,
        bridgeW,
        bridgeH,
        bridgeAlpha,
        this.sourceRef === null ? this.carryT : this.sourceRef.materialSeed
      );
      return;
    }


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


    let isCarriedCloud =

      this.carried

      &&

      !inLeaveMotionHold;


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
// REAL MEMBERSHIP / CARRIED SHAPE BRIDGE
// ==================================================

function getImprintTarget(imprint, index, source) {
  let pieces = imprint.fillPieces;
  let piece = pieces[index % pieces.length];
  let params = getSourceParameters(source.sourceType);
  let fragmentation = constrain(params.fragmentation, 0, 1);
  let gap = map(fragmentation, 0, 1, 0, BRIDGE_GAP_MAX);
  let direction = noise(source.materialSeed + 91) * TWO_PI;
  let displacement = map(
    noise(source.materialSeed + 92),
    0,
    1,
    0,
    BRIDGE_DISPLACEMENT_MAX * fragmentation
  );

  return {
    x: imprint.x + piece.x + cos(direction) * (gap + displacement),
    y: imprint.y + piece.y + sin(direction) * (gap + displacement)
  };
}


function configureMembershipFragment(fragment, source, imprint, index) {
  let target = getImprintTarget(imprint, index, source);

  fragment.bridgeTargetX = target.x;
  fragment.bridgeTargetY = target.y;
  fragment.bridgeStartX = source.lastRenderX;
  fragment.bridgeStartY = source.lastRenderY;
  fragment.x = fragment.bridgeStartX;
  fragment.y = fragment.bridgeStartY;
  fragment.w = source.w;
  fragment.h = source.h;
  fragment.baseAlpha = source.alpha * getSourceAlpha(source.sourceType) / 24;
  fragment.sourceType = source.sourceType;
  fragment.originSourceId = source.sourceId;
  fragment.sourceRef = source;
  fragment.isMembershipBridge = true;
  fragment.settled = false;
  fragment.carried = false;
  fragment.managedByCarriedShape = false;
  fragment.carryCluster = null;
  source.beginMembership(fragment);
}


function createMembershipFragment(source, imprint, index) {
  let fragment = new TraceFragment(
    source.lastRenderX,
    source.lastRenderY,
    currentStopId,
    source.sourceType,
    source.sourceId,
    source
  );

  configureMembershipFragment(fragment, source, imprint, index);
  fragments.push(fragment);
  return fragment;
}


function selectAndBridgeAmbientSources() {
  let memberIndex = currentImprint.memberFragments.length;

  for (let i = 0; i < sources.length; i++) {
    let source = sources[i];

    if (source.membership !== null) {
      continue;
    }

    let radius = getDistanceRadius(source.sourceType);
    let sourceDistance = dist(
      source.lastRenderX,
      source.lastRenderY,
      stopX,
      stopY
    );

    if (sourceDistance > radius) {
      continue;
    }

    let fragment = createMembershipFragment(
      source,
      currentImprint,
      memberIndex
    );
    currentImprint.memberSourceIds.push(source.sourceId);
    currentImprint.memberFragments.push(fragment);
    memberIndex++;
  }

  console.log(
    "IMPRINT MEMBERS",
    currentStopId,
    "| total:",
    memberIndex,
    "| human radius:",
    getDistanceRadius("human").toFixed(1),
    "| ai radius:",
    getDistanceRadius("ai").toFixed(1)
  );
}


function adoptCarriedShapeSeeds() {
  let seedIndex = 0;

  for (let i = 0; i < carriedShapes.length; i++) {
    let shape = carriedShapes[i];

    if (!shape.active) {
      continue;
    }

    let seedMembers = shape.getRetainedMembers();

    for (let j = 0; j < seedMembers.length; j++) {
      let fragment = seedMembers[j];
      let source = fragment.sourceRef;

      if (source === null) {
        continue;
      }

      fragment.stopId = currentStopId;
      fragment.carried = false;
      fragment.settled = false;
      fragment.managedByCarriedShape = false;
      fragment.carryCluster = null;
      configureMembershipFragment(
        fragment,
        source,
        currentImprint,
        seedIndex++
      );
      currentImprint.memberSourceIds.push(source.sourceId);
      currentImprint.memberFragments.push(fragment);
    }

    shape.active = false;
  }
}


function chooseCarryCluster(candidates, carryCount) {
  let bridgeCandidates = candidates.filter(
    (fragment) => fragment.isMembershipBridge
  );

  if (bridgeCandidates.length === 0) {
    return candidates.slice(0, carryCount);
  }

  let anchor = bridgeCandidates[floor(random(bridgeCandidates.length))];
  let sorted = bridgeCandidates.slice().sort((a, b) => {
    let distanceA = dist(a.x, a.y, anchor.x, anchor.y);
    let distanceB = dist(b.x, b.y, anchor.x, anchor.y);
    return distanceA - distanceB;
  });

  return sorted.slice(0, min(carryCount, sorted.length));
}


class CarriedShape {

  constructor(members) {
    this.members = members;
    this.active = true;
    this.age = 0;
    this.carryT = random(1000);

    let centerX = 0;
    let centerY = 0;

    for (let i = 0; i < members.length; i++) {
      centerX += members[i].x;
      centerY += members[i].y;
    }

    this.x = centerX / max(1, members.length);
    this.y = centerY / max(1, members.length);

    for (let i = 0; i < members.length; i++) {
      let member = members[i];
      member.carryCluster = this;
      member.managedByCarriedShape = true;
      member.carryLocalX = member.x - this.x;
      member.carryLocalY = member.y - this.y;
      member.carried = true;
    }
  }


  update() {
    if (!this.active) {
      return;
    }

    if (leaveCaptureFrames > 0) {
      return;
    }

    this.age++;
    this.carryT += 0.018;

    let driftX = map(noise(this.carryT), 0, 1, -10, 10);
    let driftY = map(noise(this.carryT + 1000), 0, 1, -10, 10);

    this.x += (mouseX - this.x) * 0.055;
    this.y += (mouseY - this.y) * 0.055;

    for (let i = 0; i < this.members.length; i++) {
      let member = this.members[i];
      member.x = this.x + member.carryLocalX + driftX;
      member.y = this.y + member.carryLocalY + driftY;
    }
  }


  getMemberLifetime(member) {
    let params = getSourceParameters(member.sourceType);
    let baseLifetime = map(
      constrain(params.persistence, 0, 1),
      0,
      1,
      150,
      900
    );

    return baseLifetime * (0.82 + noise(member.materialSeed + 700) * 0.36);
  }


  getRetainedMembers() {
    let retained = [];
    let typeCounts = { human: 0, ai: 0 };

    for (let i = 0; i < this.members.length; i++) {
      let member = this.members[i];
      if (this.age <= this.getMemberLifetime(member)) {
        retained.push(member);
        typeCounts[member.sourceType]++;
      }
    }

    for (let type of ["human", "ai"]) {
      if (typeCounts[type] > 0) {
        continue;
      }

      let fallback = this.members.find(
        (member) => member.sourceType === type
      );

      if (fallback !== undefined) {
        retained.push(fallback);
      }
    }

    return retained;
  }


  display() {
    if (!this.active) {
      return;
    }

    let retained = new Set(this.getRetainedMembers());

    for (let i = 0; i < this.members.length; i++) {
      let member = this.members[i];
      if (retained.has(member)) {
        member.display();
      }
    }
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

  currentImprint.stopId = currentStopId;
  currentImprint.memberSourceIds = [];
  currentImprint.memberFragments = [];


  imprints.push(
    currentImprint
  );

  adoptCarriedShapeSeeds();
  selectAndBridgeAmbientSources();
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

  let leavingImprint = currentImprint;

  if (
    leavingImprint !== null
  ) {

    leavingImprint.freeze();
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
  // CARRY A SMALL, SPATIAL PART
  // =================================================

  let selectedCarry = chooseCarryCluster(candidates, carryCount);
  let selectedSet = new Set(selectedCarry);

  for (let i = 0; i < selectedCarry.length; i++) {
    let chosen = selectedCarry[i];
    chosen.carried = true;

    if (
      leavingImprint !== null
      &&
      chosen.isMembershipBridge
    ) {
      leavingImprint.excludeBridgeFragment(chosen);
    }

    if (!chosen.isMembershipBridge) {
      chosen.carrySourceMode = chooseCarrySourceMode();
    }
  }

  if (selectedCarry.some((fragment) => fragment.isMembershipBridge)) {
    carriedShapes.push(new CarriedShape(selectedCarry));
  }

  candidates = candidates.filter(
    (fragment) => !selectedSet.has(fragment)
  );


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


// ==================================================
// QUIET FIRST-PASS SOUND
// ==================================================

function ensureTraceAudio() {
  if (audioStarted) {
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return;
  }

  let AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass === undefined) {
    return;
  }

  audioContext = new AudioContextClass();
  audioMaster = audioContext.createGain();
  audioHuman = audioContext.createOscillator();
  audioAi = audioContext.createOscillator();
  audioCarry = audioContext.createOscillator();

  audioMaster.gain.value = 0.12;
  audioHuman.type = "triangle";
  audioAi.type = "sine";
  audioCarry.type = "sine";
  audioHuman.frequency.value = 176;
  audioAi.frequency.value = 286;
  audioCarry.frequency.value = 92;

  let humanGain = audioContext.createGain();
  let aiGain = audioContext.createGain();
  let carryGain = audioContext.createGain();
  humanGain.gain.value = 0;
  aiGain.gain.value = 0;
  carryGain.gain.value = 0;

  audioHuman.connect(humanGain).connect(audioMaster);
  audioAi.connect(aiGain).connect(audioMaster);
  audioCarry.connect(carryGain).connect(audioMaster);
  audioMaster.connect(audioContext.destination);

  audioHuman._traceGain = humanGain;
  audioAi._traceGain = aiGain;
  audioCarry._traceGain = carryGain;
  audioMaster.gain.value = 0.12;
  audioHuman.start();
  audioAi.start();
  audioCarry.start();
  audioStarted = true;
}


function updateTraceSound() {
  if (!audioStarted) {
    return;
  }

  let now = audioContext.currentTime;
  let humanTarget = viewerState === "MOVING" ? 0.018 : 0.003;
  let aiTarget = viewerState === "MOVING" ? 0.014 : 0.003;
  let carryTarget = countCarriedFragments() > 0 ? 0.010 : 0;

  if (viewerState === "STAYING") {
    humanTarget = 0.004;
    aiTarget = 0.004;
  }

  if (audioHuman._traceGain !== undefined) {
    audioHuman._traceGain.gain.setTargetAtTime(humanTarget, now, 0.08);
    audioAi._traceGain.gain.setTargetAtTime(aiTarget, now, 0.08);
    audioCarry._traceGain.gain.setTargetAtTime(carryTarget, now, 0.10);
  }
}


function mousePressed() {
  ensureTraceAudio();
  return false;
}


function touchStarted() {
  ensureTraceAudio();
  return false;
}
