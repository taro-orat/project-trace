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

// Day 11 Web Bridge: technical state only. It never affects rendering or behaviour.
const BRIDGE_ENDPOINT = "http://localhost:8000/api/latest-parameters";
const ACTIVE_PARAMETER_FIELDS = [
  "intensity",
  "instability",
  "persistence",
  "distance"
];
const LOCAL_FALLBACK_PARAMETERS = {
  ai: {
    intensity: 0.35,
    instability: 0.75,
    persistence: 0.40,
    distance: 0.60
  },
  human: {
    intensity: 0.80,
    instability: 0.30,
    persistence: 0.85,
    distance: 0.45
  }
};
let bridgeState = "loading";

const USE_AI_IMAGE_TRACE = true;
const AI_AMBIENT_IMAGE_PATH = "assets/ai/ai-ambient.png";
let aiAmbientImage = null;
let aiAmbientImageFailed = false;
let aiAmbientImageCache = null;
let aiAmbientImageAspect = 0;
let aiMediaProfile = {
  averageBrightness: 50,
  visualWeight: 1.00
};
const USE_HUMAN_IMAGE_TRACE = true;
const HUMAN_AMBIENT_IMAGE_PATH = "assets/human/human-ambient.JPG";
let humanAmbientImage = null;
let humanAmbientImageFailed = false;
let humanAmbientImageCache = null;
let humanAmbientImageAspect = 0;
let humanMediaProfile = {
  averageBrightness: 50,
  visualWeight: 1.00
};
const CAMERA_INPUT_WIDTH = 320;
const CAMERA_INPUT_HEIGHT = 240;
let cameraInput = null;
let cameraInputState = "unavailable";
let cameraInputReadyLogged = false;
let cameraInputUnavailableLogged = false;
const CAMERA_SAMPLE_COLUMNS = 12;
const CAMERA_SAMPLE_ROWS = 9;
const CAMERA_SAMPLE_INTERVAL_MS = 100;
const CAMERA_PIXEL_NOISE_THRESHOLD = 4;
const CAMERA_MOTION_SMOOTHING = 0.20;
const CAMERA_MOTION_MIN_WEIGHT = 12;
const CAMERA_SENSOR_LOG_INTERVAL_MS = 750;
const CAMERA_MOTION_HIGH_THRESHOLD = 0.027;
const CAMERA_MOTION_LOW_THRESHOLD = 0.020;
const CAMERA_STAY_CONFIRMATION_MS = 800;
const CAMERA_MOTION_SPEED_REFERENCE = 0.10;
const CAMERA_MIRROR_X = true;
const CAMERA_EDGE_ZONE_RATIO = 0.20;
const CAMERA_LEAVING_CONFIRMATION_MS = 800;
const CAMERA_DIRECTION_MIN_DELTA_X = 2;
const CAMERA_PRESENCE_LOG_INTERVAL_MS = 750;
const VIEWER_INPUT_LOG_INTERVAL_MS = 750;
let previousCameraSamples = null;
let cameraCurrentSamples = null;
let lastCameraSampleTime = 0;
let lastCameraSensorLogTime = 0;
let cameraMotionAmount = 0;
let cameraMotionCenterX = CAMERA_INPUT_WIDTH * 0.5;
let cameraMotionCenterY = CAMERA_INPUT_HEIGHT * 0.5;
let cameraMotionValid = false;
let cameraLeavingCandidateActive = false;
let cameraLeavingCandidateDirection = "NONE";
let cameraLeavingCandidateSince = 0;
let cameraLeavingLikely = false;
let lastStrongCameraMotionX = null;
let cameraStillStartedAt = 0;
let cameraInteriorMotionCount = 0;
let cameraReentryMotionCount = 0;
let lastCameraPresenceLogTime = 0;
let viewerInputX = 0;
let viewerInputY = 0;
let viewerInputDX = 0;
let viewerInputDY = 0;
let viewerInputSpeed = 0;
let viewerInputInside = false;
let viewerInputSource = "mouse";
let viewerInputInitialized = false;
let lastViewerInputLogTime = 0;

// Day 14 Trace Log v0.2: event-driven observability only.
const traceLog = [];
const TRACE_PERFORMANCE_INTERVAL_MS = 5000;
let traceLogStartedAt = null;
let lastTraceInputSource = null;
let lastTracePerformanceSampleAt = 0;

function recordTraceEvent(
  eventName,
  details = {}
) {

  let now = millis();

  if (
    traceLogStartedAt === null
    ||
    eventName === "RUN_START"
    ||
    eventName === "TRACE_RESET"
  ) {

    traceLogStartedAt = now;
  }

  let event = {
    elapsedMs: now - traceLogStartedAt,
    millis: now,
    frameCount,
    event: eventName,
    viewerState,
    previousViewerState,
    inputSource: viewerInputSource,
    viewerX: viewerInputX,
    viewerY: viewerInputY,
    viewerSpeed: viewerInputSpeed,
    stopId: currentStopId,
    fragments: fragments.length,
    carried: carriedCountThisFrame,
    imprints: imprints.length,
    ...details
  };

  traceLog.push(event);
  console.log("[TRACE]", event);
  return event;
}

function exportTraceLog() {

  let formatted = JSON.stringify(traceLog, null, 2);
  console.log("TRACE LOG v0.2", formatted);
  return formatted;
}

function clearTraceLog() {

  traceLog.length = 0;
  traceLogStartedAt = null;
  lastTraceInputSource = null;
  lastTracePerformanceSampleAt = 0;
  recordTraceEvent("TRACE_RESET");
  return traceLog;
}

function recordTracePerformanceSample() {

  let now = millis();

  if (
    now - lastTracePerformanceSampleAt
    < TRACE_PERFORMANCE_INTERVAL_MS
  ) {

    return;
  }

  lastTracePerformanceSampleAt = now;

  recordTraceEvent(
    "PERFORMANCE_SAMPLE",
    {
      frameRate: round(frameRate())
    }
  );
}

window.exportTraceLog = exportTraceLog;
window.clearTraceLog = clearTraceLog;

const AI_IMAGE_CACHE_MIN_WIDTH = 4;
const AI_IMAGE_CACHE_MAX_WIDTH = 56;
const AI_IMAGE_CACHE_STEP = 4;
const AI_AMBIENT_IMAGE_VISUAL_SCALE = Math.SQRT2;
const HUMAN_AMBIENT_IMAGE_VISUAL_SCALE = Math.SQRT2;
const MEDIA_IMAGE_ALPHA_MIN = 0.78;
const MEDIA_IMAGE_ALPHA_MAX = 1.00;
const MEDIA_IMAGE_ALPHA_REFERENCE = 60;
const MEDIA_PROFILE_SAMPLE_COLUMNS = 8;
const MEDIA_PROFILE_SAMPLE_ROWS = 8;
const MEDIA_PROFILE_WEIGHT_MIN = 0.94;
const MEDIA_PROFILE_WEIGHT_MAX = 1.06;
const LEGACY_NEUTRAL_COLOR = [150, 150, 150];
const LEGACY_VISUAL_ALPHA_SCALE = 0.55;

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
const CARRY_CLUSTER_RATIO = 0.18;
const CARRY_EDGE_NEIGHBOR_RADIUS = 42;
const CARRY_PERSISTENCE_DURATION_MIN_MS = 24000;
const CARRY_PERSISTENCE_DURATION_MAX_MS = 90000;
const CARRY_PERSISTENCE_DURATION_CURVE = 1.70;
const CARRY_PERSISTENCE_FADE_RATIO = 0.10;
const CARRY_DEPTH_SETTLE_BACK_MS = 2500;

const RESIDUAL_SOURCE_OFFSET = 2.5;
const FRAGMENT_SOURCE_OFFSET = 1.5;

const SOURCE_COUNT = 432;
const AMBIENT_GRID_COLUMNS = 24;
const AMBIENT_GRID_ROWS = 18;
const AMBIENT_GRID_JITTER = 0.34;

// Node 2B: Distance only selects existing ambient sources.
// These values are deliberately independent of the renderer and movement code.
const DISTANCE_MIN_RADIUS = 30;
const DISTANCE_MAX_RADIUS = 150;
const DISTANCE_BOUNDARY_WOBBLE = 0.16;
const DEBUG_DISTANCE_BOUNDARY = false;
const DEBUG_SELECTED_MARKER = false;
const DEBUG_HUD = true;

// Node 2C: gathering motion only. These values do not alter selection.
const GATHERING_DURATION_MS = 6000;
const GATHER_DELAY_MAX_MS = 600;
const GATHER_START_WAVE_RATIO = 1.0;
const GATHER_END_MICRO_MOTION_RATIO = 0.15;
const GATHER_TARGET_RX = 58;
const GATHER_TARGET_RY = 74;
const GHOST_MAX_VISUAL_RATIO = 0.38;
const GHOST_MICRO_MOTION_PX = 0.35;
const DEBUG_LEAVING_HANDOFF = false;
const LEAVING_HANDOFF_MICRO_MOTION_PX = 0.35;
const AMBIENT_RECOVERY_DURATION_MS = 15000;
const AMBIENT_RECOVERY_DELAY_MAX_MS = 2000;
const AMBIENT_APPEARANCE_TRANSITION_MS = 350;
const DEBUG_AMBIENT_RECOVERY = false;
const SHADOW_DEEPEN_DURATION_MS = 90000;
const HUMAN_SHADOW_DEEP_COLOR = [125, 0, 25];
const AI_SHADOW_DEEP_COLOR = [0, 40, 130];
const SHADOW_FINAL_ALPHA_MULTIPLIER = 1.35;
const SHADOW_FINAL_SIZE_MULTIPLIER = 1.10;
const SHADOW_FINAL_VISUAL_WEIGHT = 1.25;
const ACCUMULATION_MAX_LAYERS = 6;
const ACCUMULATION_LAYER_ALPHA_RATIO = 0.32;
const ACCUMULATION_MAX_EXTRUSION_PX = 14;
const ACCUMULATION_LAYER_LATERAL_VARIATION_PX = 0.35;
const ACCUMULATION_LAYER_ROTATION = 0.04;
const THICKNESS_DIRECTION_X = 0.78;
const THICKNESS_DIRECTION_Y = 0.62;

// v05 visual layer only: stable size identity and material skin.
const MATERIAL_VISUAL_SCALE = 1.6;
const MATERIAL_SIZE_TIER_MULTIPLIERS = [
  0.42,
  0.72,
  1.10,
  1.75,
  2.75
];
const HUMAN_MATERIAL_DETAIL_ALPHA = 0.18;
const AI_MATERIAL_DETAIL_ALPHA = 0.34;

let nextHumanSourceNumber = 1;
let nextAISourceNumber = 1;


function createSourceIdentity(
  sourceType
) {

  if (
    sourceType !== "human"
    &&
    sourceType !== "ai"
  ) {

    throw new Error(
      "Invalid sourceType: " + sourceType
    );
  }


  let number;


  if (
    sourceType === "human"
  ) {

    number =
      nextHumanSourceNumber++;
  }

  else {

    number =
      nextAISourceNumber++;
  }


  return {
    sourceId:
      sourceType
      +
      "-"
      +
      String(number).padStart(6, "0"),
    sourceType
  };
}


function getParamsForSourceType(
  sourceType
) {

  if (
    sourceType === "human"
  ) {

    return humanParams;
  }

  if (
    sourceType === "ai"
  ) {

    return aiParams;
  }

  throw new Error(
    "Invalid sourceType: " + sourceType
  );
}


function getStableAmbientPosition(
  sourceId,
  canvasWidth,
  canvasHeight
) {

  let sourceNumber =
    max(
      1,
      parseInt(
        sourceId.slice(-6),
        10
      )
    )
    -
    1;

  let column =
    sourceNumber % AMBIENT_GRID_COLUMNS;

  let row =
    floor(
      sourceNumber /
      AMBIENT_GRID_COLUMNS
    )
    %
    AMBIENT_GRID_ROWS;

  let jitterX =
    getStableAmbientAxisJitter(
      sourceId,
      "x"
    );

  let jitterY =
    getStableAmbientAxisJitter(
      sourceId,
      "y"
    );

  return {
    x:
      (
        column
        +
        0.5
        +
        jitterX
      )
      *
      canvasWidth
      /
      AMBIENT_GRID_COLUMNS,

    y:
      (
        row
        +
        0.5
        +
        jitterY
      )
      *
      canvasHeight
      /
      AMBIENT_GRID_ROWS
  };
}


function getStableAmbientAxisJitter(
  sourceId,
  axis
) {

  let hash =
    axis === "x"
      ? 17
      : 53;

  let key =
    sourceId
    +
    ":ambient:"
    +
    axis;

  for (
    let i = 0;
    i < key.length;
    i++
  ) {

    hash =
      (
        hash * 31
        +
        key.charCodeAt(i)
      )
      %
      100000;
  }

  return (
    (hash % 1000) / 1000
    -
    0.5
  )
  *
  AMBIENT_GRID_JITTER;
}


function getAmbientPositionForSource(
  source,
  sourceType
) {

  return sourceType === "human"
    ? source.humanAmbientPosition
    : source.aiAmbientPosition;
}


function mapDistanceToRadius(
  distanceValue
) {

  return map(
    constrain(distanceValue, 0, 1),
    0,
    1,
    DISTANCE_MIN_RADIUS,
    DISTANCE_MAX_RADIUS
  );
}


function getStableBoundaryUnit(
  stopId,
  sourceType
) {

  let key =
    String(stopId)
    + ":"
    + sourceType;

  let hash = 23;

  for (
    let i = 0;
    i < key.length;
    i++
  ) {

    hash =
      (
        hash * 37
        + key.charCodeAt(i)
      )
      %
      100000;
  }

  return hash / 100000;
}


function getStableUnit(
  key
) {

  let hash = 29;

  for (
    let i = 0;
    i < key.length;
    i++
  ) {

    hash =
      (
        hash * 41
        + key.charCodeAt(i)
      )
      %
      100000;
  }

  return hash / 100000;
}


function createAccumulationLayerDescriptors(
  sourceId
) {

  let descriptors = [];

  for (
    let layerIndex = 0;
    layerIndex < ACCUMULATION_MAX_LAYERS;
    layerIndex++
  ) {

    descriptors.push({
      revealStart:
        0.06
        +
        layerIndex
        *
        0.14,
      revealEnd:
        0.24
        +
        layerIndex
        *
        0.16,
      offsetX:
        map(
          getStableUnit(
            sourceId + ":accumulation:" + layerIndex + ":x"
          ),
          0,
          1,
          -ACCUMULATION_LAYER_LATERAL_VARIATION_PX,
          ACCUMULATION_LAYER_LATERAL_VARIATION_PX
        ),
      offsetY:
        map(
          getStableUnit(
            sourceId + ":accumulation:" + layerIndex + ":y"
          ),
          0,
          1,
          -ACCUMULATION_LAYER_LATERAL_VARIATION_PX,
          ACCUMULATION_LAYER_LATERAL_VARIATION_PX
        ),
      extrusion:
        (
          (layerIndex + 1)
          /
          ACCUMULATION_MAX_LAYERS
        )
        *
        ACCUMULATION_MAX_EXTRUSION_PX,
      rotation:
        map(
          getStableUnit(
            sourceId + ":accumulation:" + layerIndex + ":rotation"
          ),
          0,
          1,
          -ACCUMULATION_LAYER_ROTATION,
          ACCUMULATION_LAYER_ROTATION
        ),
      scale:
        map(
          getStableUnit(
            sourceId + ":accumulation:" + layerIndex + ":scale"
          ),
          0,
          1,
          0.94,
          1.06
        ),
      alphaRatio:
        map(
          getStableUnit(
            sourceId + ":accumulation:" + layerIndex + ":alpha"
          ),
          0,
          1,
          0.85,
          1.15
        )
    });
  }

  return descriptors;
}


function getAccumulationLayerReveal(
  descriptor,
  shadowDepth
) {

  let thicknessProgress =
    getThicknessProgress(shadowDepth);

  let revealRange =
    descriptor.revealEnd
    -
    descriptor.revealStart;

  let rawReveal =
    (
      thicknessProgress
      -
      descriptor.revealStart
    )
    /
    revealRange;

  let reveal = constrain(rawReveal, 0, 1);

  return reveal * reveal * (3 - 2 * reveal);
}


function getThicknessProgress(
  shadowDepth
) {

  let depth = constrain(shadowDepth, 0, 1);

  if (depth <= 0.02) {
    return map(depth, 0, 0.02, 0, 0.08);
  }

  if (depth <= 0.0625) {
    return map(depth, 0.02, 0.0625, 0.08, 0.18);
  }

  if (depth <= 0.125) {
    return map(depth, 0.0625, 0.125, 0.18, 0.32);
  }

  if (depth <= 0.25) {
    return map(depth, 0.125, 0.25, 0.32, 0.50);
  }

  if (depth <= 0.50) {
    return map(depth, 0.25, 0.50, 0.50, 0.68);
  }

  if (depth <= 0.75) {
    return map(depth, 0.50, 0.75, 0.68, 0.84);
  }

  return map(depth, 0.75, 1, 0.84, 1);
}


function drawAccumulationLayers(
  source,
  sourceType,
  position,
  visual,
  shadowDepth
) {

  if (
    shadowDepth <= 0
  ) {

    return;
  }

  let descriptors =
    sourceType === "human"
      ? source.humanAccumulationLayers
      : source.aiAccumulationLayers;

  for (
    let i = 0;
    i < descriptors.length;
    i++
  ) {

    let descriptor = descriptors[i];
    let reveal = getAccumulationLayerReveal(
      descriptor,
      shadowDepth
    );

    if (
      reveal <= 0
    ) {

      continue;
    }

    push();

    translate(
      position.x
      +
      descriptor.offsetX
      +
      descriptor.extrusion * THICKNESS_DIRECTION_X,
      position.y
      +
      descriptor.offsetY
      +
      descriptor.extrusion * THICKNESS_DIRECTION_Y
    );

    rotate(descriptor.rotation);

    let materialScale =
      MATERIAL_VISUAL_SCALE
      * getStableContributionSizeMultiplier(
          getSourceMaterialSeed(source, sourceType)
        );

    fill(
      LEGACY_NEUTRAL_COLOR[0],
      LEGACY_NEUTRAL_COLOR[1],
      LEGACY_NEUTRAL_COLOR[2],
      visual.alpha
      *
      LEGACY_VISUAL_ALPHA_SCALE
      *
      ACCUMULATION_LAYER_ALPHA_RATIO
      *
      descriptor.alphaRatio
      *
      reveal
    );

    rect(
      0,
      0,
      source.w
      * visual.sizeMultiplier
      * materialScale
      * descriptor.scale,
      source.h
      * visual.sizeMultiplier
      * materialScale
      * descriptor.scale
    );

    pop();
  }
}


