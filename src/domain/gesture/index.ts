export {
  bearingDelta,
  pathBBox,
  pathLength,
  pathTurning,
  resample,
  sharpTurnCount,
  simplifyGesturePath,
  startEndBearing,
} from "./geometry";
export {
  normalizeGesturePreview,
  normalizeGestureTemplate,
  pathBendSignature,
  rawPathLength,
  significantCornerCount,
} from "./template";
export { matchGestureScore, passesShapeChecks } from "./match";
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
