import type { GesturePoint } from "@/types";

import { MIN_CORNER_ANGLE } from "@/constants/gesture";

export const pathTurning = (points: GesturePoint[]): number => {
  if (points.length < 3) {
    return 0;
  }
  let turning = 0;
  for (let index = 2; index < points.length; index += 1) {
    const v1x = points[index - 1].x - points[index - 2].x;
    const v1y = points[index - 1].y - points[index - 2].y;
    const v2x = points[index].x - points[index - 1].x;
    const v2y = points[index].y - points[index - 1].y;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 <= 0 || l2 <= 0) {
      continue;
    }
    const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
    turning += Math.acos(Math.max(-1, Math.min(1, dot)));
  }
  return turning;
};

export const sharpTurnCount = (
  points: GesturePoint[],
  minAngle = MIN_CORNER_ANGLE,
): number => {
  if (points.length < 3) {
    return 0;
  }
  let count = 0;
  for (let index = 2; index < points.length; index += 1) {
    const v1x = points[index - 1].x - points[index - 2].x;
    const v1y = points[index - 1].y - points[index - 2].y;
    const v2x = points[index].x - points[index - 1].x;
    const v2y = points[index].y - points[index - 1].y;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 <= 0 || l2 <= 0) {
      continue;
    }
    const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle >= minAngle) {
      count += 1;
    }
  }
  return count;
};
