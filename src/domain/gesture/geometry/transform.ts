import type { GesturePoint } from "@/types";

export const centroid = (points: GesturePoint[]): GesturePoint => {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
};

export const translateTo = (
  points: GesturePoint[],
  origin: GesturePoint,
): GesturePoint[] =>
  points.map((point) => ({
    x: point.x - origin.x,
    y: point.y - origin.y,
  }));

export const scaleTo = (points: GesturePoint[], size: number): GesturePoint[] => {
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
