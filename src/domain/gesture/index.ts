export {
  bearingDelta,
  pathBBox,
  pathLength,
  resample,
  startEndBearing,
} from "./geometry";
export {
  extractGestureVector,
  formatGestureVector,
  gestureDisplayPoints,
  matchGestureVector,
  passesGestureVectorChecks,
  quantizeDirection,
  rawPathLength,
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
