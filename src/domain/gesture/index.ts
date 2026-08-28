export {
  bearingDelta,
  pathBBox,
  pathLength,
  resample,
  startEndBearing,
} from "./geometry";
export {
  DEFAULT_GESTURE_MIN_SCORE,
  GESTURE_SQUARE_SIZE,
  GESTURE_TEMPLATE_SIZE,
  matchGestureScore,
  MIN_RAW_PATH_LENGTH,
  normalizeGesturePreview,
  normalizeGestureTemplate,
  rawPathLength,
} from "./dollar";
export {
  extractGestureVector,
  formatGestureVector,
  gestureDisplayPoints,
  matchGestureVector,
  passesGestureVectorChecks,
  quantizeDirection,
  resolveGestureVector,
  vectorToPreviewPoints,
  type GestureVector,
} from "./vector";
export {
  appendCanvasPoint,
  clientToCanvasPoint,
  emitGestureCanvasUiChange,
  ensureGestureCanvasChannel,
  paintGestureCanvas,
  paintGestureStroke,
  subscribeGestureCanvasPhase,
  subscribeGestureCanvasUiChange,
} from "./canvas";
export type { GestureCanvasUiDetail, GestureDrawPhase } from "./canvas";
export {
  canvasRecorderInitial,
  canvasRecorderIsRecording,
  canvasRecorderReduce,
} from "./recorder";
export type {
  CanvasRecordMode,
  CanvasRecorderAction,
  CanvasRecorderState,
} from "./recorder";

export type { GesturePoint } from "@/types";