function getVisibleAccumulationLayerStates(
  source,
  sourceType,
  shadowDepth
) {

  let descriptors =
    sourceType === "human"
      ? source.humanAccumulationLayers
      : source.aiAccumulationLayers;

  let visibleLayers = [];

  for (
    let i = 0;
    i < descriptors.length;
    i++
  ) {

    let descriptor = descriptors[i];
    let reveal = getAccumulationLayerReveal(
      descriptor,
      shadowDepth
    );

    if (
      reveal > 0
    ) {

      visibleLayers.push({
        offsetX: descriptor.offsetX,
        offsetY: descriptor.offsetY,
        extrusion: descriptor.extrusion,
        rotation: descriptor.rotation,
        scale: descriptor.scale,
        alphaRatio: descriptor.alphaRatio,
        reveal
      });
    }
  }

  return visibleLayers;
}


function drawCapturedAccumulationLayers(
  contribution,
  decay
) {

  let accumulationLayers =
    contribution.accumulationLayers || [];

  for (
    let layerIndex = 0;
    layerIndex < accumulationLayers.length;
    layerIndex++
  ) {

    let layer = accumulationLayers[layerIndex];

    push();

    translate(
      layer.offsetX
      +
      layer.extrusion * THICKNESS_DIRECTION_X,
      layer.offsetY
      +
      layer.extrusion * THICKNESS_DIRECTION_Y
    );

    rotate(layer.rotation);

    let materialScale =
      MATERIAL_VISUAL_SCALE
      * getStableContributionSizeMultiplier(
          contribution.originSourceId
          ||
          contribution.sourceId
          ||
          "legacy-captured"
        );

    fill(
      LEGACY_NEUTRAL_COLOR[0],
      LEGACY_NEUTRAL_COLOR[1],
      LEGACY_NEUTRAL_COLOR[2],
      contribution.alpha
      *
      LEGACY_VISUAL_ALPHA_SCALE
      *
      ACCUMULATION_LAYER_ALPHA_RATIO
      *
      layer.alphaRatio
      *
      layer.reveal
      *
      decay
    );

    rect(
      0,
      0,
      contribution.width
      * materialScale
      * layer.scale,
      contribution.height
      * materialScale
      * layer.scale
    );

    pop();
  }
}


function getAmbientVisualOffset(
  source,
  sourceType
) {

  let params =
    getParamsForSourceType(sourceType);

  let spread =
    map(
      params.instability,
      0,
      1,
      0,
      10
    );

  let offsetSeed =
    sourceType === "human"
      ? 4000
      : 2000;

  return {
    x: map(
      noise(source.t + offsetSeed),
      0,
      1,
      -spread,
      spread
    ),
    y: map(
      noise(source.t + offsetSeed + 1000),
      0,
      1,
      -spread,
      spread
    )
  };
}


function getCurrentAmbientDisplayPosition(
  source,
  sourceType
) {

  let ambientPosition =
    getAmbientPositionForSource(
      source,
      sourceType
    );

  let ambientOffset =
    getAmbientVisualOffset(
      source,
      sourceType
    );

  return {
    x:
      ambientPosition.x
      +
      (
        sourceType === "human"
          ? source.humanJitterX
          : source.aiJitterX
      )
      +
      ambientOffset.x,
    y:
      ambientPosition.y
      +
      (
        sourceType === "human"
          ? source.humanJitterY
          : source.aiJitterY
      )
      +
      ambientOffset.y
  };
}


function getLastVisibleAmbientPosition(
  source,
  sourceType
) {

  let lastPosition =
    sourceType === "human"
      ? source.humanLastVisiblePosition
      : source.aiLastVisiblePosition;

  return lastPosition === null
    ? getCurrentAmbientDisplayPosition(source, sourceType)
    : {
        x: lastPosition.x,
        y: lastPosition.y
      };
}


function getSourceDisplayPosition(
  source,
  sourceType
) {

  let gatheringState =
    sourceType === "human"
      ? source.humanGatheringState
      : source.aiGatheringState;

  if (
    viewerState === "STAYING"
    &&
    gatheringState !== null
    &&
    gatheringState.stopId === currentStopId
  ) {

    return {
      x: gatheringState.currentPosition.x,
      y: gatheringState.currentPosition.y,
      isGathering: true,
      isFrozen: false
    };
  }

  let frozenPosition =
    sourceType === "human"
      ? source.humanStayFrozenPosition
      : source.aiStayFrozenPosition;

  if (
    viewerState === "STAYING"
    &&
    frozenPosition !== null
  ) {

    return {
      x: frozenPosition.x,
      y: frozenPosition.y,
      isGathering: false,
      isFrozen: true
    };
  }

  let ambientPosition =
    getCurrentAmbientDisplayPosition(
      source,
      sourceType
    );

  return {
    x: ambientPosition.x,
    y: ambientPosition.y,
    isGathering: false,
    isFrozen: false
  };
}


function getAmbientSourceAlpha(
  sourceType
) {

  return map(
    getParamsForSourceType(sourceType).intensity,
    0,
    1,
    8,
    60
  );
}


function getShadowVisualState(
  sourceType,
  shadowDepth
) {

  let depth =
    constrain(
      shadowDepth,
      0,
      1
    );

  let ambientColor =
    sourceType === "human"
      ? HUMAN_TEST_COLOR
      : AI_TEST_COLOR;

  let deepColor =
    sourceType === "human"
      ? HUMAN_SHADOW_DEEP_COLOR
      : AI_SHADOW_DEEP_COLOR;

  return {
    color: [
      lerp(ambientColor[0], deepColor[0], depth),
      lerp(ambientColor[1], deepColor[1], depth),
      lerp(ambientColor[2], deepColor[2], depth)
    ],
    alpha:
      getAmbientSourceAlpha(sourceType)
      *
      lerp(1, SHADOW_FINAL_ALPHA_MULTIPLIER, depth),
    sizeMultiplier:
      lerp(1, SHADOW_FINAL_SIZE_MULTIPLIER, depth),
    visualWeight:
      lerp(1, SHADOW_FINAL_VISUAL_WEIGHT, depth)
  };
}


function getEffectiveShadowDepth() {

  return shadowDeepeningProgress;
}


function getActiveSourceShadowDepth(
  source,
  sourceType
) {

  let state =
    sourceType === "human"
      ? source.humanGatheringState
      : source.aiGatheringState;

  if (
    viewerState !== "STAYING"
    ||
    state === null
    ||
    state.stopId !== currentStopId
    ||
    state.gatherProgress < 1
  ) {

    return 0;
  }

  return getEffectiveShadowDepth();
}


function isSourceInLeavingHandoff(
  source,
  sourceType
) {

  if (
    leavingHandoffStopId === null
    ||
    viewerState === "STAYING"
    ||
    currentStopSelection === null
    ||
    currentStopSelection.stopId !== leavingHandoffStopId
  ) {

    return false;
  }

  let selectedIds =
    sourceType === "human"
      ? currentStopSelection.humanSourceIds
      : currentStopSelection.aiSourceIds;

  let sourceId =
    sourceType === "human"
      ? source.humanSource.sourceId
      : source.aiSource.sourceId;

  return selectedIds.includes(sourceId);
}


function getAmbientGhostState(
  source,
  sourceType
) {

  return sourceType === "human"
    ? source.humanGhostState
    : source.aiGhostState;
}


function getAmbientAppearanceTransitionProgress(
  source,
  sourceType
) {

  let ghostState =
    getAmbientGhostState(
      source,
      sourceType
    );

  if (
    ghostState === null
  ) {

    return 1;
  }

  if (
    ghostState.appearanceTransitionStartTime === null
  ) {

    return 0;
  }

  return constrain(
    (
      millis()
      -
      ghostState.appearanceTransitionStartTime
    )
    /
    AMBIENT_APPEARANCE_TRANSITION_MS,
    0,
    1
  );
}


function setAmbientGhostState(
  source,
  sourceType,
  state
) {

  if (
    sourceType === "human"
  ) {

    source.humanGhostState = state;
  }

  else {

    source.aiGhostState = state;
  }
}


function isAmbientSourceSelectable(
  source,
  sourceType
) {

  let ghostState =
    getAmbientGhostState(
      source,
      sourceType
    );

  return (
    ghostState === null
    ||
    ghostState.recoveryProgress >= 1
  );
}


function getGhostRecoveryDelay(
  sourceId,
  stopId
) {

  return getStableUnit(
    sourceId + ":" + stopId + ":recovery"
  ) * AMBIENT_RECOVERY_DELAY_MAX_MS;
}


function createAmbientGhostState(
  source,
  sourceType,
  gatheringState
) {

  let identity =
    sourceType === "human"
      ? source.humanSource
      : source.aiSource;

  let initialMicroX =
    sin(
      millis() * 0.0008
      +
      gatheringState.ghostPhase
    )
    *
    GHOST_MICRO_MOTION_PX;

  let initialMicroY =
    cos(
      millis() * 0.0009
      +
      gatheringState.ghostPhase
    )
    *
    GHOST_MICRO_MOTION_PX;

  return {
    sourceId: identity.sourceId,
    sourceType,
    originSourceId: identity.sourceId,
    stopId: currentStopId,
    x: gatheringState.startPosition.x,
    y: gatheringState.startPosition.y,
    width: source.w,
    height: source.h,
    revealProgress: getGhostRevealProgress(gatheringState),
    recoveryStartTime: millis(),
    recoveryDelay: getGhostRecoveryDelay(
      identity.sourceId,
      currentStopId
    ),
    recoveryProgress: 0,
    appearanceTransitionStartTime: null,
    motionPhase: gatheringState.ghostPhase,
    directionAngle: atan2(
      gatheringState.target.y - gatheringState.startPosition.y,
      gatheringState.target.x - gatheringState.startPosition.x
    ),
    initialMotionOffsetX: initialMicroX,
    initialMotionOffsetY: initialMicroY
  };
}


function captureAmbientGhostStates() {

  if (
    currentStopSelection === null
  ) {

    return;
  }

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];

    if (
      source.humanGatheringState !== null
    ) {

      source.humanGhostState =
        createAmbientGhostState(
          source,
          "human",
          source.humanGatheringState
        );
    }

    if (
      source.aiGatheringState !== null
    ) {

      source.aiGhostState =
        createAmbientGhostState(
          source,
          "ai",
          source.aiGatheringState
        );
    }
  }
}


function updateAmbientGhostRecovery(
  source,
  sourceType,
  now
) {

  let ghostState =
    getAmbientGhostState(
      source,
      sourceType
    );

  if (
    ghostState === null
    ||
    viewerState === "STAYING"
  ) {

    return;
  }

  let elapsed =
    now - ghostState.recoveryStartTime;

  ghostState.recoveryProgress =
    constrain(
      (
        elapsed - ghostState.recoveryDelay
      )
      /
      AMBIENT_RECOVERY_DURATION_MS,
      0,
      1
    );
}


function getAmbientGhostMicroOffset(
  ghostState
) {

  let elapsed =
    max(
      0,
      millis() - ghostState.recoveryStartTime
    );

  let phase =
    ghostState.motionPhase;

  let currentX =
    sin(phase + elapsed * 0.0008)
    *
    GHOST_MICRO_MOTION_PX;

  let currentY =
    cos(phase + elapsed * 0.0009)
    *
    GHOST_MICRO_MOTION_PX;

  let motionRatio =
    1 - ghostState.recoveryProgress;

  return {
    x:
      lerp(
        ghostState.initialMotionOffsetX,
        currentX,
        ghostState.recoveryProgress
      ) * motionRatio,
    y:
      lerp(
        ghostState.initialMotionOffsetY,
        currentY,
        ghostState.recoveryProgress
      ) * motionRatio
  };
}


function drawRecoveringAmbientGhost(
  source,
  sourceType
) {

  let ghostState =
    getAmbientGhostState(
      source,
      sourceType
    );

  if (
    ghostState === null
  ) {

    return;
  }

  let recoveryProgress =
    ghostState.recoveryProgress;

  let revealProgress =
    lerp(
      ghostState.revealProgress,
      1,
      recoveryProgress
    );

  let normalAmbientPosition =
    getAmbientPositionForSource(
      source,
      sourceType
    );

  let normalOffset =
    getAmbientVisualOffset(
      source,
      sourceType
    );

  let renderX =
    lerp(
      ghostState.x,
      normalAmbientPosition.x + normalOffset.x,
      recoveryProgress
    );

  let renderY =
    lerp(
      ghostState.y,
      normalAmbientPosition.y + normalOffset.y,
      recoveryProgress
    );

  let microOffset =
    getAmbientGhostMicroOffset(
      ghostState
    );

  let ambientAlpha =
    getAmbientSourceAlpha(sourceType);

  let alpha =
    lerp(
      ambientAlpha * GHOST_MAX_VISUAL_RATIO,
      ambientAlpha,
      recoveryProgress
    );

  let appearanceProgress =
    getAmbientAppearanceTransitionProgress(
      source,
      sourceType
    );

  push();

  translate(
    renderX + microOffset.x,
    renderY + microOffset.y
  );

  drawContributionMaterial(
    sourceType,
    LEGACY_NEUTRAL_COLOR,
    0,
    0,
    source.w,
    source.h,
    alpha
    *
    LEGACY_VISUAL_ALPHA_SCALE
    *
    revealProgress
    *
    (1 - appearanceProgress),
    getSourceMaterialSeed(source, sourceType)
  );

  pop();
}


function finalizeAmbientGhostRecovery() {

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];

    if (
      source.humanGhostState !== null
      &&
      source.humanGhostState.recoveryProgress >= 1
    ) {

      if (
        source.humanGhostState.appearanceTransitionStartTime === null
      ) {

        source.humanGhostState.appearanceTransitionStartTime = millis();
      }

      if (
        millis()
        -
        source.humanGhostState.appearanceTransitionStartTime
        >=
        AMBIENT_APPEARANCE_TRANSITION_MS
      ) {

        source.humanGhostState = null;
      }
    }

    if (
      source.aiGhostState !== null
      &&
      source.aiGhostState.recoveryProgress >= 1
    ) {

      if (
        source.aiGhostState.appearanceTransitionStartTime === null
      ) {

        source.aiGhostState.appearanceTransitionStartTime = millis();
      }

      if (
        millis()
        -
        source.aiGhostState.appearanceTransitionStartTime
        >=
        AMBIENT_APPEARANCE_TRANSITION_MS
      ) {

        source.aiGhostState = null;
      }
    }
  }
}


function captureLeavingVisualState() {

  if (
    currentStopSelection === null
  ) {

    return;
  }

  let contributions = [];

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];

    let sourceEntries = [
      {
        sourceType: "human",
        identity: source.humanSource,
        state: source.humanGatheringState,
        color: HUMAN_TEST_COLOR
      },
      {
        sourceType: "ai",
        identity: source.aiSource,
        state: source.aiGatheringState,
        color: AI_TEST_COLOR
      }
    ];

    for (
      let entryIndex = 0;
      entryIndex < sourceEntries.length;
      entryIndex++
    ) {

      let entry = sourceEntries[entryIndex];

      if (
        entry.state === null
        ||
        entry.state.stopId !== currentStopId
      ) {

        continue;
      }

      let capturedDepth =
        entry.state.gatherProgress >= 1
          ? getEffectiveShadowDepth()
          : 0;

      let capturedVisual =
        getShadowVisualState(
          entry.sourceType,
          capturedDepth
        );

      contributions.push({
        sourceId: entry.identity.sourceId,
        sourceType: entry.sourceType,
        originSourceId: entry.identity.sourceId,
        x: entry.state.currentPosition.x,
        y: entry.state.currentPosition.y,
        width: source.w * capturedVisual.sizeMultiplier,
        height: source.h * capturedVisual.sizeMultiplier,
        rotation: 0,
        alpha: capturedVisual.alpha,
        visualWeight: capturedVisual.visualWeight,
        color: [
          capturedVisual.color[0],
          capturedVisual.color[1],
          capturedVisual.color[2]
        ],
        motionPhase: source.t,
        motionOffset: { x: 0, y: 0 },
        accumulationLayers:
          getVisibleAccumulationLayerStates(
            source,
            entry.sourceType,
            capturedDepth
          )
      });
    }
  }

  for (
    let i = 0;
    i < fragments.length;
    i++
  ) {

    let fragment = fragments[i];

    if (
      !fragment.shadowMember
      ||
      fragment.stopId !== currentStopId
      ||
      (
        fragment.sourceType !== "human"
        &&
        fragment.sourceType !== "ai"
      )
    ) {

      continue;
    }

    let capturedDepth =
      getEffectiveShadowDepth();

    let capturedVisual =
      getShadowVisualState(
        fragment.sourceType,
        capturedDepth
      );

    contributions.push({
      sourceId: fragment.originSourceId,
      sourceType: fragment.sourceType,
      originSourceId: fragment.originSourceId,
      fragmentRef: fragment,
      x: fragment.x,
      y: fragment.y,
      width: fragment.w * capturedVisual.sizeMultiplier,
      height: fragment.h * capturedVisual.sizeMultiplier,
      rotation: 0,
      alpha: capturedVisual.alpha,
      visualWeight: capturedVisual.visualWeight,
      color: [
        capturedVisual.color[0],
        capturedVisual.color[1],
        capturedVisual.color[2]
      ],
      motionPhase: fragment.carryT,
      motionOffset: { x: 0, y: 0 },
      accumulationLayers:
        getVisibleAccumulationLayerStates(
          fragment,
          fragment.sourceType,
          capturedDepth
        )
    });
  }

  leavingVisualStates.push({
    stopId: currentStopId,
    capturedAt: millis(),
    age: 0,
    contributions
  });

  leavingHandoffStopId = currentStopId;

  if (
    currentImprint !== null
  ) {

    currentImprint.suppressLegacyVisualDuringHandoff = true;
  }

  for (
    let i = 0;
    i < fragments.length;
    i++
  ) {

    if (
      fragments[i].stopId === currentStopId
    ) {

      fragments[i].suppressLegacyVisualDuringHandoff = true;
    }
  }

  if (
    DEBUG_LEAVING_HANDOFF
  ) {

    console.log(
      "LEAVE HANDOFF",
      "Captured contributions:",
      contributions.length,
      "Human count:",
      contributions.filter(
        (contribution) => contribution.sourceType === "human"
      ).length,
      "AI count:",
      contributions.filter(
        (contribution) => contribution.sourceType === "ai"
      ).length,
      "Residual mapped:",
      contributions.length,
      "Carry mapped:",
      0
    );
  }
}


