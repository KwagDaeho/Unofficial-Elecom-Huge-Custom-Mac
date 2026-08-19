import { describe, expect, it } from "vitest";

import {
  canvasRecorderInitial,
  canvasRecorderIsRecording,
  canvasRecorderReduce,
  clientToCanvasPoint,
} from "./canvasRecorder";

describe("canvasRecorderReduce", () => {
  it("starts and stops pointer stroke", () => {
    let state = canvasRecorderInitial();
    state = canvasRecorderReduce(state, {
      type: "start_pointer",
      point: { x: 10, y: 20 },
      pointerId: 1,
    });
    expect(canvasRecorderIsRecording(state)).toBe(true);
    expect(state.mode).toBe("pointer");
    state = canvasRecorderReduce(state, {
      type: "move_pointer",
      point: { x: 30, y: 40 },
    });
    expect(state.points).toHaveLength(2);
    state = canvasRecorderReduce(state, { type: "stop" });
    expect(canvasRecorderIsRecording(state)).toBe(false);
    expect(state.points).toHaveLength(2);
  });

  it("starts ball stroke on L phase and appends raw deltas", () => {
    let state = canvasRecorderInitial();
    state = canvasRecorderReduce(state, {
      type: "start_ball",
      point: { x: 50, y: 60 },
    });
    state = canvasRecorderReduce(state, { type: "ball_delta", dx: 8, dy: -6 });
    state = canvasRecorderReduce(state, { type: "ball_delta", dx: 4, dy: 3 });
    expect(state.points[state.points.length - 1]).toEqual({ x: 53.2, y: 57.6 });
    state = canvasRecorderReduce(state, { type: "ball_delta", dx: 20, dy: 0 });
    expect(state.points[state.points.length - 1]).toEqual({ x: 61.2, y: 57.6 });
    state = canvasRecorderReduce(state, { type: "stop" });
    expect(state.mode).toBe("idle");
  });

  it("stop always clears recording mode even without points", () => {
    const state = canvasRecorderReduce(
      { mode: "ball", pointerId: null, points: [{ x: 1, y: 1 }] },
      { type: "stop" },
    );
    expect(state.mode).toBe("idle");
  });

  it("maps client coordinates into canvas space", () => {
    const point = clientToCanvasPoint(110, 210, {
      left: 100,
      top: 200,
      width: 200,
      height: 100,
      right: 300,
      bottom: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect);
    expect(point).toEqual({ x: 16, y: 22 });
  });
});
