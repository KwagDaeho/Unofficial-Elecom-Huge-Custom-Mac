import { describe, expect, it } from "vitest";

import { DEFAULT_GESTURE_MIN_SCORE } from "@/constants/gesture";
import {
  extractGestureVector,
  matchGestureVector,
  passesGestureVectorChecks,
} from "@/domain/gesture";
import type { GesturePoint } from "@/types";

const line = (
  start: GesturePoint,
  end: GesturePoint,
  steps = 12,
): GesturePoint[] => {
  const points: GesturePoint[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    });
  }
  return points;
};

describe("extractGestureVector", () => {
  it("extracts an L-shape as two segments", () => {
    const points = [
      ...line({ x: 0, y: 0 }, { x: 80, y: 0 }),
      ...line({ x: 80, y: 0 }, { x: 80, y: 80 }).slice(1),
    ];
    const vector = extractGestureVector(points);
    expect(vector.directions).toEqual([0, 6]);
    expect(vector.segmentLengths).toHaveLength(2);
    expect(vector.segmentLengths[0]! + vector.segmentLengths[1]!).toBeCloseTo(1, 5);
  });

  it("extracts an L-shape drawn with 2px canvas steps", () => {
    const append = (
      points: GesturePoint[],
      point: GesturePoint,
      minDistance = 2,
    ): GesturePoint[] => {
      const last = points[points.length - 1];
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) {
        return points;
      }
      return [...points, point];
    };

    let points: GesturePoint[] = [{ x: 40, y: 80 }];
    for (let x = 40; x <= 200; x += 2.5) {
      points = append(points, { x, y: 80 });
    }
    for (let y = 80; y <= 160; y += 2.5) {
      points = append(points, { x: 200, y });
    }

    const vector = extractGestureVector(points);
    expect(vector.directions).toEqual([0, 6]);
    expect(Math.round((vector.segmentLengths[0] ?? 0) * 100)).toBeGreaterThan(40);
    expect(Math.round((vector.segmentLengths[1] ?? 0) * 100)).toBeGreaterThan(20);
  });
});

describe("matchGestureVector", () => {
  it("matches similar L-shapes with high score", () => {
    const templatePoints = [
      ...line({ x: 0, y: 0 }, { x: 100, y: 0 }),
      ...line({ x: 100, y: 0 }, { x: 100, y: 70 }).slice(1),
    ];
    const candidatePoints = [
      ...line({ x: 0, y: 0 }, { x: 90, y: 5 }),
      ...line({ x: 90, y: 5 }, { x: 92, y: 65 }).slice(1),
    ];
    const template = extractGestureVector(templatePoints);
    const candidate = extractGestureVector(candidatePoints);
    expect(passesGestureVectorChecks(candidate, template)).toBe(true);
    expect(matchGestureVector(candidate, template)).toBeGreaterThanOrEqual(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });

  it("rejects opposite directions", () => {
    const template = extractGestureVector(
      line({ x: 0, y: 0 }, { x: 100, y: 0 }),
    );
    const candidate = extractGestureVector(
      line({ x: 0, y: 0 }, { x: -100, y: 0 }),
    );
    expect(matchGestureVector(candidate, template)).toBeLessThan(0.5);
  });

  it("rejects strokes that are too short", () => {
    const template = extractGestureVector(
      line({ x: 0, y: 0 }, { x: 100, y: 0 }),
    );
    const candidate = extractGestureVector(
      line({ x: 0, y: 0 }, { x: 10, y: 0 }),
    );
    expect(passesGestureVectorChecks(candidate, template)).toBe(false);
  });

  it("accepts adjacent diagonal drift for a horizontal template", () => {
    const template = extractGestureVector(
      line({ x: 0, y: 0 }, { x: 100, y: 0 }),
    );
    const candidate = extractGestureVector(
      line({ x: 0, y: 0 }, { x: 100, y: -18 }),
    );
    expect(passesGestureVectorChecks(candidate, template)).toBe(true);
    expect(matchGestureVector(candidate, template)).toBeGreaterThanOrEqual(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });

  it("accepts ratio drift on an L-shape", () => {
    const template = extractGestureVector([
      ...line({ x: 0, y: 0 }, { x: 100, y: 0 }),
      ...line({ x: 100, y: 0 }, { x: 100, y: 60 }).slice(1),
    ]);
    const candidate = extractGestureVector([
      ...line({ x: 0, y: 0 }, { x: 110, y: 0 }),
      ...line({ x: 110, y: 0 }, { x: 110, y: 40 }).slice(1),
    ]);
    expect(matchGestureVector(candidate, template)).toBeGreaterThanOrEqual(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });

  it("accepts a V-shape drawn with a cardinal corner (SE, S, E, NE)", () => {
    const template = extractGestureVector([
      ...line({ x: 0, y: 0 }, { x: 70, y: 70 }),
      ...line({ x: 70, y: 70 }, { x: 140, y: 0 }).slice(1),
    ]);
    expect(template.directions).toEqual([7, 1]);

    const candidate = extractGestureVector([
      ...line({ x: 0, y: 0 }, { x: 50, y: 50 }),
      ...line({ x: 50, y: 50 }, { x: 50, y: 62 }).slice(1),
      ...line({ x: 50, y: 62 }, { x: 62, y: 62 }).slice(1),
      ...line({ x: 62, y: 62 }, { x: 130, y: 8 }).slice(1),
    ]);
    expect(passesGestureVectorChecks(candidate, template)).toBe(true);
    expect(matchGestureVector(candidate, template)).toBeGreaterThanOrEqual(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });

  it("accepts explicit cardinal steps between V diagonals", () => {
    const template = {
      directions: [7, 1],
      segmentLengths: [0.5, 0.5],
      totalLength: 100,
    };
    const candidate = {
      directions: [7, 6, 0, 1],
      segmentLengths: [0.42, 0.04, 0.04, 0.5],
      totalLength: 100,
    };
    expect(matchGestureVector(candidate, template)).toBeGreaterThanOrEqual(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });

  it("accepts a V-shape drawn as S then E at the corner", () => {
    const template = extractGestureVector([
      ...line({ x: 0, y: 0 }, { x: 70, y: 70 }),
      ...line({ x: 70, y: 70 }, { x: 140, y: 0 }).slice(1),
    ]);
    const candidate = extractGestureVector([
      ...line({ x: 0, y: 0 }, { x: 60, y: 60 }),
      ...line({ x: 60, y: 60 }, { x: 60, y: 72 }).slice(1),
      ...line({ x: 60, y: 72 }, { x: 135, y: 5 }).slice(1),
    ]);
    expect(matchGestureVector(candidate, template)).toBeGreaterThanOrEqual(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });

  it("rejects lowercase y (SW, NE, SE) against V (SE, NE)", () => {
    const template = {
      directions: [7, 1],
      segmentLengths: [0.5, 0.5],
      totalLength: 100,
    };
    const candidate = {
      directions: [5, 1, 7],
      segmentLengths: [0.33, 0.34, 0.33],
      totalLength: 100,
    };
    expect(matchGestureVector(candidate, template)).toBe(0);
  });

  it("rejects uppercase Y (SE, NE, SW) against V (SE, NE)", () => {
    const template = {
      directions: [7, 1],
      segmentLengths: [0.5, 0.5],
      totalLength: 100,
    };
    const candidate = {
      directions: [7, 1, 5],
      segmentLengths: [0.33, 0.34, 0.33],
      totalLength: 100,
    };
    expect(matchGestureVector(candidate, template)).toBe(0);
  });
});
