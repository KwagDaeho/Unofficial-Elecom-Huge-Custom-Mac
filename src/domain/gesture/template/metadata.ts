import type { GesturePoint } from "@/types";

import { MIN_CORNER_ANGLE } from "@/constants/gesture";
import {
  pathLength,
  sharpTurnCount,
  simplifyGesturePath,
} from "../geometry";

export const rawPathLength = (points: GesturePoint[]): number => pathLength(points);

export const significantCornerCount = (points: GesturePoint[]): number =>
  sharpTurnCount(simplifyGesturePath(points));

/** Signed count of left/right bends at significant corners (mirror detection). */
export const pathBendSignature = (points: GesturePoint[]): number => {
  const simplified = simplifyGesturePath(points);
  if (simplified.length < 3) {
    return 0;
  }
  let signature = 0;
  for (let index = 2; index < simplified.length; index += 1) {
    const v1x = simplified[index - 1].x - simplified[index - 2].x;
    const v1y = simplified[index - 1].y - simplified[index - 2].y;
    const v2x = simplified[index].x - simplified[index - 1].x;
    const v2y = simplified[index].y - simplified[index - 1].y;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 <= 0 || l2 <= 0) {
      continue;
    }
    const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle >= MIN_CORNER_ANGLE) {
      const cross = v1x * v2y - v1y * v2x;
      signature += Math.sign(cross);
    }
  }
  return signature;
};
