export {
  DEFAULT_GESTURE_MIN_SCORE,
  GESTURE_SQUARE_SIZE,
  GESTURE_TEMPLATE_SIZE,
  MIN_PATH_LENGTH_RATIO,
  MIN_RAW_PATH_LENGTH,
  MIN_TEMPLATE_TURNING,
  MIN_TURNING_RATIO,
  matchGestureScore,
  normalizeGesturePreview,
  normalizeGestureTemplate,
  passesShapeChecks,
  pathBendSignature,
  pathTurning,
  rawPathLength,
  sharpTurnCount,
  significantCornerCount,
} from "./unistroke";
export type { GesturePoint } from "./unistroke";
export {
  canvasRecorderInitial,
  canvasRecorderIsRecording,
  canvasRecorderReduce,
  clientToCanvasPoint,
  CANVAS_RECORDER_HEIGHT,
  CANVAS_RECORDER_WIDTH,
} from "./canvasRecorder";
export type { CanvasRecorderAction, CanvasRecorderState, CanvasRecordMode } from "./canvasRecorder";
export {
  ensureGestureCanvasChannel,
  subscribeGestureCanvasPhase,
} from "./gestureCanvasChannel";
