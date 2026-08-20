import type { GesturePoint } from "@/types";

export const startEndBearing = (points: GesturePoint[]): number | null => {
  if (points.length < 2) {
    return null;
  }
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.hypot(dx, dy) < 1) {
    return null;
  }
  return Math.atan2(dy, dx);
};

export const bearingDelta = (left: number, right: number): number => {
  let diff = Math.abs(left - right);
  if (diff > Math.PI) {
    diff = 2 * Math.PI - diff;
  }
  return diff;
};
