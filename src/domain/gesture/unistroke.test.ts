import { describe, expect, it } from "vitest";

import {
  DEFAULT_GESTURE_MIN_SCORE,
  GESTURE_TEMPLATE_SIZE,
  matchGestureScore,
  normalizeGesturePreview,
  normalizeGestureTemplate,
  passesShapeChecks,
  pathBendSignature,
  rawPathLength,
  significantCornerCount,
} from "./unistroke";
import { gesturePreviewPoints } from "../profile/gesturePreview";
import type { GestureMappingEntry } from "@/types";

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

const makeStaircase = (): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= 10; index += 1) {
    points.push({ x: 40 + index * 10, y: 40 });
  }
  for (let index = 1; index <= 8; index += 1) {
    points.push({ x: 140, y: 40 + index * 10 });
  }
  for (let index = 1; index <= 10; index += 1) {
    points.push({ x: 140 + index * 10, y: 120 });
  }
  for (let index = 1; index <= 8; index += 1) {
    points.push({ x: 240, y: 120 + index * 10 });
  }
  return points;
};

const makeLShape = (): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= 20; index += 1) {
    points.push({ x: 40 + index * 8, y: 60 });
  }
  for (let index = 1; index <= 12; index += 1) {
    points.push({ x: 200, y: 60 + index * 8 });
  }
  return points;
};

const makeReverseLShape = (): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= 12; index += 1) {
    points.push({ x: 80, y: 40 + index * 8 });
  }
  for (let index = 1; index <= 16; index += 1) {
    points.push({ x: 80 + index * 8, y: 136 });
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

describe("normalizeGesturePreview", () => {
  it("keeps canvas proportions for an L-shaped stroke", () => {
    const raw = makeLShape();
    const preview = normalizeGesturePreview(raw);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of preview) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    expect(maxX - minX).toBeGreaterThan(80);
    expect(maxY - minY).toBeGreaterThan(40);
    expect(significantCornerCount(preview)).toBeGreaterThan(0);
  });
});

describe("gesturePreviewPoints", () => {
  it("falls back to template when preview lost corners", () => {
    const raw = makeLShape();
    const entry = {
      id: "test",
      template: normalizeGestureTemplate(raw),
      templatePreview: Array.from({ length: 12 }, (_, index) => ({
        x: 40 + index * 8,
        y: 60,
      })),
      templateCornerCount: significantCornerCount(raw),
      templatePathLength: rawPathLength(raw),
      holdActivator: null,
      click: { kind: "none" },
      longPress: { kind: "none" },
    } satisfies GestureMappingEntry;

    const picked = gesturePreviewPoints(entry);
    expect(significantCornerCount(picked)).toBeGreaterThan(0);
    expect(picked).toEqual(entry.template);
  });
});

describe("passesShapeChecks", () => {
  it("accepts a full V and rejects partial or wrong shapes", () => {
    const vPoints = makeVShape();
    const template = normalizeGestureTemplate(vPoints);
    const templatePathLength = rawPathLength(vPoints);
    const templateCornerCount = significantCornerCount(vPoints);
    const templateBendSignature = pathBendSignature(vPoints);
    const shapeMeta = [
      templatePathLength,
      templateCornerCount,
      templateBendSignature,
    ] as const;

    expect(
      passesShapeChecks(vPoints, template, ...shapeMeta),
    ).toBe(true);
    expect(
      matchGestureScore(vPoints, template, templateCornerCount, templateBendSignature),
    ).toBeGreaterThan(
      DEFAULT_GESTURE_MIN_SCORE,
    );

    const upperLeftLeg = vPoints.slice(0, 13);
    expect(
      passesShapeChecks(upperLeftLeg, template, ...shapeMeta),
    ).toBe(false);

    const horizontalLeft = Array.from({ length: 20 }, (_, index) => ({
      x: 150 - index * 5,
      y: 100,
    }));
    expect(
      passesShapeChecks(horizontalLeft, template, ...shapeMeta),
    ).toBe(false);

    const mirroredV = vPoints.map((point) => ({
      x: 250 - point.x,
      y: point.y,
    }));
    expect(
      passesShapeChecks(mirroredV, template, ...shapeMeta),
    ).toBe(false);
  });

  it("rejects a diagonal stroke against a staircase template", () => {
    const stairs = makeStaircase();
    const template = normalizeGestureTemplate(stairs);
    const templatePathLength = rawPathLength(stairs);

    const diagonal = Array.from({ length: 24 }, (_, index) => ({
      x: 40 + index * 8,
      y: 40 + index * 6,
    }));

    expect(
      passesShapeChecks(diagonal, template, templatePathLength),
    ).toBe(false);
    expect(matchGestureScore(diagonal, template)).toBeLessThan(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });

  it("rejects a straight vertical stroke against an L-shaped template", () => {
    const reverseL = makeReverseLShape();
    const template = normalizeGestureTemplate(reverseL);
    const shapeMeta = [
      rawPathLength(reverseL),
      significantCornerCount(reverseL),
      pathBendSignature(reverseL),
    ] as const;

    const vertical = Array.from({ length: 24 }, (_, index) => ({
      x: 80,
      y: 40 + index * 8,
    }));

    expect(
      passesShapeChecks(vertical, template, ...shapeMeta),
    ).toBe(false);
    expect(matchGestureScore(vertical, template, ...shapeMeta)).toBeLessThan(
      DEFAULT_GESTURE_MIN_SCORE,
    );
  });
});