function drawLeavingVisualStates() {

  for (
    let stateIndex = leavingVisualStates.length - 1;
    stateIndex >= 0;
    stateIndex--
  ) {

    let state = leavingVisualStates[stateIndex];
    let decay = exp(-state.age / IMPRINT_DECAY_TIME);

    for (
      let i = 0;
      i < state.contributions.length;
      i++
    ) {

      let contribution = state.contributions[i];

      if (
        contribution.replacedByCarry
      ) {

        continue;
      }

      let motionOffsetX =
        (
          sin(
            contribution.motionPhase
            +
            state.age * 0.04
          )
          -
          sin(contribution.motionPhase)
        )
        *
        LEAVING_HANDOFF_MICRO_MOTION_PX;

      let motionOffsetY =
        (
          cos(
            contribution.motionPhase * 1.13
            +
            state.age * 0.043
          )
          -
          cos(contribution.motionPhase * 1.13)
        )
        *
        LEAVING_HANDOFF_MICRO_MOTION_PX;

      push();

      translate(
        contribution.x + motionOffsetX,
        contribution.y + motionOffsetY
      );

      rotate(contribution.rotation);

      drawCapturedAccumulationLayers(
        contribution,
        decay
      );

      fill(
        LEGACY_NEUTRAL_COLOR[0],
        LEGACY_NEUTRAL_COLOR[1],
        LEGACY_NEUTRAL_COLOR[2],
        contribution.alpha
        *
        LEGACY_VISUAL_ALPHA_SCALE
        *
        decay
      );

      rect(
        0,
        0,
        contribution.width
        * MATERIAL_VISUAL_SCALE
        * getStableContributionSizeMultiplier(
            contribution.originSourceId
            ||
            contribution.sourceId
            ||
            "legacy-captured"
          ),
        contribution.height
        * MATERIAL_VISUAL_SCALE
        * getStableContributionSizeMultiplier(
            contribution.originSourceId
            ||
            contribution.sourceId
            ||
            "legacy-captured"
          )
      );

      pop();
    }

    state.age++;
  }
}


function getGhostRevealProgress(
  state
) {

  let totalDisplacement =
    dist(
      state.startPosition.x,
      state.startPosition.y,
      state.target.x,
      state.target.y
    );

  if (
    totalDisplacement <= 0.001
  ) {

    return 1;
  }

  return constrain(
    dist(
      state.startPosition.x,
      state.startPosition.y,
      state.currentPosition.x,
      state.currentPosition.y
    )
    /
    totalDisplacement,
    0,
    1
  );
}


function drawAmbientGhost(
  source,
  sourceType
) {

  if (
    viewerState !== "STAYING"
  ) {

    return;
  }

  let state =
    sourceType === "human"
      ? source.humanGatheringState
      : source.aiGatheringState;

  if (
    state === null
    ||
    state.stopId !== currentStopId
  ) {

    return;
  }

  let revealProgress =
    getGhostRevealProgress(state);

  if (
    revealProgress <= 0.01
  ) {

    return;
  }

  let dx =
    state.target.x - state.startPosition.x;

  let dy =
    state.target.y - state.startPosition.y;

  let displacement =
    sqrt(dx * dx + dy * dy);

  if (
    displacement <= 0.001
  ) {

    return;
  }

  let ghostPhase =
    state.ghostPhase;

  let microX =
    sin(millis() * 0.0008 + ghostPhase)
    *
    GHOST_MICRO_MOTION_PX;

  let microY =
    cos(millis() * 0.0009 + ghostPhase)
    *
    GHOST_MICRO_MOTION_PX;

  let params =
    getParamsForSourceType(sourceType);

  let ambientAlpha =
    map(
      params.intensity,
      0,
      1,
      8,
      60
    );

  let ghostAlpha =
    ambientAlpha
    *
    GHOST_MAX_VISUAL_RATIO;

  push();

  translate(
    state.currentPosition.x + microX,
    state.currentPosition.y + microY
  );

  if (sourceType === "ai") {

    drawAIAmbientMaterial(
      "ai",
      AI_TEST_COLOR,
      0,
      0,
      source.w,
      source.h,
      ghostAlpha
      *
      revealProgress,
      getSourceMaterialSeed(source, sourceType)
    );
  } else {

    drawHumanAmbientMaterial(
      "human",
      HUMAN_TEST_COLOR,
      0,
      0,
      source.w,
      source.h,
      ghostAlpha
      *
      revealProgress,
      getSourceMaterialSeed(source, sourceType)
    );
  }

  pop();
}


function getGatheringTarget(
  sourceId,
  stopId
) {

  let angle =
    getStableUnit(
      sourceId + ":" + stopId + ":angle"
    )
    *
    TWO_PI;

  let radius =
    sqrt(
      getStableUnit(
        sourceId + ":" + stopId + ":radius"
      )
    );

  return {
    x:
      stopX
      +
      cos(angle)
      *
      radius
      *
      GATHER_TARGET_RX,
    y:
      stopY
      +
      sin(angle)
      *
      radius
      *
      GATHER_TARGET_RY
  };
}


function getGatherDelay(
  sourceId,
  stopId
) {

  return getStableUnit(
    sourceId + ":" + stopId + ":delay"
  ) * GATHER_DELAY_MAX_MS;
}


function initializeGatheringState(
  source,
  sourceType,
  startTime
) {

  let identity =
    sourceType === "human"
      ? source.humanSource
      : source.aiSource;

  let startPosition =
    getLastVisibleAmbientPosition(
      source,
      sourceType
    );

  let target =
    getGatheringTarget(
      identity.sourceId,
      currentStopId
    );

  let ambientPosition =
    getAmbientPositionForSource(
      source,
      sourceType
    );

  return {
    stopId: currentStopId,
    startTime,
    startPosition,
    startBasePosition: {
      x: ambientPosition.x,
      y: ambientPosition.y
    },
    target,
    gatherDelay: getGatherDelay(identity.sourceId, currentStopId),
    ghostPhase: getStableUnit(identity.sourceId + ":ghost") * TWO_PI,
    gatherProgress: 0,
    currentPosition: { x: startPosition.x, y: startPosition.y }
  };
}


function initializeGatheringForStop(
  startTime
) {

  let humanSelection =
    new Set(
      currentStopSelection.humanSourceIds
    );

  let aiSelection =
    new Set(
      currentStopSelection.aiSourceIds
    );

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];

    let currentHumanPosition =
      getLastVisibleAmbientPosition(
        source,
        "human"
      );

    let currentAIPosition =
      getLastVisibleAmbientPosition(
        source,
        "ai"
      );

    source.humanGatheringState =
      humanSelection.has(
        source.humanSource.sourceId
      )
        ? initializeGatheringState(
            source,
            "human",
            startTime
          )
        : null;

    source.humanStayFrozenPosition =
      source.humanGatheringState === null
        ? currentHumanPosition
        : null;

    source.aiGatheringState =
      aiSelection.has(
        source.aiSource.sourceId
      )
        ? initializeGatheringState(
            source,
            "ai",
            startTime
          )
        : null;

    source.aiStayFrozenPosition =
      source.aiGatheringState === null
        ? currentAIPosition
        : null;
  }
}


function updateGatheringState(
  state,
  source,
  sourceType,
  now
) {

  let elapsed =
    now - state.startTime;

  let progress =
    constrain(
      (
        elapsed - state.gatherDelay
      )
      /
      (
        GATHERING_DURATION_MS
        -
        state.gatherDelay
      ),
      0,
      1
    );

  let smoothProgress =
    progress * progress * (3 - 2 * progress);

  state.gatherProgress = progress;

  let ambientPosition =
    getAmbientPositionForSource(
      source,
      sourceType
    );

  let currentWavePosition =
    getCurrentAmbientDisplayPosition(
      source,
      sourceType
    );

  let waveRatio =
    lerp(
      GATHER_START_WAVE_RATIO,
      GATHER_END_MICRO_MOTION_RATIO,
      progress
    );

  state.currentPosition = {
    x:
      lerp(
        state.startBasePosition.x,
        state.target.x,
        smoothProgress
      )
      +
      (
        currentWavePosition.x
        -
        ambientPosition.x
      )
      *
      waveRatio,
    y:
      lerp(
        state.startBasePosition.y,
        state.target.y,
        smoothProgress
      )
      +
      (
        currentWavePosition.y
        -
        ambientPosition.y
      )
      *
      waveRatio
  };
}


function updateShadowDeepening(
  now
) {

  if (
    viewerState !== "STAYING"
    ||
    currentStopSelection === null
  ) {

    return;
  }

  shadowDeepeningProgress =
    constrain(
      (
        now - currentStopDeepeningStartTime
      )
      /
      SHADOW_DEEPEN_DURATION_MS,
      0,
      1
    );
}


function getOrganicBoundaryRadius(
  baseRadius,
  angle,
  stopId,
  sourceType
) {

  let seed =
    getStableBoundaryUnit(
      stopId,
      sourceType
    );

  let phase =
    seed * TWO_PI;

  // Low-frequency harmonics keep the boundary continuous and organic.
  // The same function is used for both source types; only the stable seed differs.
  let wobble =
    sin(angle * 2 + phase) * 0.50
    +
    sin(angle * 3 + phase * 1.7) * 0.30
    +
    cos(angle * 5 + phase * 0.6) * 0.20;

  return baseRadius *
    (
      1
      + DISTANCE_BOUNDARY_WOBBLE * wobble
    );
}


function getDistanceInteractionFalloff(
  position,
  sourceType
) {

  let distanceValue =
    getParamsForSourceType(sourceType).distance;

  let baseRadius =
    mapDistanceToRadius(distanceValue);

  let angle =
    atan2(
      position.y - viewerInputY,
      position.x - viewerInputX
    );

  let effectiveRadius =
    getOrganicBoundaryRadius(
      baseRadius,
      angle,
      currentStopId,
      sourceType
    );

  let normalizedDistance =
    dist(
      position.x,
      position.y,
      viewerInputX,
      viewerInputY
    )
    /
    effectiveRadius;

  if (
    normalizedDistance >= 1
  ) {

    return 0;
  }

  let t =
    constrain(
      normalizedDistance,
      0,
      1
    );

  let smoothFalloff =
    t * t * (3 - 2 * t);

  return 1 - smoothFalloff;
}


function buildCurrentStopSelection() {

  let humanDistance =
    getParamsForSourceType("human").distance;

  let aiDistance =
    getParamsForSourceType("ai").distance;

  let humanRadius =
    mapDistanceToRadius(humanDistance);

  let aiRadius =
    mapDistanceToRadius(aiDistance);

  let humanSourceIds = [];
  let aiSourceIds = [];

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];

    let humanPosition =
      getAmbientPositionForSource(
        source,
        "human"
      );

    let aiPosition =
      getAmbientPositionForSource(
        source,
        "ai"
      );

    let humanAngle =
      atan2(
        humanPosition.y - stopY,
        humanPosition.x - stopX
      );

    let aiAngle =
      atan2(
        aiPosition.y - stopY,
        aiPosition.x - stopX
      );

    if (
      isAmbientSourceSelectable(
        source,
        "human"
      )
      &&
      dist(
        humanPosition.x,
        humanPosition.y,
        stopX,
        stopY
      )
      <=
      getOrganicBoundaryRadius(
        humanRadius,
        humanAngle,
        currentStopId,
        "human"
      )
    ) {

      humanSourceIds.push(
        source.humanSource.sourceId
      );
    }

    if (
      isAmbientSourceSelectable(
        source,
        "ai"
      )
      &&
      dist(
        aiPosition.x,
        aiPosition.y,
        stopX,
        stopY
      )
      <=
      getOrganicBoundaryRadius(
        aiRadius,
        aiAngle,
        currentStopId,
        "ai"
      )
    ) {

      aiSourceIds.push(
        source.aiSource.sourceId
      );
    }
  }

  currentStopSelection = {
    stopId: currentStopId,
    center: { x: stopX, y: stopY },
    humanRadius,
    aiRadius,
    humanSourceIds,
    aiSourceIds
  };

  console.log(
    "DISTANCE SELECTION",
    "stop =",
    currentStopId,
    "Human selected =",
    humanSourceIds.length,
    "AI selected =",
    aiSourceIds.length,
    "Human base radius =",
    round(humanRadius),
    "AI base radius =",
    round(aiRadius)
  );
}


function drawDistanceDebug() {

  if (
    !DEBUG_DISTANCE_BOUNDARY
    ||
    currentStopSelection === null
    ||
    viewerState !== "STAYING"
  ) {

    return;
  }

  let selection = currentStopSelection;

  push();

  noFill();
  strokeWeight(1);

  for (
    let boundaryIndex = 0;
    boundaryIndex < 2;
    boundaryIndex++
  ) {

    let sourceType =
      boundaryIndex === 0
        ? "human"
        : "ai";

    let baseRadius =
      sourceType === "human"
        ? selection.humanRadius
        : selection.aiRadius;

    stroke(
      sourceType === "human"
        ? 255
        : 0,
      sourceType === "human"
        ? 0
        : 110,
      sourceType === "human"
        ? 70
        : 255,
      90
    );

    beginShape();

    for (
      let angle = 0;
      angle < TWO_PI;
      angle += 0.08
    ) {

      let radius =
        getOrganicBoundaryRadius(
          baseRadius,
          angle,
          selection.stopId,
          sourceType
        );

      vertex(
        selection.center.x + cos(angle) * radius,
        selection.center.y + sin(angle) * radius
      );
    }

    endShape(CLOSE);
  }

  stroke(80, 80, 80, 140);
  line(
    selection.center.x - 5,
    selection.center.y,
    selection.center.x + 5,
    selection.center.y
  );
  line(
    selection.center.x,
    selection.center.y - 5,
    selection.center.x,
    selection.center.y + 5
  );

  if (
    DEBUG_SELECTED_MARKER
  ) {

    for (
      let i = 0;
      i < sources.length;
      i++
    ) {

      let source = sources[i];
      let humanPosition = getAmbientPositionForSource(source, "human");
      let aiPosition = getAmbientPositionForSource(source, "ai");

      if (
        selection.humanSourceIds.includes(source.humanSource.sourceId)
      ) {
        stroke(255, 0, 70, 160);
        point(humanPosition.x, humanPosition.y);
      }

      if (
        selection.aiSourceIds.includes(source.aiSource.sourceId)
      ) {
        stroke(0, 110, 255, 160);
        point(aiPosition.x, aiPosition.y);
      }
    }
  }

  pop();
}


function getMovingAmbientJitter(
  position,
  timeValue,
  sourceType,
  allowStayingWave = false
) {

  if (
    leaveCaptureFrames !== 0
    ||
    (
      viewerState !== "MOVING"
      &&
      !allowStayingWave
      &&
      leavePulse <= 0
    )
  ) {

    return { x: 0, y: 0 };
  }

  let falloff;

  if (
    leavePulse > 0
    &&
    !allowStayingWave
  ) {

    falloff =
      constrain(
        1
        -
        viewerFieldDistance(
          position.x,
          position.y,
          MOVEMENT_FIELD_SCALE
        ),
        0,
        1
      );
  }

  else {

    falloff =
      getDistanceInteractionFalloff(
        position,
        sourceType
      );
  }

  if (
    falloff <= 0
  ) {

    return { x: 0, y: 0 };
  }

  let speedStrength =
    constrain(
      viewerInputSpeed / 12,
      0,
      1
    );

  let strength;

  if (
    leavePulse > 0
    &&
    !allowStayingWave
  ) {

    // Preserve the existing leave-pulse response in this node.
    strength =
      2
      +
      falloff * 3
      +
      speedStrength * 2;
  }

  else {

    strength =
      (
        2
        +
        falloff * 3
        +
        speedStrength * 2
      )
      *
      falloff;
  }

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

  return {
    x:
      map(
        noise(timeValue),
        0,
        1,
        -strength,
        strength
      )
      +
      viewerInputDX * 0.04,

    y:
      map(
        noise(timeValue + 1000),
        0,
        1,
        -strength,
        strength
      )
      +
      viewerInputDY * 0.04
  };
}


function validateSourceIdentities() {

  let identities = [];


  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    identities.push(
      sources[i].humanSource,
      sources[i].aiSource
    );
  }


  let humanCount =
    identities.filter(
      (source) => source.sourceType === "human"
    ).length;

  let aiCount =
    identities.filter(
      (source) => source.sourceType === "ai"
    ).length;

  let uniqueSourceIds =
    new Set(
      identities.map(
        (source) => source.sourceId
      )
    ).size;

  let validSourceTypes =
    identities.every(
      (source) =>
        source.sourceType === "human"
        ||
        source.sourceType === "ai"
    );

  if (
    !validSourceTypes
    ||
    uniqueSourceIds !== identities.length
  ) {

    console.error(
      "SOURCE IDENTITY VALIDATION FAILED"
    );
  }


  console.log(
    "Human logical sources:",
    humanCount
  );

  console.log(
    "AI logical sources:",
    aiCount
  );

  console.log(
    "Total logical ambient sources:",
    identities.length
  );

  console.log(
    "Unique source IDs:",
    uniqueSourceIds
  );
}


// ==================================================
// SOURCE PASSES
// ==================================================

// Purple / mixed appearance is produced by overlapping these independent
// AI-blue and Human-red passes, never by a fixed third source color.
function getMaterialSeed(
  sourceGeometry,
  sourceType,
  x,
  y,
  w,
  h
) {

  if (
    sourceGeometry !== null
  ) {

    if (
      sourceType === "human"
      &&
      sourceGeometry.humanSource
      &&
      sourceGeometry.humanSource.sourceId
    ) {

      return sourceGeometry.humanSource.sourceId;
    }

    if (
      sourceType === "ai"
      &&
      sourceGeometry.aiSource
      &&
      sourceGeometry.aiSource.sourceId
    ) {

      return sourceGeometry.aiSource.sourceId;
    }

    if (
      sourceGeometry.originSourceId
    ) {

      return sourceGeometry.originSourceId;
    }

    if (
      sourceGeometry.sourceId
    ) {

      return sourceGeometry.sourceId;
    }
  }

  return sourceType
    + ":material:"
    + round(x)
    + ":"
    + round(y)
    + ":"
    + round(w)
    + ":"
    + round(h);
}


