import type { GesturePoint } from "@/types";

import {
  MIN_SIMPLIFY_EPSILON,
  SIMPLIFY_EPSILON_RATIO,
} from "@/constants/gesture";

const boundingDiagonal = (points: GesturePoint[]): number => {
  if (points.length === 0) {
    return 0;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
};

const perpendicularDistance = (
  point: GesturePoint,
  lineStart: GesturePoint,
  lineEnd: GesturePoint,
): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq,
    ),
  );
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
};

export const simplifyGesturePath = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length <= 2) {
    return [...points];
  }
  const epsilon = Math.max(
    MIN_SIMPLIFY_EPSILON,
    boundingDiagonal(points) * SIMPLIFY_EPSILON_RATIO,
  );

  const simplify = (segment: GesturePoint[]): GesturePoint[] => {
    if (segment.length <= 2) {
      return [...segment];
    }
    let maxDistance = 0;
    let splitIndex = 0;
    const start = segment[0];
    const end = segment[segment.length - 1];
    for (let index = 1; index < segment.length - 1; index += 1) {
      const distance = perpendicularDistance(segment[index], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        splitIndex = index;
      }
    }
    if (maxDistance <= epsilon) {
      return [start, end];
    }
    const left = simplify(segment.slice(0, splitIndex + 1));
    const right = simplify(segment.slice(splitIndex));
    return [...left.slice(0, -1), ...right];
  };

  return simplify(points);
};
