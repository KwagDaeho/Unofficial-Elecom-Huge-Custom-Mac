import {
  DEFAULT_GESTURE_MIN_SCORE,
  GESTURE_SQUARE_SIZE,
  GESTURE_TEMPLATE_SIZE,
  MIN_RAW_PATH_LENGTH,
} from "@/constants/gesture";
import type { GesturePoint } from "@/types";

import { pathLength, resample } from "../geometry";

export {
  DEFAULT_GESTURE_MIN_SCORE,
  GESTURE_SQUARE_SIZE,
  GESTURE_TEMPLATE_SIZE,
  MIN_RAW_PATH_LENGTH,
};

const PREVIEW_POINT_COUNT = 48;

const centroid = (points: GesturePoint[]): GesturePoint => {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
};

const translateTo = (
  points: GesturePoint[],
  origin: GesturePoint,
): GesturePoint[] =>
  points.map((point) => ({
    x: point.x - origin.x,
    y: point.y - origin.y,
  }));

const scaleTo = (points: GesturePoint[], size: number): GesturePoint[] => {
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
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = size / Math.max(width, height);
  return points.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));
};

/** Resample + scale + center. Matches guessture / $1 template normalization. */
export const normalizeGestureTemplate = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  let next = resample(points, GESTURE_TEMPLATE_SIZE);
  next = scaleTo(next, GESTURE_SQUARE_SIZE);
  next = translateTo(next, centroid(next));
  return next;
};

/** Canvas-space resample for thumbnails. */
export const normalizeGesturePreview = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  if (points.length <= PREVIEW_POINT_COUNT) {
    return points.map((point) => ({ ...point }));
  }
  return resample(points, PREVIEW_POINT_COUNT);
};

const vectorize = (points: GesturePoint[]): number[] => {
  const values: number[] = [];
  for (const point of points) {
    values.push(point.x, point.y);
  }
  return values;
};

/** $1 path distance converted to a 0–1 similarity score. */
export const matchGestureScore = (
  candidateRaw: GesturePoint[],
  template: GesturePoint[],
): number => {
  if (candidateRaw.length < 2 || template.length < 2) {
    return 0;
  }
  const candidate = normalizeGestureTemplate(candidateRaw);
  const candidateVector = vectorize(candidate);
  const templateVector = vectorize(template);
  let sum = 0;
  for (let index = 0; index < candidateVector.length; index += 2) {
    const dx = templateVector[index]! - candidateVector[index]!;
    const dy = templateVector[index + 1]! - candidateVector[index + 1]!;
    sum += dx * dx + dy * dy;
  }
  const halfDiagonal = 0.5 * Math.hypot(GESTURE_SQUARE_SIZE, GESTURE_SQUARE_SIZE);
  const maxDistance = (candidateVector.length / 2) * halfDiagonal;
  return Math.max(0, 1 - sum / (maxDistance * maxDistance));
};

export const rawPathLength = (points: GesturePoint[]): number => pathLength(points);