function getStableContributionSizeTier(
  materialSeed
) {

  let value =
    getStableUnit(materialSeed + ":size-tier");

  if (value < 0.12) {
    return 0;
  }

  if (value < 0.64) {
    return 1;
  }

  if (value < 0.88) {
    return 2;
  }

  if (value < 0.98) {
    return 3;
  }

  return 4;
}


function getStableContributionSizeMultiplier(
  materialSeed
) {

  return MATERIAL_SIZE_TIER_MULTIPLIERS[
    getStableContributionSizeTier(materialSeed)
  ];
}


function getSourceMaterialSeed(
  source,
  sourceType
) {

  if (
    sourceType === "human"
    &&
    source.humanSource
    &&
    source.humanSource.sourceId
  ) {

    return source.humanSource.sourceId;
  }

  if (
    sourceType === "ai"
    &&
    source.aiSource
    &&
    source.aiSource.sourceId
  ) {

    return source.aiSource.sourceId;
  }

  return source.originSourceId
    || source.sourceId
    || sourceType + ":legacy-material";
}


function getMaterialVisualScaleForSource(
  source,
  sourceType
) {

  return MATERIAL_VISUAL_SCALE
    * getStableContributionSizeMultiplier(
        getSourceMaterialSeed(source, sourceType)
      );
}


function getMaterialColor(
  color,
  amount,
  sourceType
) {

  let fadedTarget =
    sourceType === "human"
      ? [255, 145, 165]
      : [125, 190, 255];

  return [
    lerp(color[0], fadedTarget[0], amount),
    lerp(color[1], fadedTarget[1], amount),
    lerp(color[2], fadedTarget[2], amount)
  ];
}


function drawContributionMaterial(
  sourceType,
  color,
  x,
  y,
  w,
  h,
  alpha,
  materialSeed
) {

  let scale =
    MATERIAL_VISUAL_SCALE
    * getStableContributionSizeMultiplier(materialSeed);

  let materialW = w * scale;
  let materialH = h * scale;
  let left = x - materialW * 0.5;
  let top = y - materialH * 0.5;

  fill(color[0], color[1], color[2], alpha);

  if (sourceType === "human") {

    let edge = getStableUnit(materialSeed + ":edge");
    let topVariation = getStableUnit(materialSeed + ":top");

    beginShape();
    vertex(left, top + materialH * (0.08 + edge * 0.08));
    vertex(left + materialW * (0.72 + topVariation * 0.10), top);
    vertex(left + materialW, top + materialH * (0.12 + topVariation * 0.08));
    vertex(left + materialW * (0.92 - edge * 0.10), top + materialH);
    vertex(left + materialW * (0.18 + topVariation * 0.08), top + materialH * (0.90 - edge * 0.08));
    endShape(CLOSE);

    let surface = getStableUnit(materialSeed + ":surface");
    let washed = getMaterialColor(color, 0.52, sourceType);

    fill(washed[0], washed[1], washed[2], alpha * 0.34);
    beginShape();
    vertex(left + materialW * (0.12 + surface * 0.08), top + materialH * 0.14);
    vertex(left + materialW * 0.78, top + materialH * 0.08);
    vertex(left + materialW * 0.88, top + materialH * 0.54);
    vertex(left + materialW * 0.34, top + materialH * 0.66);
    endShape(CLOSE);

    let film = getMaterialColor(color, 0.08, sourceType);
    fill(film[0], film[1], film[2], alpha * 0.28);
    rect(round(left + materialW * 0.05 + materialW * 0.09 * 0.5), round(top + materialH * 0.08 + materialH * 0.84 * 0.5), round(max(1, materialW * 0.09)), round(max(1, materialH * 0.84)));

    let exposure = getStableUnit(materialSeed + ":exposure");
    let faded = getMaterialColor(color, 0.26, sourceType);
    fill(faded[0], faded[1], faded[2], alpha * HUMAN_MATERIAL_DETAIL_ALPHA);
    let exposureW = max(1, materialW * (0.34 + exposure * 0.18));
    let exposureH = max(1, materialH * 0.28);
    rect(round(left + materialW * (0.10 + exposure * 0.12) + exposureW * 0.5), round(top + materialH * 0.12 + exposureH * 0.5), round(exposureW), round(exposureH));

    let shadow = getMaterialColor(color, 0.18, sourceType);
    fill(shadow[0], shadow[1], shadow[2], alpha * 0.12);
    let shadowW = max(1, materialW * 0.76);
    let shadowH = max(1, materialH * 0.10);
    rect(round(left + materialW * 0.08 + shadowW * 0.5), round(top + materialH * 0.72 + shadowH * 0.5), round(shadowW), round(shadowH));

    return;
  }

  rect(x, y, round(materialW), round(materialH));

  let subdivision = getStableUnit(materialSeed + ":subdivision");
  let scan = getMaterialColor(color, 0.44, sourceType);
  fill(scan[0], scan[1], scan[2], alpha * AI_MATERIAL_DETAIL_ALPHA);

  let scanOneW = max(1, materialW * 0.18);
  let scanOneH = max(1, materialH * 0.80);
  rect(round(left + materialW * (0.16 + subdivision * 0.10) + scanOneW * 0.5), round(top + materialH * 0.10 + scanOneH * 0.5), round(scanOneW), round(scanOneH));
  let scanTwoW = max(1, materialW * 0.24);
  let scanTwoH = max(1, materialH * 0.28);
  rect(round(left + materialW * (0.54 + subdivision * 0.10) + scanTwoW * 0.5), round(top + materialH * 0.12 + scanTwoH * 0.5), round(scanTwoW), round(scanTwoH));
  let scanThreeW = max(1, materialW * 0.26);
  let scanThreeH = max(1, materialH * 0.24);
  rect(round(left + materialW * (0.54 - subdivision * 0.08) + scanThreeW * 0.5), round(top + materialH * 0.56 + scanThreeH * 0.5), round(scanThreeW), round(scanThreeH));

  fill(color[0], color[1], color[2], alpha * 0.26);
  let scanBarOneW = max(1, materialW * 0.84);
  let scanBarOneH = max(1, materialH * 0.09);
  rect(round(left + materialW * 0.08 + scanBarOneW * 0.5), round(top + materialH * 0.36 + scanBarOneH * 0.5), round(scanBarOneW), round(scanBarOneH));
  let scanBarTwoW = max(1, materialW * 0.84);
  let scanBarTwoH = max(1, materialH * 0.07);
  rect(round(left + materialW * 0.08 + scanBarTwoW * 0.5), round(top + materialH * 0.70 + scanBarTwoH * 0.5), round(scanBarTwoW), round(scanBarTwoH));
}


function buildAmbientImageCache(imageAsset) {

  if (
    imageAsset === null
  ) {

    return null;
  }

  try {

    let imageAspect =
      imageAsset.width
      /
      imageAsset.height;
    let cache = [];

    for (
      let cacheWidth = AI_IMAGE_CACHE_MIN_WIDTH;
      cacheWidth <= AI_IMAGE_CACHE_MAX_WIDTH;
      cacheWidth += AI_IMAGE_CACHE_STEP
    ) {

      let cacheHeight = max(
        1,
        round(cacheWidth / imageAspect)
      );
      let cachedImage = createGraphics(
        cacheWidth,
        cacheHeight
      );

      cachedImage.pixelDensity(1);
      cachedImage.noSmooth();
      cachedImage.imageMode(CENTER);
      cachedImage.image(
        imageAsset,
        cacheWidth * 0.5,
        cacheHeight * 0.5,
        cacheWidth,
        cacheHeight
      );

      cache.push({
        width: cacheWidth,
        graphic: cachedImage
      });
    }

    return {
      aspect: imageAspect,
      cache
    };
  }

  catch (error) {

    console.warn(
      "Ambient image cache failed; using original material",
      error
    );
    return null;
  }
}


function createMediaProfile(
  imageAsset,
  label
) {

  let safeProfile = {
    averageBrightness: 50,
    visualWeight: 1.00
  };

  if (
    imageAsset === null
    ||
    imageAsset.width <= 0
    ||
    imageAsset.height <= 0
  ) {

    return safeProfile;
  }

  try {

    // Media-as-Data: analyze the image once after it has loaded.
    imageAsset.loadPixels();

    if (
      !imageAsset.pixels
      ||
      imageAsset.pixels.length === 0
    ) {

      return safeProfile;
    }

    let logicalPixelCount =
      imageAsset.width
      * imageAsset.height
      * 4;

    let pixelDensityScale = max(
      1,
      round(
        sqrt(
          imageAsset.pixels.length
          /
          logicalPixelCount
        )
      )
    );

    let pixelWidth =
      imageAsset.width
      * pixelDensityScale;

    let pixelHeight =
      imageAsset.height
      * pixelDensityScale;

    let brightnessTotal = 0;
    let validSampleCount = 0;

    for (
      let sampleY = 0;
      sampleY < MEDIA_PROFILE_SAMPLE_ROWS;
      sampleY++
    ) {

      let pixelY = min(
        pixelHeight - 1,
        floor(
          (sampleY + 0.5)
          * pixelHeight
          / MEDIA_PROFILE_SAMPLE_ROWS
        )
      );

      for (
        let sampleX = 0;
        sampleX < MEDIA_PROFILE_SAMPLE_COLUMNS;
        sampleX++
      ) {

        let pixelX = min(
          pixelWidth - 1,
          floor(
            (sampleX + 0.5)
            * pixelWidth
            / MEDIA_PROFILE_SAMPLE_COLUMNS
          )
        );

        let pixelIndex =
          (pixelY * pixelWidth + pixelX)
          * 4;

        // pixels[] stores RGBA values in four consecutive entries.
        let red = imageAsset.pixels[pixelIndex];
        let green = imageAsset.pixels[pixelIndex + 1];
        let blue = imageAsset.pixels[pixelIndex + 2];
        let alpha = imageAsset.pixels[pixelIndex + 3];

        if (
          alpha === undefined
          ||
          alpha < 8
        ) {

          continue;
        }

        let sampledColor = color(
          red,
          green,
          blue,
          alpha
        );

        brightnessTotal += brightness(sampledColor);
        validSampleCount++;
      }
    }

    if (
      validSampleCount === 0
    ) {

      return safeProfile;
    }

    let averageBrightness =
      brightnessTotal
      /
      validSampleCount;

    let visualWeight = constrain(
      map(
        averageBrightness,
        0,
        100,
        MEDIA_PROFILE_WEIGHT_MIN,
        MEDIA_PROFILE_WEIGHT_MAX
      ),
      MEDIA_PROFILE_WEIGHT_MIN,
      MEDIA_PROFILE_WEIGHT_MAX
    );

    let profile = {
      averageBrightness,
      visualWeight
    };

    console.log(
      label + " Media Profile:",
      "averageBrightness =", averageBrightness.toFixed(2),
      "visualWeight =", visualWeight.toFixed(3)
    );

    return profile;
  }

  catch (error) {

    console.warn(
      label + " Media Profile failed; using safe default",
      error
    );

    return safeProfile;
  }
}


function getMediaProfileForSourceType(
  sourceType
) {

  return sourceType === "human"
    ? humanMediaProfile
    : aiMediaProfile;
}


function drawAmbientImageMaterial(
  sourceType,
  color,
  x,
  y,
  w,
  h,
  alpha,
  materialSeed,
  imageAsset,
  imageCache,
  imageAspect,
  visualScale
) {

  if (
    (sourceType !== "ai" && sourceType !== "human")
    ||
    imageAsset === null
    ||
    imageCache === null
    ||
    (sourceType === "ai" && (!USE_AI_IMAGE_TRACE || aiAmbientImageFailed))
    ||
    (sourceType === "human" && (!USE_HUMAN_IMAGE_TRACE || humanAmbientImageFailed))
  ) {

    drawContributionMaterial(
      sourceType,
      color,
      x,
      y,
      w,
      h,
      alpha,
      materialSeed
    );

    return;
  }

  let materialScale =
    MATERIAL_VISUAL_SCALE
    * getStableContributionSizeMultiplier(materialSeed)
    * visualScale;

  let targetW =
    w
    * materialScale;
  let targetH =
    h
    * materialScale;
  let targetAspect = targetW / targetH;
  let imageW = targetW;
  let imageH = targetH;

  if (imageAspect > targetAspect) {
    imageH = targetW / imageAspect;
  } else {
    imageW = targetH * imageAspect;
  }

  let cacheWidth = constrain(
      round(imageW / AI_IMAGE_CACHE_STEP)
      * AI_IMAGE_CACHE_STEP,
      AI_IMAGE_CACHE_MIN_WIDTH,
      AI_IMAGE_CACHE_MAX_WIDTH
    );
  let cacheIndex =
    round(
      (cacheWidth - AI_IMAGE_CACHE_MIN_WIDTH)
      /
      AI_IMAGE_CACHE_STEP
    );

  let imageSource = imageCache[cacheIndex].graphic;

  let imageCanvas = imageSource.canvas;

  if (
    imageCanvas === undefined
    ||
    imageCanvas === null
  ) {

    drawContributionMaterial(
      sourceType,
      color,
      x,
      y,
      w,
      h,
      alpha,
      materialSeed
    );

    return;
  }

  let imageAlpha = constrain(
    255
    *
    lerp(
      MEDIA_IMAGE_ALPHA_MIN,
      MEDIA_IMAGE_ALPHA_MAX,
      constrain(
        alpha / MEDIA_IMAGE_ALPHA_REFERENCE,
        0,
        1
      )
    )
    * getMediaProfileForSourceType(sourceType).visualWeight,
    0,
    255
  );

  drawingContext.save();
  drawingContext.globalAlpha = imageAlpha / 255;
  drawingContext.drawImage(
    imageCanvas,
    x - imageW * 0.5,
    y - imageH * 0.5,
    imageW,
    imageH
  );
  drawingContext.restore();

}


function drawAIAmbientMaterial(
  sourceType,
  color,
  x,
  y,
  w,
  h,
  alpha,
  materialSeed
) {

  drawAmbientImageMaterial(
    sourceType,
    color,
    x,
    y,
    w,
    h,
    alpha,
    materialSeed,
    aiAmbientImage,
    aiAmbientImageCache,
    aiAmbientImageAspect,
    AI_AMBIENT_IMAGE_VISUAL_SCALE
  );
}


function drawHumanAmbientMaterial(
  sourceType,
  color,
  x,
  y,
  w,
  h,
  alpha,
  materialSeed
) {

  drawAmbientImageMaterial(
    sourceType,
    color,
    x,
    y,
    w,
    h,
    alpha,
    materialSeed,
    humanAmbientImage,
    humanAmbientImageCache,
    humanAmbientImageAspect,
    HUMAN_AMBIENT_IMAGE_VISUAL_SCALE
  );
}


function drawSourcePass(
  color,
  x,
  y,
  w,
  h,
  alpha,
  sourceType,
  materialSeed
) {
  drawContributionMaterial(
    sourceType,
    color,
    x,
    y,
    w,
    h,
    alpha,
    materialSeed
  );
}


