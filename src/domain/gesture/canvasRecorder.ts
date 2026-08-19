import type { GesturePoint } from "./unistroke";

export type CanvasRecordMode = "idle" | "pointer" | "ball";

export type CanvasRecorderState = {
  mode: CanvasRecordMode;
  points: GesturePoint[];
  pointerId: number | null;
};

export const CANVAS_RECORDER_WIDTH = 320;
export const CANVAS_RECORDER_HEIGHT = 220;
export const CANVAS_MIN_POINT_DISTANCE = 3;
/** HID ball deltas are much larger than canvas pixels — scale for preview/recording. */
export const BALL_CANVAS_DELTA_SCALE = 0.4;

export const canvasRecorderInitial = (): CanvasRecorderState => ({
  mode: "idle",
  points: [],
  pointerId: null,
});

export const canvasRecorderIsRecording = (state: CanvasRecorderState): boolean =>
  state.mode !== "idle";

const appendPoint = (
  points: GesturePoint[],
  point: GesturePoint,
  minDistance = CANVAS_MIN_POINT_DISTANCE,
): GesturePoint[] => {
  const last = points[points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) {
    return points;
  }
  return [...points, point];
};

const clampPoint = (point: GesturePoint): GesturePoint => ({
  x: Math.max(0, Math.min(CANVAS_RECORDER_WIDTH, point.x)),
  y: Math.max(0, Math.min(CANVAS_RECORDER_HEIGHT, point.y)),
});

export type CanvasRecorderAction =
  | { type: "clear" }
  | { type: "start_pointer"; point: GesturePoint; pointerId: number }
  | { type: "move_pointer"; point: GesturePoint }
  | { type: "start_ball"; point: GesturePoint }
  | { type: "ball_delta"; dx: number; dy: number }
  | { type: "stop" };

export const canvasRecorderReduce = (
  state: CanvasRecorderState,
  action: CanvasRecorderAction,
): CanvasRecorderState => {
  switch (action.type) {
    case "clear":
      return canvasRecorderInitial();
    case "start_pointer":
      return {
        mode: "pointer",
        pointerId: action.pointerId,
        points: [clampPoint(action.point)],
      };
    case "move_pointer":
      if (state.mode !== "pointer") {
        return state;
      }
      return {
        ...state,
        points: appendPoint(state.points, clampPoint(action.point)),
      };
    case "start_ball":
      return {
        mode: "ball",
        pointerId: null,
        points: [clampPoint(action.point)],
      };
    case "ball_delta":
      if (state.mode !== "ball" || state.points.length === 0) {
        return state;
      }
      {
        const last = state.points[state.points.length - 1];
        const next = clampPoint({
          x: last.x + action.dx * BALL_CANVAS_DELTA_SCALE,
          y: last.y + action.dy * BALL_CANVAS_DELTA_SCALE,
        });
        return {
          ...state,
          points: appendPoint(state.points, next),
        };
      }
    case "stop":
      return {
        ...state,
        mode: "idle",
        pointerId: null,
      };
    default:
      return state;
  }
};

export const clientToCanvasPoint = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  clamp = false,
): GesturePoint | null => {
  if (
    !clamp &&
    (clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom)
  ) {
    return null;
  }
  const scaleX = CANVAS_RECORDER_WIDTH / rect.width;
  const scaleY = CANVAS_RECORDER_HEIGHT / rect.height;
  return clampPoint({
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  });
};
