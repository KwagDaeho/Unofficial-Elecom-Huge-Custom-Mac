import { describe, expect, it } from "vitest";

import { clientToCanvasPoint } from "../canvas/clientCoords";
import {
  canvasRecorderInitial,
  canvasRecorderIsRecording,
  canvasRecorderReduce,
} from "./state";

describe("canvasRecorderReduce", () => {
  it("commits stroke without per-move reducer updates", () => {
    let state = canvasRecorderInitial();
    state = canvasRecorderReduce(state, {
      type: "begin_pointer",
      point: { x: 10, y: 20 },
      pointerId: 1,
    });
    state = canvasRecorderReduce(state, {
      type: "commit",
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ],
    });
    expect(canvasRecorderIsRecording(state)).toBe(false);
    expect(state.points).toHaveLength(3);
  });

  it("starts and stops pointer stroke", () => {
    let state = canvasRecorderInitial();
    state = canvasRecorderReduce(state, {
      type: "begin_pointer",
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

  it("accumulates pointer-speed ball deltas as-is", () => {
    let state = canvasRecorderInitial();
    state = canvasRecorderReduce(state, {
      type: "start_ball",
      point: { x: 50, y: 60 },
    });
    state = canvasRecorderReduce(state, { type: "ball_delta", dx: 8, dy: -6 });
    state = canvasRecorderReduce(state, { type: "ball_delta", dx: 4, dy: 3 });
    expect(state.points[state.points.length - 1]).toEqual({ x: 62, y: 57 });
    state = canvasRecorderReduce(state, { type: "ball_delta", dx: 20, dy: 0 });
    expect(state.points[state.points.length - 1]).toEqual({ x: 82, y: 57 });
    state = canvasRecorderReduce(state, { type: "stop" });
    expect(state.mode).toBe("idle");
    expect(state.recording).toBe(false);
  });

  it("resumes pointer stroke without clearing existing points", () => {
    let state = canvasRecorderInitial();
    state = canvasRecorderReduce(state, {
      type: "begin_pointer",
      point: { x: 10, y: 20 },
      pointerId: 1,
    });
    state = canvasRecorderReduce(state, {
      type: "move_pointer",
      point: { x: 30, y: 40 },
    });
    state = canvasRecorderReduce(state, { type: "stop" });
    expect(state.points).toHaveLength(2);
    state = canvasRecorderReduce(state, {
      type: "resume_pointer",
      pointerId: 2,
    });
    expect(state.recording).toBe(true);
    expect(state.mode).toBe("pointer");
    expect(state.points).toHaveLength(2);
  });

  it("stop always clears recording even without points", () => {
    const state = canvasRecorderReduce(
      {
        mode: "ball",
        recording: true,
        pointerId: null,
        points: [{ x: 1, y: 1 }],
      },
      { type: "stop" },
    );
    expect(state.mode).toBe("idle");
    expect(state.recording).toBe(false);
  });

  it("maps client coordinates into canvas space with uniform scale", () => {
    const canvas = {
      getBoundingClientRect: () =>
        ({
          left: 100,
          top: 200,
          width: 320,
          height: 220,
          right: 420,
          bottom: 420,
          x: 100,
          y: 200,
          toJSON: () => ({}),
        }) as DOMRect,
    } as HTMLCanvasElement;
    const point = clientToCanvasPoint(110, 210, canvas, false);
    expect(point).toEqual({ x: 10, y: 10 });
  });
});
