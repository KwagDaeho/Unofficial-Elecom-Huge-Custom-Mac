import { describe, expect, it } from "vitest";

import {
  DEFAULT_GESTURE_MIN_SCORE,
  GESTURE_TEMPLATE_SIZE,
  matchGestureScore,
  normalizeGestureTemplate,
  passesShapeChecks,
  rawPathLength,
} from "./unistroke";

const makeVShape = (): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= 12; index += 1) {
    points.push({ x: 125 - index * 2.5, y: 50 + index * 7.5 });
  }
  for (let index = 1; index <= 12; index += 1) {
    points.push({ x: 100 + index * 5, y: 140 });
  }
  return points;
};

describe("normalizeGestureTemplate", () => {
  it("resamples a long horizontal stroke without hanging", () => {
    const points = Array.from({ length: 12 }, (_, index) => ({
      x: 91 + index * 8,
      y: 121,
    }));

    const started = performance.now();
    const template = normalizeGestureTemplate(points);
    const elapsed = performance.now() - started;

    expect(template).toHaveLength(GESTURE_TEMPLATE_SIZE);
    expect(elapsed).toBeLessThan(50);
  });

  it("scores a stroke against itself", () => {
    const points = Array.from({ length: 12 }, (_, index) => ({
      x: 91 + index * 8,
      y: 121,
    }));
    const template = normalizeGestureTemplate(points);
    const score = matchGestureScore(points, template);
    expect(score).toBeGreaterThan(0.9);
  });
});

describe("passesShapeChecks", () => {
  it("accepts a full V and rejects partial or wrong shapes", () => {
    const vPoints = makeVShape();
    const template = normalizeGestureTemplate(vPoints);
    const templatePathLength = rawPathLength(vPoints);

    expect(
      passesShapeChecks(vPoints, template, templatePathLength),
    ).toBe(true);
    expect(matchGestureScore(vPoints, template)).toBeGreaterThan(
      DEFAULT_GESTURE_MIN_SCORE,
    );

    const upperLeftLeg = vPoints.slice(0, 13);
    expect(
      passesShapeChecks(upperLeftLeg, template, templatePathLength),
    ).toBe(false);

    const horizontalLeft = Array.from({ length: 20 }, (_, index) => ({
      x: 150 - index * 5,
      y: 100,
    }));
    expect(
      passesShapeChecks(horizontalLeft, template, templatePathLength),
    ).toBe(false);

    const mirroredV = vPoints.map((point) => ({
      x: 250 - point.x,
      y: point.y,
    }));
    expect(
      passesShapeChecks(mirroredV, template, templatePathLength),
    ).toBe(false);
  });
});
