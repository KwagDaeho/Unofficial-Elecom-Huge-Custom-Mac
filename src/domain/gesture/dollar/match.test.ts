import { describe, expect, it } from "vitest";

import {
  DEFAULT_GESTURE_MIN_SCORE,
  matchGestureScore,
  normalizeGestureTemplate,
} from "@/domain/gesture/dollar";

const line = (steps: number, dx: number, dy: number) =>
  Array.from({ length: steps + 1 }, (_, index) => ({
    x: index * dx,
    y: index * dy,
  }));

describe("matchGestureScore", () => {
  it("matches the same stroke at different scales", () => {
    const template = normalizeGestureTemplate(line(20, 8, 0));
    const candidate = line(20, 4, 0);
    expect(matchGestureScore(candidate, template)).toBeGreaterThanOrEqual(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });
});
