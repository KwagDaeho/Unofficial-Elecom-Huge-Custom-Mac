import type { GesturePoint } from "@/types";

import { directionUnitVector } from "./directions";
import { extractGestureVector } from "./extract";

/** Build a polyline thumbnail from an 8-way vector template. */
export const vectorToPreviewPoints = (
  directions: number[],
  segmentLengths: number[],
  size: number,
): GesturePoint[] => {
  if (directions.length === 0 || segmentLengths.length === 0) {
    return [];
  }

  const origin = size / 2;
  return vectorToStrokePoints(
    directions,
    segmentLengths,
    { x: origin, y: origin },
    size * 0.76,
  );
};

/** Snap an extracted vector to axis/diagonal segments in pixel space. */
export const vectorToStrokePoints = (
  directions: number[],
  segmentLengths: number[],
  anchor: GesturePoint,
  totalLength: number,
): GesturePoint[] => {
  if (directions.length === 0 || segmentLengths.length === 0) {
    return [anchor];
  }

  let x = anchor.x;
  let y = anchor.y;
  const points: GesturePoint[] = [{ x, y }];

  for (let index = 0; index < directions.length; index += 1) {
    const direction = directions[index] ?? 0;
    const ratio = segmentLengths[index] ?? 0;
    const unit = directionUnitVector(direction);
    const length = ratio * totalLength;
    x += unit.x * length;
    y += unit.y * length;
    points.push({ x, y });
  }

  return points;
};

/** Prefer snapped 8-way stroke for UI; fall back to raw points while drawing. */
export const gestureDisplayPoints = (
  rawPoints: GesturePoint[],
  options?: { snap?: boolean },
): GesturePoint[] => {
  if (rawPoints.length < 2) {
    return rawPoints;
  }
  if (options?.snap === false) {
    return rawPoints;
  }

  const vector = extractGestureVector(rawPoints);
  if (vector.directions.length === 0) {
    return rawPoints;
  }

  return vectorToStrokePoints(
    vector.directions,
    vector.segmentLengths,
    rawPoints[0]!,
    vector.totalLength,
  );
};