function drawSourcePasses(
  mode,
  x,
  y,
  w,
  h,
  alpha,
  sourceGeometry = null,
  visualColors = null
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

  let legacyAlpha =
    alpha * LEGACY_VISUAL_ALPHA_SCALE;

  if (
    mode === CARRY_SOURCE_MODE_MIXED
    ||
    mode === CARRY_SOURCE_MODE_AI
  ) {

    let aiColor = LEGACY_NEUTRAL_COLOR;

    drawSourcePass(
      aiColor,
      aiX,
      aiY,
      w,
      h,
      legacyAlpha,
      "ai",
      getMaterialSeed(sourceGeometry, "ai", aiX, aiY, w, h)
    );
  }

  if (
    mode === CARRY_SOURCE_MODE_MIXED
    ||
    mode === CARRY_SOURCE_MODE_HUMAN
  ) {

    let humanColor = LEGACY_NEUTRAL_COLOR;

    drawSourcePass(
      humanColor,
      humanX,
      humanY,
      w,
      h,
      legacyAlpha,
      "human",
      getMaterialSeed(sourceGeometry, "human", humanX, humanY, w, h)
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
const CARRY_SOURCE_MATCH_MAX_DISTANCE = 28;
const INCOMING_CARRY_MERGE_DURATION_MS = 1800;


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

let v05Canvas = null;

let ambientPerformanceLogged = false;

let fragments = [];

let imprints = [];


// ==================================================
// DAY 09 SOUND FIRST PASS
//
// This layer reads existing source/behaviour state only.
// It never writes to source geometry or membership.
// ==================================================

const SOUND_PROXIMITY_SMOOTHING_MS = 420;
const SOUND_PAN_SMOOTHING_MS = 420;
const SOUND_REVERB_SMOOTHING_MS = 850;
const SOUND_BASELINE_GAIN = 0.020;
const SOUND_PROXIMITY_GAIN = 0.080;
const SOUND_AREA_REFERENCE_PX = 18;
const SOUND_AREA_WEIGHT_MAX = 1.40;
const SOUND_PRESENCE_NORMALIZATION = 2.40;
const SOUND_AMBIENT_STATE_WEIGHT = 1.0;
const SOUND_GHOST_STATE_WEIGHT = 0.30;
const SOUND_RESIDUAL_STATE_WEIGHT = 0.40;
const SOUND_MOVING_WET = 0.08;
const SOUND_STAYING_WET = 0.44;
const SOUND_PAN_LIMIT = 0.6;

let soundSystem = null;
let soundUnlockListenerInstalled = false;
let soundStopReference = null;
let soundTraceEventRecorded = false;

function recordSoundTraceEvent(
  eventName
) {

  if (
    soundTraceEventRecorded
  ) {

    return;
  }

  soundTraceEventRecorded = true;
  recordTraceEvent(eventName);
}


function createSoundBus(
  context,
  convolver,
  frequencyA,
  frequencyB,
  waveform
) {

  let oscillatorA = context.createOscillator();
  let oscillatorB = context.createOscillator();
  let toneGain = context.createGain();
  let busGain = context.createGain();
  let panner = context.createStereoPanner();
  let dryGain = context.createGain();

  oscillatorA.type = waveform;
  oscillatorB.type = waveform === "sine" ? "triangle" : "sine";
  oscillatorA.frequency.value = frequencyA;
  oscillatorB.frequency.value = frequencyB;
  toneGain.gain.value = 0.28;
  busGain.gain.value = SOUND_BASELINE_GAIN;
  dryGain.gain.value = 0.82;

  oscillatorA.connect(toneGain);
  oscillatorB.connect(toneGain);
  toneGain.connect(busGain);
  busGain.connect(panner);
  panner.connect(dryGain);
  panner.connect(soundSystem.convolver);
  dryGain.connect(soundSystem.masterGain);

  oscillatorA.start();
  oscillatorB.start();

  return {
    busGain,
    panner,
    proximity: 0,
    pan: 0
  };
}


function createSoundSystem() {

  let AudioContextClass =
    window.AudioContext
    ||
    window.webkitAudioContext;

  if (
    !AudioContextClass
  ) {

    return null;
  }

  let context = new AudioContextClass();
  let masterGain = context.createGain();
  let compressor = context.createDynamicsCompressor();
  let convolver = context.createConvolver();
  let reverbWetGain = context.createGain();
  let impulseLength = floor(context.sampleRate * 1.8);
  let impulse = context.createBuffer(
    2,
    impulseLength,
    context.sampleRate
  );

  for (
    let channel = 0;
    channel < impulse.numberOfChannels;
    channel++
  ) {

    let data = impulse.getChannelData(channel);

    for (
      let i = 0;
      i < impulseLength;
      i++
    ) {

      data[i] =
        (
          Math.random() * 2 - 1
        )
        *
        pow(
          1 - i / impulseLength,
          2.2
        );
    }
  }

  convolver.buffer = impulse;
  reverbWetGain.gain.value = SOUND_MOVING_WET;
  masterGain.gain.value = 0.22;
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.18;
  masterGain.connect(compressor);
  compressor.connect(context.destination);

  soundSystem = {
    context,
    masterGain,
    convolver,
    reverbWetGain,
    human: null,
    ai: null,
    enabled: false
  };

  soundSystem.human = createSoundBus(
    context,
    convolver,
    132,
    174,
    "sine"
  );

  soundSystem.ai = createSoundBus(
    context,
    convolver,
    318,
    412,
    "triangle"
  );

  convolver.connect(reverbWetGain);
  reverbWetGain.connect(masterGain);

  soundSystem.enabled = true;
  return soundSystem;
}


function unlockSound() {

  if (
    soundSystem === null
  ) {

    soundSystem = createSoundSystem();
  }

  if (
    soundSystem === null
  ) {

    recordSoundTraceEvent("SOUND_UNAVAILABLE");
    return;
  }

  if (
    soundSystem.context.state === "suspended"
  ) {

    let resumeResult = soundSystem.context.resume();

    if (
      resumeResult
      &&
      typeof resumeResult.then === "function"
    ) {

      resumeResult.then(
        () => recordSoundTraceEvent("SOUND_UNLOCKED"),
        () => recordSoundTraceEvent("SOUND_UNAVAILABLE")
      );
    }

    else {

      recordSoundTraceEvent("SOUND_UNLOCKED");
    }
  }

  else {

    recordSoundTraceEvent("SOUND_UNLOCKED");
  }
}


function captureSoundStopReference() {

  if (
    currentStopSelection === null
  ) {

    soundStopReference = null;
    return;
  }

  soundStopReference = {
    stopId: currentStopSelection.stopId,
    human: new Map(),
    ai: new Map()
  };

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];
    let humanId = source.humanSource.sourceId;
    let aiId = source.aiSource.sourceId;

    if (
      currentStopSelection.humanSourceIds.includes(humanId)
    ) {

      soundStopReference.human.set(
        humanId,
        getLastVisibleAmbientPosition(source, "human")
      );
    }

    if (
      currentStopSelection.aiSourceIds.includes(aiId)
    ) {

      soundStopReference.ai.set(
        aiId,
        getLastVisibleAmbientPosition(source, "ai")
      );
    }
  }
}


function getSoundSourcePosition(
  source,
  sourceType,
  sourceId
) {

  if (
    viewerState === "STAYING"
    &&
    soundStopReference !== null
  ) {

    let frozenMap =
      sourceType === "human"
        ? soundStopReference.human
        : soundStopReference.ai;

    if (
      frozenMap.has(sourceId)
    ) {

      return frozenMap.get(sourceId);
    }

    return null;
  }

  return getAmbientPositionForSource(
    source,
    sourceType
  );
}


function getSoundProximityAndPan(
  sourceType
) {

  let selectedIds = null;

  if (
    viewerState === "STAYING"
    &&
    currentStopSelection !== null
  ) {

    selectedIds = new Set(
      sourceType === "human"
        ? currentStopSelection.humanSourceIds
        : currentStopSelection.aiSourceIds
    );
  }

  let rawPresence = 0;
  let weightedX = 0;
  let weightedPosition = 0;

  let addContribution = (
    position,
    areaWeight,
    stateWeight
  ) => {

    if (
      position === null
      ||
      stateWeight <= 0
    ) {

      return;
    }

    let distanceWeight =
      getDistanceInteractionFalloff(
        position,
        sourceType
      );

    if (
      distanceWeight <= 0
    ) {

      return;
    }

    let contributionWeight =
      distanceWeight
      *
      areaWeight
      *
      stateWeight;

    rawPresence += contributionWeight;
    weightedX += position.x * contributionWeight;
    weightedPosition += contributionWeight;
  };

  for (
    let i = 0;
    i < sources.length;
    i++
  ) {

    let source = sources[i];
    let sourceId =
      sourceType === "human"
        ? source.humanSource.sourceId
        : source.aiSource.sourceId;

    if (
      selectedIds !== null
      &&
      !selectedIds.has(sourceId)
    ) {

      continue;
    }

    let position =
      getSoundSourcePosition(
        source,
        sourceType,
        sourceId
      );

    let visualScale =
      getMaterialVisualScaleForSource(
        source,
        sourceType
      );
    let areaWeight = constrain(
      sqrt(
        source.w
        *
        visualScale
        *
        source.h
        *
        visualScale
      )
      /
      SOUND_AREA_REFERENCE_PX,
      0.15,
      SOUND_AREA_WEIGHT_MAX
    );

    let ghostState =
      getAmbientGhostState(
        source,
        sourceType
      );
    let appearanceProgress =
      getAmbientAppearanceTransitionProgress(
        source,
        sourceType
      );

    addContribution(
      position,
      areaWeight,
      SOUND_AMBIENT_STATE_WEIGHT
      *
      appearanceProgress
    );

    if (
      viewerState !== "STAYING"
      &&
      ghostState !== null
    ) {

      addContribution(
        {
          x: ghostState.x,
          y: ghostState.y
        },
        areaWeight,
        SOUND_GHOST_STATE_WEIGHT
        *
        (1 - ghostState.recoveryProgress)
      );
    }
  }

  if (
    viewerState !== "STAYING"
  ) {

    for (
      let imprintIndex = 0;
      imprintIndex < imprints.length;
      imprintIndex++
    ) {

      let imprint = imprints[imprintIndex];

      if (
        imprint.active
      ) {

        continue;
      }

      let decay = imprint.getDecayFactor();
      let pieceGroups = [
        imprint.fillPieces,
        imprint.edgePieces,
        imprint.massPieces
      ];

      for (
        let groupIndex = 0;
        groupIndex < pieceGroups.length;
        groupIndex++
      ) {

        let pieces = pieceGroups[groupIndex];
        let stride = max(
          1,
          floor(pieces.length / 32)
        );

        for (
          let pieceIndex = 0;
          pieceIndex < pieces.length;
          pieceIndex += stride
        ) {

          let piece = pieces[pieceIndex];
          let pieceAlpha =
            groupIndex === 0
              ? imprint.getFillAlphaAtState(
                  piece,
                  imprint.frozenFormStrength,
                  imprint.frozenDarkStrength
                )
              : groupIndex === 1
                ? imprint.getEdgeAlphaAtState(
                    piece,
                    imprint.frozenFormStrength,
                    imprint.frozenDarkStrength
                  )
                : imprint.getMassAlphaAtState(
                    piece,
                    imprint.frozenDarkStrength
                  );

          let stateWeight =
            SOUND_RESIDUAL_STATE_WEIGHT
            *
            decay
            *
            constrain(pieceAlpha / 120, 0, 1);

          let position = {
            x: imprint.x + piece.x,
            y: imprint.y + piece.y
          };
          let areaWeight = constrain(
            sqrt(piece.w * piece.h)
            /
            SOUND_AREA_REFERENCE_PX,
            0.15,
            SOUND_AREA_WEIGHT_MAX
          );

          addContribution(
            position,
            areaWeight,
            stateWeight
          );
        }
      }
    }
  }

  let proximity = constrain(
    rawPresence
    /
    (
      rawPresence
      +
      SOUND_PRESENCE_NORMALIZATION
    ),
    0,
    1
  );
  let centroidX =
    weightedX / max(0.001, weightedPosition);
  let pan = constrain(
    map(centroidX, 0, width, -SOUND_PAN_LIMIT, SOUND_PAN_LIMIT),
    -SOUND_PAN_LIMIT,
    SOUND_PAN_LIMIT
  );

  return { proximity, pan };
}


function updateSoundParam(
  parameter,
  value,
  smoothingMs,
  context
) {

  parameter.setTargetAtTime(
    value,
    context.currentTime,
    smoothingMs / 1000
  );
}


function updateSoundLayer() {

  if (
    soundSystem === null
    ||
    !soundSystem.enabled
  ) {

    return;
  }

  let context = soundSystem.context;
  let human =
    getSoundProximityAndPan("human");
  let ai =
    getSoundProximityAndPan("ai");
  let isStaying = viewerState === "STAYING";

  soundSystem.human.proximity = human.proximity;
  soundSystem.ai.proximity = ai.proximity;
  soundSystem.human.pan = human.pan;
  soundSystem.ai.pan = ai.pan;

  updateSoundParam(
    soundSystem.human.busGain.gain,
    SOUND_BASELINE_GAIN
    +
    SOUND_PROXIMITY_GAIN * human.proximity,
    SOUND_PROXIMITY_SMOOTHING_MS,
    context
  );
  updateSoundParam(
    soundSystem.ai.busGain.gain,
    SOUND_BASELINE_GAIN
    +
    SOUND_PROXIMITY_GAIN * ai.proximity,
    SOUND_PROXIMITY_SMOOTHING_MS,
    context
  );
  updateSoundParam(
    soundSystem.human.panner.pan,
    human.pan,
    SOUND_PAN_SMOOTHING_MS,
    context
  );
  updateSoundParam(
    soundSystem.ai.panner.pan,
    ai.pan,
    SOUND_PAN_SMOOTHING_MS,
    context
  );
  updateSoundParam(
    soundSystem.reverbWetGain.gain,
    isStaying ? SOUND_STAYING_WET : SOUND_MOVING_WET,
    SOUND_REVERB_SMOOTHING_MS,
    context
  );
}


// ==================================================
// VIEWER STATE
// ==================================================

function updateViewerInput() {

  let cameraIsActive =
    cameraInputState === "ready"
    &&
    previousCameraSamples !== null;

  let nextX;
  let nextY;

  if (
    cameraIsActive
  ) {

    viewerInputSource = "camera";
    viewerInputInside = !cameraLeavingLikely;

    if (
      cameraMotionValid
    ) {

      nextX = map(
        cameraMotionCenterX,
        0,
        CAMERA_INPUT_WIDTH,
        CAMERA_MIRROR_X ? width : 0,
        CAMERA_MIRROR_X ? 0 : width
      );

      nextY = map(
        cameraMotionCenterY,
        0,
        CAMERA_INPUT_HEIGHT,
        0,
        height
      );
    }

    else {

      nextX = viewerInputInitialized
        ? viewerInputX
        : width * 0.5;
      nextY = viewerInputInitialized
        ? viewerInputY
        : height * 0.5;
    }

    viewerInputSpeed = map(
      constrain(
        cameraMotionAmount,
        0,
        CAMERA_MOTION_SPEED_REFERENCE
      ),
      0,
      CAMERA_MOTION_SPEED_REFERENCE,
      0,
      12
    );
  }

  else {

    viewerInputSource = "mouse";
    viewerInputInside =
      mouseX >= 0
      && mouseX <= width
      && mouseY >= 0
      && mouseY <= height;
    nextX = mouseX;
    nextY = mouseY;
    viewerInputSpeed = dist(
      nextX,
      nextY,
      viewerInputX,
      viewerInputY
    );
  }

  if (
    viewerInputSource !== lastTraceInputSource
  ) {

    recordTraceEvent(
      "INPUT_SOURCE_CHANGE",
      {
        from: lastTraceInputSource,
        to: viewerInputSource
      }
    );

    lastTraceInputSource = viewerInputSource;
  }

  if (
    !viewerInputInitialized
  ) {

    viewerInputX = nextX;
    viewerInputY = nextY;
    viewerInputDX = 0;
    viewerInputDY = 0;
    viewerInputInitialized = true;
  }

  else {

    viewerInputDX = nextX - viewerInputX;
    viewerInputDY = nextY - viewerInputY;
    viewerInputX = nextX;
    viewerInputY = nextY;
  }

  let now = millis();

  if (
    now - lastViewerInputLogTime
    >= VIEWER_INPUT_LOG_INTERVAL_MS
  ) {

    console.log(
      "Viewer Input:",
      "source =", viewerInputSource,
      "x =", viewerInputX.toFixed(1),
      "y =", viewerInputY.toFixed(1),
      "speed =", viewerInputSpeed.toFixed(2),
      "state =", viewerState
    );

    lastViewerInputLogTime = now;
  }
}


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

let currentStopGatheringStartTime = 0;
let currentStopDeepeningStartTime = 0;
let shadowDeepeningProgress = 0;

let leavingVisualStates = [];
let leavingHandoffStopId = null;

// Node 2B: stable source IDs selected once when a stop begins.
let currentStopSelection = null;


// ==================================================
// CARRIED COUNT
// ==================================================

let carriedCountThisFrame = 0;


// ==================================================
// SETUP
// ==================================================
function validateBridgeParameterSet(value, label) {

  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new Error(label + " must be an object.");
  }

  let actualFields = Object.keys(value).sort();
  let expectedFields = ACTIVE_PARAMETER_FIELDS.slice().sort();

  if (
    actualFields.length !== expectedFields.length
    || actualFields.some(
      (field, index) => field !== expectedFields[index]
    )
  ) {
    throw new Error(
      label
      + " must contain exactly: "
      + ACTIVE_PARAMETER_FIELDS.join(", ")
      + "."
    );
  }

  let validated = {};

  for (
    let i = 0;
    i < ACTIVE_PARAMETER_FIELDS.length;
    i++
  ) {

    let field = ACTIVE_PARAMETER_FIELDS[i];
    let parameter = value[field];

    if (
      typeof parameter !== "number"
      || !Number.isFinite(parameter)
      || parameter < 0
      || parameter > 1
    ) {
      throw new Error(
        label
        + "."
        + field
        + " must be a finite number between 0 and 1."
      );
    }

    validated[field] = parameter;
  }

  return validated;
}


async function loadBridgeParameters() {

  bridgeState = "loading";
  console.info(
    "TRACE WEB BRIDGE: loading",
    BRIDGE_ENDPOINT
  );

  try {

    let response = await fetch(
      BRIDGE_ENDPOINT,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        "HTTP "
        + response.status
        + " from "
        + BRIDGE_ENDPOINT
      );
    }

    let payload = await response.json();
    let ai = validateBridgeParameterSet(
      payload.ai_parameters,
      "ai_parameters"
    );
    let human = validateBridgeParameterSet(
      payload.human_parameters,
      "human_parameters"
    );

    bridgeState = "success";
    console.info(
      "TRACE WEB BRIDGE: success",
      {ai_parameters: ai, human_parameters: human}
    );

    return {
      payload,
      ai,
      human
    };
  }

  catch (error) {

    bridgeState = "error";
    console.error(
      "TRACE WEB BRIDGE: error; using local fallback",
      error
    );

    bridgeState = "fallback";
    console.warn(
      "TRACE WEB BRIDGE: fallback",
      LOCAL_FALLBACK_PARAMETERS
    );

    return {
      payload: null,
      ai: {...LOCAL_FALLBACK_PARAMETERS.ai},
      human: {...LOCAL_FALLBACK_PARAMETERS.human}
    };
  }
}


function markCameraInputReady() {

  if (
    cameraInputReadyLogged
  ) {

    return;
  }

  cameraInputState = "ready";
  cameraInputReadyLogged = true;
  console.log(
    "Camera input ready:"
    + " "
    + CAMERA_INPUT_WIDTH
    + " × "
    + CAMERA_INPUT_HEIGHT
  );
}


function markCameraInputUnavailable() {

  if (
    cameraInputUnavailableLogged
  ) {

    return;
  }

  cameraInputState = "unavailable";
  cameraInputUnavailableLogged = true;
  console.warn(
    "Camera input unavailable, continuing without camera."
  );
}


function setupCameraInput() {

  cameraInputState = "loading";

  try {

    cameraInput = createCapture(VIDEO);
    cameraInput.size(
      CAMERA_INPUT_WIDTH,
      CAMERA_INPUT_HEIGHT
    );
    cameraInput.hide();

    cameraInput.elt.addEventListener(
      "loadedmetadata",
      markCameraInputReady,
      { once: true }
    );

    cameraInput.elt.addEventListener(
      "error",
      markCameraInputUnavailable,
      { once: true }
    );
  }

  catch (error) {

    cameraInput = null;
    markCameraInputUnavailable();
  }
}


function getCameraMotionEdge(centerX) {

  let edgeWidth =
    CAMERA_INPUT_WIDTH
    * CAMERA_EDGE_ZONE_RATIO;

  if (
    centerX < edgeWidth
  ) {

    return "LEFT";
  }

  if (
    centerX > CAMERA_INPUT_WIDTH - edgeWidth
  ) {

    return "RIGHT";
  }

  return "NONE";
}


