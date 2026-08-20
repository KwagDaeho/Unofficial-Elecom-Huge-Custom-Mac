import type { GesturePoint } from "@/types";

export const pathBBox = (
  points: GesturePoint[],
): { width: number; height: number } => {
  if (points.length === 0) {
    return { width: 0, height: 0 };
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
  return { width: maxX - minX, height: maxY - minY };
};
