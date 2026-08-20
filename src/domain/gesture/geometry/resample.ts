import type { GesturePoint } from "@/types";

import { pathLength } from "./length";

export const resample = (points: GesturePoint[], count: number): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  if (points.length === 1) {
    return Array.from({ length: count }, () => ({ ...points[0] }));
  }
  const totalLength = pathLength(points);
  const interval = totalLength / (count - 1);
  if (interval <= 0) {
    return Array.from({ length: count }, () => ({ ...points[points.length - 1] }));
  }

  const next: GesturePoint[] = [{ ...points[0] }];
  let carried = 0;
  let index = 1;

  while (index < points.length && next.length < count) {
    const start = points[index - 1];
    let end = points[index];
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let segment = Math.hypot(dx, dy);

    if (segment <= 0) {
      index += 1;
      continue;
    }

    while (carried + segment >= interval && next.length < count) {
      const t = (interval - carried) / segment;
      const sample = {
        x: start.x + t * dx,
        y: start.y + t * dy,
      };
      next.push(sample);
      dx = end.x - sample.x;
      dy = end.y - sample.y;
      segment = Math.hypot(dx, dy);
      carried = 0;
    }

    carried += segment;
    index += 1;
  }

  while (next.length < count) {
    next.push({ ...points[points.length - 1] });
  }
  return next.slice(0, count);
};