function updateCameraPresenceHeuristic(now) {

  let edge =
    cameraMotionValid
      ? getCameraMotionEdge(cameraMotionCenterX)
      : "NONE";

  if (
    cameraMotionValid
    &&
    cameraMotionAmount >= CAMERA_MOTION_HIGH_THRESHOLD
  ) {

    let direction = "NONE";
    let cameraReentered = false;

    if (
      lastStrongCameraMotionX !== null
    ) {

      let deltaX =
        cameraMotionCenterX
        -
        lastStrongCameraMotionX;

      if (
        deltaX <= -CAMERA_DIRECTION_MIN_DELTA_X
      ) {

        direction = "LEFT";
      }

      else if (
        deltaX >= CAMERA_DIRECTION_MIN_DELTA_X
      ) {

        direction = "RIGHT";
      }
    }

    if (
      !viewerInputInside
    ) {

      cameraReentryMotionCount++;

      if (
        cameraReentryMotionCount >= 2
      ) {

        viewerInputInside = true;
        cameraLeavingCandidateActive = false;
        cameraLeavingCandidateDirection = "NONE";
        cameraLeavingCandidateSince = 0;
        cameraLeavingLikely = false;
        cameraInteriorMotionCount = 0;
        cameraReentryMotionCount = 0;
        cameraReentered = true;
      }
    }

    else {

      cameraReentryMotionCount = 0;

      if (
        cameraLeavingCandidateActive
        ||
        cameraLeavingLikely
      ) {

        if (
          edge === "NONE"
        ) {

          cameraInteriorMotionCount++;
        }

        else {

          cameraInteriorMotionCount = 0;
        }

        if (
          cameraInteriorMotionCount >= 2
        ) {

          cameraLeavingCandidateActive = false;
          cameraLeavingCandidateDirection = "NONE";
          cameraLeavingCandidateSince = 0;
          cameraLeavingLikely = false;
          cameraInteriorMotionCount = 0;
        }
      }

      else {

        cameraInteriorMotionCount = 0;
      }
    }

    if (
      !cameraReentered
      &&
      viewerInputInside
      &&
      !cameraLeavingCandidateActive
      &&
      edge !== "NONE"
      &&
      direction === edge
    ) {

      cameraLeavingCandidateActive = true;
      cameraLeavingCandidateDirection = direction;
      cameraLeavingCandidateSince = now;
      cameraLeavingLikely = false;
    }

    lastStrongCameraMotionX = cameraMotionCenterX;
  }

  if (
    !cameraMotionValid
    ||
    cameraMotionAmount <= CAMERA_MOTION_HIGH_THRESHOLD
  ) {

    cameraReentryMotionCount = 0;
  }

  if (
    cameraLeavingCandidateActive
  ) {

    if (
      cameraMotionAmount < CAMERA_MOTION_LOW_THRESHOLD
      &&
      now - cameraLeavingCandidateSince
      >= CAMERA_LEAVING_CONFIRMATION_MS
    ) {

      cameraLeavingLikely = true;
    }
  }

  if (
    now - lastCameraPresenceLogTime
    >= CAMERA_PRESENCE_LOG_INTERVAL_MS
  ) {

    let candidateDuration =
      cameraLeavingCandidateActive
        ? now - cameraLeavingCandidateSince
        : 0;

    console.log(
      "Presence Debug:",
      "edge =", edge,
      "direction =", cameraLeavingCandidateDirection,
      "candidate =", cameraLeavingCandidateActive,
      "candidateDuration =", candidateDuration,
      "leavingLikely =", cameraLeavingLikely
    );

    lastCameraPresenceLogTime = now;
  }
}


function updateCameraMotionSensor() {

  if (
    cameraInputState !== "ready"
    ||
    cameraInput === null
  ) {

    return;
  }

  let now = millis();

  if (
    now - lastCameraSampleTime
    < CAMERA_SAMPLE_INTERVAL_MS
  ) {

    return;
  }

  lastCameraSampleTime = now;

  try {

    cameraInput.loadPixels();

    if (
      !cameraInput.pixels
      ||
      cameraInput.pixels.length === 0
    ) {

      cameraMotionValid = false;
      return;
    }

    let logicalPixelCount =
      CAMERA_INPUT_WIDTH
      * CAMERA_INPUT_HEIGHT
      * 4;

    let pixelDensityScale = max(
      1,
      round(
        sqrt(
          cameraInput.pixels.length
          /
          logicalPixelCount
        )
      )
    );

    let pixelWidth =
      CAMERA_INPUT_WIDTH
      * pixelDensityScale;

    let pixelHeight =
      CAMERA_INPUT_HEIGHT
      * pixelDensityScale;

    let sampleCount =
      CAMERA_SAMPLE_COLUMNS
      * CAMERA_SAMPLE_ROWS;

    if (
      cameraCurrentSamples === null
      ||
      cameraCurrentSamples.length !== sampleCount
    ) {

      cameraCurrentSamples = new Array(sampleCount);
    }

    let sampleIndex = 0;

    for (
      let sampleY = 0;
      sampleY < CAMERA_SAMPLE_ROWS;
      sampleY++
    ) {

      let pixelY = min(
        pixelHeight - 1,
        floor(
          (sampleY + 0.5)
          * pixelHeight
          / CAMERA_SAMPLE_ROWS
        )
      );

      for (
        let sampleX = 0;
        sampleX < CAMERA_SAMPLE_COLUMNS;
        sampleX++
      ) {

        let pixelX = min(
          pixelWidth - 1,
          floor(
            (sampleX + 0.5)
            * pixelWidth
            / CAMERA_SAMPLE_COLUMNS
          )
        );

        let pixelIndex =
          (pixelY * pixelWidth + pixelX)
          * 4;

        // Camera pixels are read as RGBA values.
        let red = cameraInput.pixels[pixelIndex];
        let green = cameraInput.pixels[pixelIndex + 1];
        let blue = cameraInput.pixels[pixelIndex + 2];
        let alpha = cameraInput.pixels[pixelIndex + 3];

        if (
          alpha === undefined
          ||
          alpha < 8
        ) {

          cameraCurrentSamples[sampleIndex] = 0;
        }

        else {

          let sampledColor = color(
            red,
            green,
            blue,
            alpha
          );

          cameraCurrentSamples[sampleIndex] =
            brightness(sampledColor);
        }

        sampleIndex++;
      }
    }

    if (
      previousCameraSamples === null
    ) {

      previousCameraSamples = cameraCurrentSamples.slice();
      cameraMotionAmount = 0;
      cameraMotionValid = false;
      return;
    }

    let differenceTotal = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightTotal = 0;

    sampleIndex = 0;

    for (
      let sampleY = 0;
      sampleY < CAMERA_SAMPLE_ROWS;
      sampleY++
    ) {

      for (
        let sampleX = 0;
        sampleX < CAMERA_SAMPLE_COLUMNS;
        sampleX++
      ) {

        let difference = abs(
          cameraCurrentSamples[sampleIndex]
          -
          previousCameraSamples[sampleIndex]
        );

        if (
          difference < CAMERA_PIXEL_NOISE_THRESHOLD
        ) {

          difference = 0;
        }

        differenceTotal += difference;
        weightedX += sampleX * difference;
        weightedY += sampleY * difference;
        weightTotal += difference;
        sampleIndex++;
      }
    }

    let rawCameraMotionAmount =
      differenceTotal
      /
      (sampleCount * 100);

    cameraMotionAmount = lerp(
      cameraMotionAmount,
      rawCameraMotionAmount,
      CAMERA_MOTION_SMOOTHING
    );

    cameraMotionValid =
      weightTotal >= CAMERA_MOTION_MIN_WEIGHT;

    if (
      cameraMotionValid
    ) {

      let rawCenterX =
        weightedX
        /
        weightTotal;

      let rawCenterY =
        weightedY
        /
        weightTotal;

      cameraMotionCenterX = lerp(
        cameraMotionCenterX,
        map(
          rawCenterX,
          0,
          CAMERA_SAMPLE_COLUMNS - 1,
          0,
          CAMERA_INPUT_WIDTH
        ),
        CAMERA_MOTION_SMOOTHING
      );

      cameraMotionCenterY = lerp(
        cameraMotionCenterY,
        map(
          rawCenterY,
          0,
          CAMERA_SAMPLE_ROWS - 1,
          0,
          CAMERA_INPUT_HEIGHT
        ),
        CAMERA_MOTION_SMOOTHING
      );
    }

    previousCameraSamples = cameraCurrentSamples.slice();
    updateCameraPresenceHeuristic(now);

    if (
      now - lastCameraSensorLogTime
      >= CAMERA_SENSOR_LOG_INTERVAL_MS
    ) {

      console.log(
        "Camera Motion:",
        "amount =", cameraMotionAmount.toFixed(3),
        "centerX =", cameraMotionCenterX.toFixed(1),
        "centerY =", cameraMotionCenterY.toFixed(1),
        "valid =", cameraMotionValid
      );

      lastCameraSensorLogTime = now;
    }
  }

  catch (error) {

    cameraMotionValid = false;
  }
}


function drawDebugHUD() {

  if (
    !DEBUG_HUD
  ) {

    return;
  }

  push();

  noStroke();
  fill(255, 245);
  rectMode(CORNER);
  rect(12, 12, 390, 190);

  fill(20);
  textAlign(LEFT, TOP);
  textSize(28);

  let hudLines = [
    "STATE: " + viewerState,
    "CANDIDATE: "
      + (cameraLeavingCandidateActive ? "YES" : "NO"),
    "LEAVING: "
      + (cameraLeavingLikely ? "YES" : "NO")
  ];

  for (
    let i = 0;
    i < hudLines.length;
    i++
  ) {

    text(
      hudLines[i],
      30,
      32 + i * 52
    );
  }

  pop();
}


async function setup() {

  // ==================================================
  // LOAD JSON
  // p5.js 2.x：等待 JSON 读取完成以后再继续 setup
  // ==================================================

  let bridgeResult = await loadBridgeParameters();

  traceData = bridgeResult.payload;
  aiParams = bridgeResult.ai;
  humanParams = bridgeResult.human;


  // ----------------------------------------------
  // 运行时版本标记
  //
  // 如果 Safari 标签不是这个名字，
  // 说明当前没有运行这份 v03 sketch.js。
  // ----------------------------------------------

  document.title =
    "interactive-trace-v09 | parameter-mode | mixed-stay";

  console.log(
    "RUNNING: interactive-trace-v09 | parameter-mode | mixed-stay"
  );


  v05Canvas = createCanvas(
    800,
    600
  );

  v05Canvas.elt.style.setProperty(
    "width",
    "100vw",
    "important"
  );

  v05Canvas.elt.style.setProperty(
    "height",
    "100vh",
    "important"
  );

  setupCameraInput();

  if (
    !soundUnlockListenerInstalled
  ) {

    window.addEventListener(
      "pointerdown",
      unlockSound,
      { passive: true }
    );
    soundUnlockListenerInstalled = true;
  }


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


  validateSourceIdentities();

  if (USE_AI_IMAGE_TRACE) {

    loadImage(
      AI_AMBIENT_IMAGE_PATH,
      (imageAsset) => {
        aiAmbientImage = imageAsset;
        aiAmbientImageFailed = false;
        let built = buildAmbientImageCache(aiAmbientImage);
        aiAmbientImageAspect = built === null ? 0 : built.aspect;
        aiAmbientImageCache = built === null ? null : built.cache;
        aiMediaProfile = createMediaProfile(
          aiAmbientImage,
          "AI"
        );
        console.log("AI ambient image loaded");
      },
      () => {
        aiAmbientImage = null;
        aiAmbientImageFailed = true;
        console.warn("AI ambient image failed; using blue material");
      }
    );
  }

  if (USE_HUMAN_IMAGE_TRACE) {

    loadImage(
      HUMAN_AMBIENT_IMAGE_PATH,
      (imageAsset) => {
        humanAmbientImage = imageAsset;
        humanAmbientImageFailed = false;
        let built = buildAmbientImageCache(humanAmbientImage);
        humanAmbientImageAspect = built === null ? 0 : built.aspect;
        humanAmbientImageCache = built === null ? null : built.cache;
        humanMediaProfile = createMediaProfile(
          humanAmbientImage,
          "Human"
        );
        console.log("Human ambient image loaded");
      },
      () => {
        humanAmbientImage = null;
        humanAmbientImageFailed = true;
        console.warn("Human ambient image failed; using pink material");
      }
    );
  }

  recordTraceEvent("RUN_START");
}


// ==================================================
// DRAW
// ==================================================

