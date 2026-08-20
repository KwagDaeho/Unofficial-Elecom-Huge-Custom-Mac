import type { GesturePoint } from "@/types";

import {
  CANVAS_MIN_POINT_DISTANCE,
  CANVAS_RECORDER_HEIGHT,
  CANVAS_RECORDER_WIDTH,
} from "@/constants/gestureCanvas";

export const clampCanvasPoint = (point: GesturePoint): GesturePoint => ({
  x: Math.max(0, Math.min(CANVAS_RECORDER_WIDTH, point.x)),
  y: Math.max(0, Math.min(CANVAS_RECORDER_HEIGHT, point.y)),
});

export const appendCanvasPoint = (
  points: GesturePoint[],
  point: GesturePoint,
  minDistance = CANVAS_MIN_POINT_DISTANCE,
): GesturePoint[] => {
  const clamped = clampCanvasPoint(point);
  const last = points[points.length - 1];
  if (last && Math.hypot(clamped.x - last.x, clamped.y - last.y) < minDistance) {
    return points;
  }
  return [...points, clamped];
};
