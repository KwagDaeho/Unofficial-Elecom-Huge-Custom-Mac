import type { GesturePoint } from "./unistroke";

export type CanvasRecordMode = "idle" | "pointer" | "ball";

export type CanvasRecorderState = {
  mode: CanvasRecordMode;
  recording: boolean;
  points: GesturePoint[];
  pointerId: number | null;
};

export const canvasRecorderInitial = (): CanvasRecorderState => ({
  mode: "idle",
  recording: false,
  points: [],
  pointerId: null,
});

export const canvasRecorderIsRecording = (state: CanvasRecorderState): boolean =>
  state.recording;

export type CanvasRecorderAction =
  | { type: "clear" }
  | { type: "begin_pointer"; point: GesturePoint; pointerId: number }
  | { type: "resume_pointer"; pointerId: number }
  | { type: "move_pointer"; point: GesturePoint }
  | { type: "start_ball"; point: GesturePoint }
  | { type: "ball_delta"; dx: number; dy: number }
  | { type: "commit"; points: GesturePoint[] }
  | { type: "stop" };

const clampPoint = (point: GesturePoint): GesturePoint => ({
  x: Math.max(0, Math.min(320, point.x)),
  y: Math.max(0, Math.min(220, point.y)),
});

const appendPoint = (
  points: GesturePoint[],
  point: GesturePoint,
  minDistance = 3,
): GesturePoint[] => {
  const last = points[points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) {
    return points;
  }
  return [...points, point];
};

export const canvasRecorderReduce = (
  state: CanvasRecorderState,
  action: CanvasRecorderAction,
): CanvasRecorderState => {
  switch (action.type) {
    case "clear":
      return canvasRecorderInitial();
    case "begin_pointer":
      return {
        mode: "pointer",
        recording: true,
        pointerId: action.pointerId,
        points: [clampPoint(action.point)],
      };
    case "resume_pointer":
      if (state.points.length === 0) {
        return state;
      }
      return {
        ...state,
        mode: "pointer",
        recording: true,
        pointerId: action.pointerId,
      };
    case "move_pointer":
      if (state.mode !== "pointer" || !state.recording) {
        return state;
      }
      {
        const nextPoints = appendPoint(state.points, clampPoint(action.point));
        if (nextPoints === state.points) {
          return state;
        }
        return {
          ...state,
          points: nextPoints,
        };
      }
    case "start_ball":
      return {
        mode: "ball",
        recording: true,
        pointerId: null,
        points: [clampPoint(action.point)],
      };
    case "ball_delta":
      if (state.mode !== "ball" || !state.recording || state.points.length === 0) {
        return state;
      }
      {
        const last = state.points[state.points.length - 1];
        const next = {
          x: last.x + action.dx,
          y: last.y + action.dy,
        };
        const nextPoints = appendPoint(state.points, next);
        if (nextPoints === state.points) {
          return state;
        }
        return {
          ...state,
          points: nextPoints,
        };
      }
    case "commit":
      return {
        mode: "idle",
        recording: false,
        pointerId: null,
        points: action.points.map(clampPoint),
      };
    case "stop":
      if (!state.recording && state.mode === "idle") {
        return state;
      }
      return {
        ...state,
        mode: "idle",
        recording: false,
        pointerId: null,
      };
    default:
      return state;
  }
};

export {
  CANVAS_RECORDER_WIDTH,
  CANVAS_RECORDER_HEIGHT,
  CANVAS_MIN_POINT_DISTANCE,
  clientToCanvasPoint,
} from "./gestureCanvasPaint";
