import type { GesturePoint } from "@/types";

export const pathLength = (points: GesturePoint[]): number => {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    length += Math.hypot(dx, dy);
  }
  return length;
};