function draw() {

  background(255);

  // Camera / Mouse input bridge; behaviour still reads its existing state.
  updateCameraMotionSensor();
  updateViewerInput();

  if (
    !ambientPerformanceLogged
    &&
    frameCount >= 120
  ) {

    console.log(
      "Ambient performance:",
      "legacy slots =",
      sources.length,
      "logical sources =",
      sources.length * 2,
      "FPS =",
      round(frameRate())
    );

    ambientPerformanceLogged = true;
  }

  recordTracePerformanceSample();


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

    // Capture the last visible selected-source state before legacy leave logic.
    captureAmbientGhostStates();
    captureLeavingVisualState();

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

    updateShadowDeepening(
      millis()
    );

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


  // Source-level handoff visual; no canvas or bitmap snapshot is used.
  drawLeavingVisualStates();


  // Debug-only boundary overlay; selection itself never changes the renderer.
  drawDistanceDebug();


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


  finalizeAmbientGhostRecovery();
  updateSoundLayer();
  drawDebugHUD();
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
      x - viewerInputX
    )

    /

    (
      VIEWER_RX
      *
      scale
    );


  let dy =

    (
      y - viewerInputY
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


    this.humanSource =
      createSourceIdentity("human");

    this.aiSource =
      createSourceIdentity("ai");

    this.humanAmbientPosition =
      getStableAmbientPosition(
        this.humanSource.sourceId,
        width,
        height
      );

    this.aiAmbientPosition =
      getStableAmbientPosition(
        this.aiSource.sourceId,
        width,
        height
      );


    this.w =
      random(3, 9);


    this.h =
      random(3, 8);


    this.humanAccumulationLayers =
      createAccumulationLayerDescriptors(
        this.humanSource.sourceId
      );

    this.aiAccumulationLayers =
      createAccumulationLayerDescriptors(
        this.aiSource.sourceId
      );


    this.alpha =
      random(16, 32);


    this.t =
      random(1000);


    this.jitterX = 0;
    this.jitterY = 0;
    this.humanJitterX = 0;
    this.humanJitterY = 0;
    this.aiJitterX = 0;
    this.aiJitterY = 0;

    this.humanGatheringState = null;
    this.aiGatheringState = null;
    this.humanStayFrozenPosition = null;
    this.aiStayFrozenPosition = null;
    this.humanLastVisiblePosition = null;
    this.aiLastVisiblePosition = null;
    this.humanGhostState = null;
    this.aiGhostState = null;
  }


  // ==================================================
  // UPDATE
  // ==================================================

  update() {

    this.jitterX = 0;
    this.jitterY = 0;

    let humanPosition =
      getAmbientPositionForSource(
        this,
        "human"
      );

    let aiPosition =
      getAmbientPositionForSource(
        this,
        "ai"
      );

    let canMoveAmbient =
      leaveCaptureFrames === 0
      &&
      (
        viewerState === "MOVING"
        ||
        leavePulse > 0
      );

    if (
      canMoveAmbient
      &&
      (
        getDistanceInteractionFalloff(
          humanPosition,
          "human"
        )
        >
        0
        ||
        getDistanceInteractionFalloff(
          aiPosition,
          "ai"
        )
        >
        0
      )
    ) {

      this.t += 0.05;
    }

    // Selected sources keep advancing the same MOVING phase during gathering.
    if (
      viewerState === "STAYING"
      &&
      (
        this.humanGatheringState !== null
        ||
        this.aiGatheringState !== null
      )
    ) {

      this.t += 0.05;
    }

  let humanCanUseMotion =
    viewerState !== "STAYING"
    ||
    this.humanGatheringState !== null;

  let aiCanUseMotion =
    viewerState !== "STAYING"
    ||
    this.aiGatheringState !== null;

  let humanJitter =
    humanCanUseMotion
      ? getMovingAmbientJitter(
          humanPosition,
          this.t,
          "human",
          viewerState === "STAYING"
        )
      : { x: 0, y: 0 };

  let aiJitter =
    aiCanUseMotion
      ? getMovingAmbientJitter(
          aiPosition,
          this.t,
          "ai",
          viewerState === "STAYING"
        )
      : { x: 0, y: 0 };

    this.humanJitterX = humanJitter.x;
    this.humanJitterY = humanJitter.y;
    this.aiJitterX = aiJitter.x;
    this.aiJitterY = aiJitter.y;

    updateAmbientGhostRecovery(
      this,
      "human",
      millis()
    );

    updateAmbientGhostRecovery(
      this,
      "ai",
      millis()
    );

    if (
      viewerState === "STAYING"
      &&
      this.humanGatheringState !== null
    ) {

      updateGatheringState(
        this.humanGatheringState,
        this,
        "human",
        millis()
      );
    }

    if (
      viewerState === "STAYING"
      &&
      this.aiGatheringState !== null
    ) {

      updateGatheringState(
        this.aiGatheringState,
        this,
        "ai",
        millis()
      );
    }
  }


  // ==================================================
  // DISPLAY
  // ==================================================

  display() {

    // ==================================================
    // AI PARAMETERS → TEST VISUAL
    // ==================================================

    let aiSourceParams =
      getParamsForSourceType(
        this.aiSource.sourceType
      );

    let aiAlpha =

      map(
        aiSourceParams.intensity,
        0,
        1,
        8,
        60
      );

    drawAmbientGhost(
      this,
      "ai"
    );

    drawRecoveringAmbientGhost(
      this,
      "ai"
    );


    let aiSpread =

      map(
        aiSourceParams.instability,
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


    let aiPosition =
      getSourceDisplayPosition(
        this,
        "ai"
      );

    if (
      viewerState === "MOVING"
    ) {

      this.aiLastVisiblePosition = {
        x:
          aiPosition.x
          +
          aiOffsetX,
        y:
          aiPosition.y
          +
          aiOffsetY
      };
    }

    let aiShadowVisual =
      getShadowVisualState(
        "ai",
        getActiveSourceShadowDepth(
          this,
          "ai"
        )
      );

    if (
      !isSourceInLeavingHandoff(
        this,
        "ai"
      )
      &&
      !aiPosition.isGathering
      &&
      (
        getAmbientGhostState(this, "ai") === null
        ||
        getAmbientGhostState(this, "ai").recoveryProgress >= 1
      )
    ) {

      let aiAmbientAppearanceProgress =
        getAmbientAppearanceTransitionProgress(
          this,
          "ai"
        );

      drawAccumulationLayers(
        this,
        "ai",
        {
          x:
            aiPosition.x
            +
            (
              aiPosition.isGathering
              ||
              aiPosition.isFrozen
                ? 0
                : aiOffsetX
            ),
          y:
            aiPosition.y
            +
            (
              aiPosition.isGathering
              ||
              aiPosition.isFrozen
                ? 0
                : aiOffsetY
            )
        },
        aiShadowVisual,
        getActiveSourceShadowDepth(
          this,
          "ai"
        )
      );

      drawAIAmbientMaterial(
        "ai",
        aiShadowVisual.color,
        aiPosition.x
        +
        (
          aiPosition.isGathering
          ||
          aiPosition.isFrozen
            ? 0
            : aiOffsetX
        ),
        aiPosition.y
        +
        (
          aiPosition.isGathering
          ||
          aiPosition.isFrozen
            ? 0
            : aiOffsetY
        ),
        this.w * aiShadowVisual.sizeMultiplier,
        this.h * aiShadowVisual.sizeMultiplier,
        aiShadowVisual.alpha
        *
        aiAmbientAppearanceProgress,
        this.aiSource.sourceId
      );

    }


    // ==================================================
    // HUMAN PARAMETERS → TEST VISUAL
    // ==================================================

    let humanSourceParams =
      getParamsForSourceType(
        this.humanSource.sourceType
      );

    let humanAlpha =

      map(
        humanSourceParams.intensity,
        0,
        1,
        8,
        60
      );

    drawAmbientGhost(
      this,
      "human"
    );

    drawRecoveringAmbientGhost(
      this,
      "human"
    );


    let humanSpread =

      map(
        humanSourceParams.instability,
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


    let humanPosition =
      getSourceDisplayPosition(
        this,
        "human"
      );

    if (
      viewerState === "MOVING"
    ) {

      this.humanLastVisiblePosition = {
        x:
          humanPosition.x
          +
          humanOffsetX,
        y:
          humanPosition.y
          +
          humanOffsetY
      };
    }

    let humanShadowVisual =
      getShadowVisualState(
        "human",
        getActiveSourceShadowDepth(
          this,
          "human"
        )
      );

    if (
      !isSourceInLeavingHandoff(
        this,
        "human"
      )
      &&
      !humanPosition.isGathering
      &&
      (
        getAmbientGhostState(this, "human") === null
        ||
        getAmbientGhostState(this, "human").recoveryProgress >= 1
      )
    ) {

      let humanAmbientAppearanceProgress =
        getAmbientAppearanceTransitionProgress(
          this,
          "human"
        );

      // Accumulation layers are rendered behind the front fragment.
      drawAccumulationLayers(
        this,
        "human",
        {
          x:
            humanPosition.x
            +
            (
              humanPosition.isGathering
              ||
              humanPosition.isFrozen
                ? 0
                : humanOffsetX
            ),
          y:
            humanPosition.y
            +
            (
              humanPosition.isGathering
              ||
              humanPosition.isFrozen
                ? 0
                : humanOffsetY
            )
        },
        humanShadowVisual,
        getActiveSourceShadowDepth(
          this,
          "human"
        )
      );

      drawHumanAmbientMaterial(
        "human",
        humanShadowVisual.color,
        humanPosition.x
        +
        (
          humanPosition.isGathering
          ||
          humanPosition.isFrozen
            ? 0
            : humanOffsetX
        ),
        humanPosition.y
        +
        (
          humanPosition.isGathering
          ||
          humanPosition.isFrozen
            ? 0
            : humanOffsetY
        ),
        this.w * humanShadowVisual.sizeMultiplier,
        this.h * humanShadowVisual.sizeMultiplier,
        humanShadowVisual.alpha
        *
        humanAmbientAppearanceProgress,
        this.humanSource.sourceId
      );

    }
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

    this.stopId = currentStopId;
    this.suppressLegacyVisualDuringHandoff = false;


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

    if (
      this.suppressLegacyVisualDuringHandoff
    ) {

      pop();

      return;
    }


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

      // Node 2C hides only the legacy active synthetic visual.
      // Its imprint continues to grow, freeze, decay, and feed carry/residual.
      if (
        viewerState === "STAYING"
      ) {

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
    originSourceId = null
  ) {

    this.x = x;
    this.y = y;


    this.stopId =
      stopId;

    this.suppressLegacyVisualDuringHandoff = false;


    // Optional provenance scaffold for future source-aware behavior.
    // Legacy fragments remain null and keep their existing behavior.
    this.sourceType =
      sourceType;

    this.originSourceId =
      originSourceId;


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
    this.shadowMember = false;
    this.incomingCarryMerge = null;

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

    this.carryClusterAnchorOffsetX = 0;
    this.carryClusterAnchorOffsetY = 0;
    this.carryClusterLocalOffsetX = 0;
    this.carryClusterLocalOffsetY = 0;
    this.carryPersistenceStartedAt = null;
    this.carryPersistenceRank = 1;
    this.carryPersistenceOpacity = 1;
    this.carryPersistenceDepleted = false;
    this.carryVisualBaseAlpha = null;
    this.carryCurrentVisualAlpha = null;
    this.carryCurrentVisualWidth = null;
    this.carryCurrentVisualHeight = null;
    this.carryOriginalVisualAlpha = null;
    this.carryDepthSettleStartAlpha = null;
    this.carryDepthSettleStartedAt = null;
    this.carryCutVisualWidth = null;
    this.carryCutVisualHeight = null;
    this.carryOriginalVisualWidth = null;
    this.carryOriginalVisualHeight = null;
    this.carryCutVisualColor = null;
    this.carryOriginalVisualColor = null;
    this.carryCurrentVisualColor = null;
    this.carryVisualSettleNeeded = false;
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


    // Incoming carry is merged only after a new STAYING begins.
    // Its provenance remains unchanged while only the behaviour state changes.
    if (
      this.incomingCarryMerge !== null
      &&
      (
        viewerState !== "STAYING"
        ||
        this.incomingCarryMerge.stopId !== currentStopId
      )
    ) {

      this.incomingCarryMerge = null;
    }

    if (
      this.incomingCarryMerge !== null
    ) {

      let mergeState =
        this.incomingCarryMerge;

      let mergeProgress =
        constrain(
          (
            millis()
            -
            mergeState.startTime
          )
          /
          INCOMING_CARRY_MERGE_DURATION_MS,
          0,
          1
        );

      let smoothMergeProgress =
        mergeProgress
        *
        mergeProgress
        *
        (3 - 2 * mergeProgress);

      this.x =
        lerp(
          mergeState.startX,
          mergeState.targetX,
          smoothMergeProgress
        );

      this.y =
        lerp(
          mergeState.startY,
          mergeState.targetY,
          smoothMergeProgress
        );

      if (
        mergeProgress >= 1
      ) {

        this.incomingCarryMerge = null;
        this.carried = false;
        this.shadowMember = true;
        this.carryPersistenceStartedAt = null;
        this.carryPersistenceOpacity = 1;
        this.carryPersistenceDepleted = false;
        this.carryPersistenceRank = 1;
        this.carryVisualBaseAlpha = null;
        this.carryCurrentVisualAlpha = null;
        this.carryCurrentVisualWidth = null;
        this.carryCurrentVisualHeight = null;
        this.carryOriginalVisualAlpha = null;
        this.carryDepthSettleStartAlpha = null;
        this.carryDepthSettleStartedAt = null;
        this.carryCutVisualWidth = null;
        this.carryCutVisualHeight = null;
        this.carryOriginalVisualWidth = null;
        this.carryOriginalVisualHeight = null;
        this.carryCutVisualColor = null;
        this.carryOriginalVisualColor = null;
        this.carryCurrentVisualColor = null;
        this.carryVisualSettleNeeded = false;
      }

      return;
    }


    // =================================================
    // CARRIED
    // =================================================

    if (
      this.carried
    ) {

      this.carryPersistenceOpacity =
        getCarryPersistenceOpacity(
          this
        );

      if (
        this.carryPersistenceDepleted
      ) {

        return;
      }

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

        viewerInputX

        +

        this.carryClusterAnchorOffsetX

        +

        this.carryClusterLocalOffsetX

        +

        driftX;


      let targetY =

        viewerInputY

        +

        this.carryClusterAnchorOffsetY

        +

        this.carryClusterLocalOffsetY

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

  displayShadowMember() {

    if (
      this.sourceType !== "human"
      &&
      this.sourceType !== "ai"
    ) {

      return;
    }

    let shadowDepth =
      getEffectiveShadowDepth();

    let visual =
      getShadowVisualState(
        this.sourceType,
        shadowDepth
      );

    if (
      this.incomingCarryMerge !== null
    ) {

      visual = {
        ...visual,
        alpha:
          this.carryCurrentVisualAlpha
          !== null
            ? this.carryCurrentVisualAlpha
            : visual.alpha,
        sizeMultiplier:
          this.carryCurrentVisualWidth
          !== null
            ? this.carryCurrentVisualWidth / this.w
            : visual.sizeMultiplier,
        color:
          this.carryCurrentVisualColor
          !== null
            ? this.carryCurrentVisualColor
            : visual.color
      };
    }

    let sourceMode =
      this.sourceType === "human"
        ? CARRY_SOURCE_MODE_HUMAN
        : CARRY_SOURCE_MODE_AI;

    drawAccumulationLayers(
      this,
      this.sourceType,
      { x: this.x, y: this.y },
      visual,
      shadowDepth
    );

    drawSourcePasses(
      sourceMode,
      this.x,
      this.y,
      this.w * visual.sizeMultiplier,
      this.h * visual.sizeMultiplier,
      visual.alpha,
      this,
      this.carryCurrentVisualColor === null
        ? null
        : {
            human:
              this.sourceType === "human"
                ? this.carryCurrentVisualColor
                : HUMAN_TEST_COLOR,
            ai:
              this.sourceType === "ai"
                ? this.carryCurrentVisualColor
                : AI_TEST_COLOR
          }
    );
  }

  display() {

    if (
      this.shadowMember
      &&
      !this.settled
      &&
      this.stopId === currentStopId
      &&
      viewerState === "STAYING"
    ) {

      this.displayShadowMember();
      return;
    }

    // Node 2C hides only current-stop synthetic deposits while STAYING.
    // Their data still exists for the unchanged leave/carry/residual lifecycle.
    if (
      viewerState === "STAYING"
      &&
      !this.settled
      &&
      !this.carried
    ) {

      return;
    }

    if (
      this.suppressLegacyVisualDuringHandoff
      &&
      !this.carried
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

      let persistenceOpacity =
        getCarryPersistenceOpacity(
          this
        );

      if (
        persistenceOpacity <= 0
      ) {

        this.carryCurrentVisualAlpha = 0;

        return;
      }

      displayW =
        getCarrySettledVisualDimension(
          this,
          "width"
        );

      displayH =
        getCarrySettledVisualDimension(
          this,
          "height"
        );

      alpha =
        getCarryDepthSettleAlpha(
          this
        )
        *
        persistenceOpacity;

      this.carryCurrentVisualColor =
        getCarrySettledVisualColor(
          this
        );
      this.carryCurrentVisualAlpha = alpha;
      this.carryCurrentVisualWidth = displayW;
      this.carryCurrentVisualHeight = displayH;
    }


    let carriedSourceMode =
      this.carried
        ? this.carrySourceMode
        : CARRY_SOURCE_MODE_MIXED;

    let isCarriedCloud =

      this.carried

      &&

      !inLeaveMotionHold

      &&

      carriedSourceMode !== null;


    // Purple / mixed appearance comes from overlapping red and blue passes.
    // Only the carried cloud uses its assigned source mode.
    drawSourcePasses(
      carriedSourceMode,
      this.x + this.displayJitterX,
      this.y + this.displayJitterY,
      displayW,
      displayH,
      alpha,
      this,
      this.carried
      &&
      this.carryCurrentVisualColor !== null
        ? {
            human:
              this.carrySourceMode === CARRY_SOURCE_MODE_HUMAN
                ? this.carryCurrentVisualColor
                : HUMAN_TEST_COLOR,
            ai:
              this.carrySourceMode === CARRY_SOURCE_MODE_AI
                ? this.carryCurrentVisualColor
                : AI_TEST_COLOR
          }
        : null
    );
  }
}


// ==================================================
// BEGIN NEW STOP
// ==================================================

function getIncomingCarryMergeTarget(
  fragment,
  clusterAnchor = null
) {

  if (
    clusterAnchor !== null
  ) {

    return {
      x:
        clusterAnchor.x
        +
        fragment.carryClusterLocalOffsetX,
      y:
        clusterAnchor.y
        +
        fragment.carryClusterLocalOffsetY
    };
  }

  let identityKey =
    fragment.originSourceId
    ||
    "unresolved-carry";

  let targetOffsetX =
    map(
      getStableUnit(
        identityKey + ":merge:" + currentStopId + ":x"
      ),
      0,
      1,
      -GATHER_TARGET_RX * 0.45,
      GATHER_TARGET_RX * 0.45
    );

  let targetOffsetY =
    map(
      getStableUnit(
        identityKey + ":merge:" + currentStopId + ":y"
      ),
      0,
      1,
      -GATHER_TARGET_RY * 0.45,
      GATHER_TARGET_RY * 0.45
    );

  return {
    x: stopX + targetOffsetX,
    y: stopY + targetOffsetY
  };
}

function getCarryPersistenceOpacity(
  fragment,
  now = millis()
) {

  if (
    !fragment.carried
    ||
    fragment.carryPersistenceStartedAt === null
    ||
    fragment.carryPersistenceDepleted
  ) {

    return fragment.carryPersistenceDepleted
      ? 0
      : 1;
  }

  if (
    fragment.sourceType !== "human"
    &&
    fragment.sourceType !== "ai"
  ) {

    fragment.carryPersistenceDepleted = true;
    fragment.carryPersistenceOpacity = 0;
    return 0;
  }

  let persistence =
    getParamsForSourceType(
      fragment.sourceType
    ).persistence;

  let clampedPersistence =
    constrain(
      persistence,
      0,
      1
    );

  let duration = lerp(
    CARRY_PERSISTENCE_DURATION_MIN_MS,
    CARRY_PERSISTENCE_DURATION_MAX_MS,
    pow(
      clampedPersistence,
      CARRY_PERSISTENCE_DURATION_CURVE
    )
  );

  let elapsedProgress = constrain(
    (now - fragment.carryPersistenceStartedAt)
    /
    duration,
    0,
    1
  );

  let retentionThreshold =
    lerp(
      0.18,
      0.50,
      clampedPersistence
    )
    *
    lerp(
      0.65,
      1,
      constrain(
        fragment.carryPersistenceRank,
        0,
        1
      )
    );

  let fadeWidth =
    CARRY_PERSISTENCE_FADE_RATIO;

  let fadeStart = max(
    0,
    retentionThreshold - fadeWidth
  );

  let fadeEnd = min(
    1,
    retentionThreshold + fadeWidth
  );

  if (
    elapsedProgress <= fadeStart
  ) {

    return 1;
  }

  if (
    elapsedProgress >= fadeEnd
  ) {

    fragment.carryPersistenceDepleted = true;
    fragment.carryPersistenceOpacity = 0;
    return 0;
  }

  let fadeProgress = constrain(
    (elapsedProgress - fadeStart)
    /
    (fadeEnd - fadeStart),
    0,
    1
  );

  let smoothFade =
    fadeProgress
    *
    fadeProgress
    *
    (3 - 2 * fadeProgress);

  return 1 - smoothFade;
}

function getCarryVisualSettleProgress(
  fragment,
  now = millis()
) {

  if (
    fragment.carryDepthSettleStartedAt === null
    ||
    !fragment.carryVisualSettleNeeded
  ) {

    return 1;
  }

  let progress = constrain(
    (now - fragment.carryDepthSettleStartedAt)
    /
    CARRY_DEPTH_SETTLE_BACK_MS,
    0,
    1
  );

  let smoothProgress =
    progress
    *
    progress
    *
    (3 - 2 * progress);

  return smoothProgress;
}

function getCarryDepthSettleAlpha(
  fragment,
  now = millis()
) {

  let originalAlpha =
    fragment.carryOriginalVisualAlpha
    !== null
      ? fragment.carryOriginalVisualAlpha
      : fragment.baseAlpha;

  let startAlpha =
    fragment.carryVisualBaseAlpha
    !== null
      ? fragment.carryVisualBaseAlpha
      : originalAlpha;

  return lerp(
    startAlpha,
    originalAlpha,
    getCarryVisualSettleProgress(
      fragment,
      now
    )
  );
}

function getCarrySettledVisualDimension(
  fragment,
  dimension,
  now = millis()
) {

  let cutValue =
    dimension === "width"
      ? fragment.carryCutVisualWidth
      : fragment.carryCutVisualHeight;

  let originalValue =
    dimension === "width"
      ? fragment.carryOriginalVisualWidth
      : fragment.carryOriginalVisualHeight;

  return lerp(
    cutValue !== null ? cutValue : fragment[dimension === "width" ? "w" : "h"],
    originalValue !== null
      ? originalValue
      : fragment[dimension === "width" ? "w" : "h"],
    getCarryVisualSettleProgress(
      fragment,
      now
    )
  );
}

function getCarrySettledVisualColor(
  fragment,
  now = millis()
) {

  let cutColor =
    fragment.carryCutVisualColor
    ||
    HUMAN_TEST_COLOR;

  let originalColor =
    fragment.carryOriginalVisualColor
    ||
    cutColor;

  let progress =
    getCarryVisualSettleProgress(
      fragment,
      now
    );

  return [
    lerp(cutColor[0], originalColor[0], progress),
    lerp(cutColor[1], originalColor[1], progress),
    lerp(cutColor[2], originalColor[2], progress)
  ];
}


function initializeIncomingCarryMerge() {

  let incomingCarryFragments =
    fragments.filter(
      (fragment) =>
        fragment.carried
        &&
        !fragment.carryPersistenceDepleted
        &&
        fragment.incomingCarryMerge === null
    );

  if (
    incomingCarryFragments.length === 0
  ) {

    return;
  }

  recordTraceEvent(
    "REENTRY_DETECTED",
    {
      incomingCarry: incomingCarryFragments.length
    }
  );

  let clusterAnchor = {
    x:
      stopX
      +
      map(
        getStableUnit(
          "carry-merge-anchor:" + currentStopId + ":x"
        ),
        0,
        1,
        -GATHER_TARGET_RX * 0.45,
        GATHER_TARGET_RX * 0.45
      ),
    y:
      stopY
      +
      map(
        getStableUnit(
          "carry-merge-anchor:" + currentStopId + ":y"
        ),
        0,
        1,
        -GATHER_TARGET_RY * 0.45,
        GATHER_TARGET_RY * 0.45
      )
  };

  for (
    let i = 0;
    i < fragments.length;
    i++
  ) {

    let fragment = fragments[i];

    if (
      !incomingCarryFragments.includes(
        fragment
      )
    ) {

      continue;
    }

    let target = getIncomingCarryMergeTarget(
      fragment,
      clusterAnchor
    );

    fragment.carryPersistenceOpacity =
      getCarryPersistenceOpacity(
        fragment
      );

    fragment.stopId = currentStopId;

    fragment.incomingCarryMerge = {
      stopId: currentStopId,
      startX: fragment.x,
      startY: fragment.y,
      targetX: target.x,
      targetY: target.y,
      startTime: millis()
    };

    fragment.humanAccumulationLayers = [];
    fragment.aiAccumulationLayers = [];

    if (
      fragment.sourceType === "human"
    ) {

      fragment.humanAccumulationLayers =
        createAccumulationLayerDescriptors(
          fragment.originSourceId
        );
    }

    if (
      fragment.sourceType === "ai"
    ) {

      fragment.aiAccumulationLayers =
        createAccumulationLayerDescriptors(
          fragment.originSourceId
        );
    }
  }
}

function beginNewStop() {

  currentStopId++;


  stopX =
    viewerInputX;


  stopY =
    viewerInputY;


  currentStopFrames = 0;

  currentStopGatheringStartTime = millis();
  currentStopDeepeningStartTime =
    currentStopGatheringStartTime
    +
    GATHERING_DURATION_MS;
  shadowDeepeningProgress = 0;


  // Distance answers only which existing sources belong to this stop.
  // Future gathering/target behavior is intentionally not connected here.
  buildCurrentStopSelection();
  captureSoundStopReference();


  initializeGatheringForStop(
    currentStopGatheringStartTime
  );

  initializeIncomingCarryMerge();


  currentImprint =

    new ResidualImprint(
      stopX,
      stopY
    );


  imprints.push(
    currentImprint
  );

  recordTraceEvent(
    "STOP_BEGIN",
    {
      selectedHuman: currentStopSelection.humanSourceIds.length,
      selectedAI: currentStopSelection.aiSourceIds.length
    }
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

function resolveCarrySourceIdentity(fragment) {

  let handoff =
    leavingVisualStates[leavingVisualStates.length - 1];

  if (
    handoff === undefined
    ||
    handoff.stopId !== currentStopId
  ) {

    return null;
  }

  let nearest = null;
  let nearestDistance = Infinity;

  for (
    let i = 0;
    i < handoff.contributions.length;
    i++
  ) {

    let contribution = handoff.contributions[i];
    let contributionDistance = dist(
      fragment.x,
      fragment.y,
      contribution.x,
      contribution.y
    );

    if (
      contributionDistance < nearestDistance
    ) {

      nearest = contribution;
      nearestDistance = contributionDistance;
    }
  }

  if (
    nearest === null
    ||
    nearestDistance > CARRY_SOURCE_MATCH_MAX_DISTANCE
    ||
    (
      nearest.sourceType !== "human"
      &&
      nearest.sourceType !== "ai"
    )
  ) {

    return null;
  }

  return {
    sourceType: nearest.sourceType,
    originSourceId: nearest.originSourceId
  };
}

function selectCarryCluster(
  candidates,
  targetCount,
  stopId
) {

  if (
    candidates.length === 0
    ||
    targetCount <= 0
  ) {

    return [];
  }

  let remaining = candidates.slice();
  let selected = [];

  let edgeCandidates =
    getCarryEdgeCandidates(
      candidates,
      stopId
    );

  let edgeSeedIndex = floor(
    getStableUnit(
      "carry-cluster-seed:" + stopId
    )
    *
    edgeCandidates.length
  );

  let seedIndex =
    remaining.indexOf(
      edgeCandidates[edgeSeedIndex]
    );

  selected.push(
    remaining.splice(
      seedIndex,
      1
    )[0]
  );

  while (
    selected.length < targetCount
    &&
    remaining.length > 0
  ) {

    let bestIndex = 0;
    let bestDistance = Infinity;
    let bestTie = Infinity;

    for (
      let candidateIndex = 0;
      candidateIndex < remaining.length;
      candidateIndex++
    ) {

      let candidate =
        remaining[candidateIndex];

      let nearestDistance = Infinity;

      for (
        let selectedIndex = 0;
        selectedIndex < selected.length;
        selectedIndex++
      ) {

        let selectedSource =
          selected[selectedIndex];

        let candidateDistance = dist(
          candidate.x,
          candidate.y,
          selectedSource.x,
          selectedSource.y
        );

        nearestDistance = min(
          nearestDistance,
          candidateDistance
        );
      }

      let tie = getStableUnit(
        "carry-cluster-tie:"
        + stopId
        + ":"
        + candidateIndex
      );

      if (
        nearestDistance < bestDistance
        ||
        (
          abs(nearestDistance - bestDistance) < 0.001
          &&
          tie < bestTie
        )
      ) {

        bestIndex = candidateIndex;
        bestDistance = nearestDistance;
        bestTie = tie;
      }
    }

    selected.push(
      remaining.splice(
        bestIndex,
        1
      )[0]
    );
  }

  return selected;
}

function getCarryEdgeCandidates(
  candidates,
  stopId
) {

  if (
    candidates.length <= 1
  ) {

    return candidates.slice();
  }

  let centerX = 0;
  let centerY = 0;

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {

    centerX += candidates[i].x;
    centerY += candidates[i].y;
  }

  centerX /= candidates.length;
  centerY /= candidates.length;

  let scored = [];

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {

    let candidate = candidates[i];
    let neighbourCount = 0;

    for (
      let j = 0;
      j < candidates.length;
      j++
    ) {

      if (
        i === j
      ) {

        continue;
      }

      if (
        dist(
          candidate.x,
          candidate.y,
          candidates[j].x,
          candidates[j].y
        )
        <=
        CARRY_EDGE_NEIGHBOR_RADIUS
      ) {

        neighbourCount++;
      }
    }

    scored.push({
      candidate,
      neighbourCount,
      radialDistance: dist(
        candidate.x,
        candidate.y,
        centerX,
        centerY
      ),
      stableValue: getStableUnit(
        "carry-edge:" + stopId + ":" + i
      )
    });
  }

  scored.sort(
    (a, b) => {
      if (
        a.neighbourCount !== b.neighbourCount
      ) {

        return a.neighbourCount - b.neighbourCount;
      }

      if (
        a.radialDistance !== b.radialDistance
      ) {

        return b.radialDistance - a.radialDistance;
      }

      return a.stableValue - b.stableValue;
    }
  );

  let edgeCount = max(
    1,
    ceil(
      candidates.length * 0.28
    )
  );

  return scored
    .slice(0, edgeCount)
    .map(
      (entry) => entry.candidate
    );
}

function handleLeaveStop() {

  recordTraceEvent("STOP_LEAVE");

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

    recordTraceEvent("RESIDUAL_FROZEN");


    currentImprint = null;
  }


  // =================================================
  // CARRY COUNT
  // =================================================

  let carryCount =
    candidates.length > 0
      ? max(
          1,
          round(
            candidates.length
            *
            CARRY_CLUSTER_RATIO
          )
        )
      : 0;

  carryCount = min(
    carryCount,
    candidates.length
  );

  let carryCluster =
    selectCarryCluster(
      candidates,
      carryCount,
      currentStopId
    );


  // =================================================
  // CARRY A SMALL PART
  // =================================================

  let replacedContributionIndices = [];
  let carryClusterCenterX = 0;
  let carryClusterCenterY = 0;

  for (
    let i = 0;
    i < carryCluster.length;
    i++
  ) {

    carryClusterCenterX += carryCluster[i].x;
    carryClusterCenterY += carryCluster[i].y;
  }

  if (
    carryCluster.length > 0
  ) {

    carryClusterCenterX /= carryCluster.length;
    carryClusterCenterY /= carryCluster.length;
  }

  let sharedCarryT =
    carryCluster.length > 0
      ? carryCluster[0].carryT
      : 0;

  let carryClusterMaxRadius = 0;

  for (
    let i = 0;
    i < carryCluster.length;
    i++
  ) {

    carryClusterMaxRadius = max(
      carryClusterMaxRadius,
      dist(
        carryCluster[i].x,
        carryCluster[i].y,
        carryClusterCenterX,
        carryClusterCenterY
      )
    );
  }

  for (
    let i = 0;
    i < carryCluster.length;
    i++
  ) {

    let chosen =
      carryCluster[i];

    chosen.carryClusterAnchorOffsetX =
      carryClusterCenterX - viewerInputX;

    chosen.carryClusterAnchorOffsetY =
      carryClusterCenterY - viewerInputY;

    chosen.carryClusterLocalOffsetX =
      chosen.x - carryClusterCenterX;

    chosen.carryClusterLocalOffsetY =
      chosen.y - carryClusterCenterY;

    chosen.carryT = sharedCarryT;

    chosen.carryPersistenceStartedAt = millis();
    chosen.carryPersistenceOpacity = 1;
    chosen.carryPersistenceDepleted = false;
    chosen.carryPersistenceRank =
      carryClusterMaxRadius > 0
        ? 1 - dist(
            chosen.x,
            chosen.y,
            carryClusterCenterX,
            carryClusterCenterY
          )
          /
          carryClusterMaxRadius
        : 1;


    // ----------------------------------------------
    // 这里只先标记 carried。
    //
    // 真正开始移动和改变 carried 视觉，
    // 要等 leave hold 结束以后。
    // ----------------------------------------------

    chosen.carried = true;
    chosen.shadowMember = false;

    let handoff =
      leavingVisualStates[leavingVisualStates.length - 1];

    if (
      handoff !== undefined
    ) {

      let matchedContributionIndex = -1;

      for (
        let contributionIndex = 0;
        contributionIndex < handoff.contributions.length;
        contributionIndex++
      ) {

        if (
          handoff.contributions[contributionIndex].fragmentRef
          ===
          chosen
        ) {

          matchedContributionIndex = contributionIndex;
          break;
        }
      }

      if (
        matchedContributionIndex < 0
      ) {

        let nearestDistance = Infinity;

        for (
          let contributionIndex = 0;
          contributionIndex < handoff.contributions.length;
          contributionIndex++
        ) {

          let contribution =
            handoff.contributions[contributionIndex];

          if (
            contribution.replacedByCarry
            ||
            replacedContributionIndices.includes(
              contributionIndex
            )
          ) {

            continue;
          }

          let contributionDistance = dist(
            chosen.x,
            chosen.y,
            contribution.x,
            contribution.y
          );

          if (
            contributionDistance < nearestDistance
          ) {

            matchedContributionIndex = contributionIndex;
            nearestDistance = contributionDistance;
          }
        }
      }

      if (
        matchedContributionIndex >= 0
      ) {

        handoff.contributions[
          matchedContributionIndex
        ].replacedByCarry = true;

        replacedContributionIndices.push(
          matchedContributionIndex
        );

        let matchedContribution =
          handoff.contributions[
            matchedContributionIndex
          ];

        chosen.carryVisualBaseAlpha =
          matchedContribution.alpha;
        chosen.carryCurrentVisualAlpha =
          matchedContribution.alpha;
        chosen.carryCurrentVisualWidth =
          matchedContribution.width;
        chosen.carryCurrentVisualHeight =
          matchedContribution.height;
        chosen.carryCutVisualWidth =
          matchedContribution.width;
        chosen.carryCutVisualHeight =
          matchedContribution.height;
        chosen.carryCutVisualColor = [
          matchedContribution.color[0],
          matchedContribution.color[1],
          matchedContribution.color[2]
        ];
      }
    }

    if (
      chosen.carryVisualBaseAlpha === null
    ) {

      chosen.carryVisualBaseAlpha =
        chosen.baseAlpha;
      chosen.carryCurrentVisualAlpha =
        chosen.baseAlpha;
      chosen.carryCurrentVisualWidth =
        chosen.w;
      chosen.carryCurrentVisualHeight =
        chosen.h;
      chosen.carryCutVisualWidth =
        chosen.w;
      chosen.carryCutVisualHeight =
        chosen.h;
    }

    let carryIdentity =
      resolveCarrySourceIdentity(chosen);

    if (
      carryIdentity !== null
    ) {

      chosen.sourceType =
        carryIdentity.sourceType;

      chosen.originSourceId =
        carryIdentity.originSourceId;

      chosen.carrySourceMode =
        carryIdentity.sourceType === "human"
          ? CARRY_SOURCE_MODE_HUMAN
          : CARRY_SOURCE_MODE_AI;
    }

    else {

      chosen.sourceType = null;
      chosen.originSourceId = null;
      chosen.carrySourceMode = null;
    }

    if (
      chosen.sourceType === "human"
      ||
      chosen.sourceType === "ai"
    ) {

      let originalVisual =
        getShadowVisualState(
          chosen.sourceType,
          0
        );

      chosen.carryOriginalVisualAlpha =
        originalVisual.alpha;
      chosen.carryOriginalVisualWidth =
        chosen.w * originalVisual.sizeMultiplier;
      chosen.carryOriginalVisualHeight =
        chosen.h * originalVisual.sizeMultiplier;
      chosen.carryOriginalVisualColor = [
        originalVisual.color[0],
        originalVisual.color[1],
        originalVisual.color[2]
      ];

      if (
        chosen.carryCutVisualColor === null
      ) {

        chosen.carryCutVisualColor = [
          originalVisual.color[0],
          originalVisual.color[1],
          originalVisual.color[2]
        ];
      }

      chosen.carryVisualSettleNeeded =
        chosen.carryVisualBaseAlpha
        >
        chosen.carryOriginalVisualAlpha
        ||
        chosen.carryCutVisualWidth
        >
        chosen.carryOriginalVisualWidth
        ||
        chosen.carryCutVisualHeight
        >
        chosen.carryOriginalVisualHeight
        ||
        chosen.carryCutVisualColor[0]
        !==
        chosen.carryOriginalVisualColor[0]
        ||
        chosen.carryCutVisualColor[1]
        !==
        chosen.carryOriginalVisualColor[1]
        ||
        chosen.carryCutVisualColor[2]
        !==
        chosen.carryOriginalVisualColor[2];

      chosen.carryDepthSettleStartAlpha =
        chosen.carryVisualBaseAlpha;
      chosen.carryDepthSettleStartedAt =
        millis();

      if (
        !chosen.carryVisualSettleNeeded
      ) {

        chosen.carryCurrentVisualAlpha =
          chosen.carryOriginalVisualAlpha;
        chosen.carryCurrentVisualWidth =
          chosen.carryOriginalVisualWidth;
        chosen.carryCurrentVisualHeight =
          chosen.carryOriginalVisualHeight;
        chosen.carryCurrentVisualColor = [
          chosen.carryOriginalVisualColor[0],
          chosen.carryOriginalVisualColor[1],
          chosen.carryOriginalVisualColor[2]
        ];
      }
    }


  }


  // =================================================
  // MOST REMAIN
  // =================================================

  if (
    carryCluster.length > 0
  ) {

    recordTraceEvent(
      "CARRY_ASSIGNED",
      {
        assigned: carryCluster.length,
        carried: countCarriedFragments()
      }
    );
  }

    for (
      let i = 0;
      i < candidates.length;
      i++
    ) {

    if (
      candidates[i].carried
    ) {

      continue;
    }

    candidates[i].shadowMember = false;

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

  recordTraceEvent(
    "STOP_SUMMARY",
    {
      stayedSeconds: Number(actualStaySeconds.toFixed(1)),
      finalMemorySeconds: Number(memorySeconds.toFixed(1)),
      assignedCarry: carryCount
    }
  );
}


// ==================================================
// VIEWER STATE
// ==================================================

function updateViewerState() {

  let stateBefore = viewerState;
  let inside = viewerInputInside;

  viewerDX = viewerInputDX;
  viewerDY = viewerInputDY;
  viewerSpeed = viewerInputSpeed;


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
      cameraStillStartedAt = 0;


      viewerState =
        "MOVING";
    }


    // =================================================
    // ALMOST STILL
    // =================================================

    else if (viewerInputSource === "camera") {

      if (
        cameraMotionAmount
        >
        CAMERA_MOTION_HIGH_THRESHOLD
      ) {

        stillFrames = 0;
        cameraStillStartedAt = 0;
        viewerState = "MOVING";
      }

      else if (
        cameraMotionAmount
        <
        CAMERA_MOTION_LOW_THRESHOLD
      ) {

        if (
          cameraStillStartedAt === 0
        ) {

          cameraStillStartedAt = millis();
        }

        stillFrames++;

        if (
          millis() - cameraStillStartedAt
          >= CAMERA_STAY_CONFIRMATION_MS
        ) {

          viewerState = "STAYING";
        }
      }
    }

    else if (
      viewerInputSpeed < MOVE_THRESHOLD
    ) {

      cameraStillStartedAt = 0;
      stillFrames++;

      if (
        stillFrames >= STILL_THRESHOLD
      ) {

        viewerState = "STAYING";
      }

      else {

        viewerState = "MOVING";
      }
    }


    // =================================================
    // MOVING AGAIN
    // =================================================

    else {

      stillFrames = 0;
      cameraStillStartedAt = 0;


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
    cameraStillStartedAt = 0;
  }


  viewerWasInside =
    inside;

  if (
    viewerState !== stateBefore
  ) {

    recordTraceEvent(
      "STATE_CHANGE",
      {
        from: stateBefore,
        to: viewerState
      }
    );
  }


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
      &&
      !fragments[i].carryPersistenceDepleted
    ) {

      count++;
    }
  }


  return count;
}
