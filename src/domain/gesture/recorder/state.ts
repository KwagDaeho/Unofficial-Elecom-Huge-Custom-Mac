import type { GesturePoint } from "@/types";

import { appendCanvasPoint, clampCanvasPoint } from "../canvas/clamp";

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
        points: [clampCanvasPoint(action.point)],
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
        const nextPoints = appendCanvasPoint(state.points, action.point);
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
        points: [clampCanvasPoint(action.point)],
      };
    case "ball_delta":
      if (state.mode !== "ball" || !state.recording || state.points.length === 0) {
        return state;
      }
      {
        const last = state.points[state.points.length - 1];
        const nextPoints = appendCanvasPoint(state.points, {
          x: last.x + action.dx,
          y: last.y + action.dy,
        });
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
        points: action.points.map(clampCanvasPoint),
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
