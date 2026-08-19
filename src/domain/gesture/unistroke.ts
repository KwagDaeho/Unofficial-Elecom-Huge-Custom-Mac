export type GesturePoint = { x: number; y: number };

export const GESTURE_TEMPLATE_SIZE = 64;
export const GESTURE_SQUARE_SIZE = 250;
export const DEFAULT_GESTURE_MIN_SCORE = 0.72;
export const MIN_RAW_PATH_LENGTH = 24;

const pathLength = (points: GesturePoint[]): number => {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    length += Math.hypot(dx, dy);
  }
  return length;
};

const resample = (points: GesturePoint[], count: number): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  const interval = pathLength(points) / (count - 1);
  let distance = 0;
  const next: GesturePoint[] = [{ ...points[0] }];
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const segment = Math.hypot(current.x - prev.x, current.y - prev.y);
    if (segment <= 0) {
      continue;
    }
    while (distance + segment >= interval) {
      const ratio = (interval - distance) / segment;
      next.push({
        x: prev.x + ratio * (current.x - prev.x),
        y: prev.y + ratio * (current.y - prev.y),
      });
      distance = 0;
    }
    distance += segment;
  }
  while (next.length < count) {
    next.push({ ...points[points.length - 1] });
  }
  return next.slice(0, count);
};

const centroid = (points: GesturePoint[]): GesturePoint => {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
};

const translateTo = (points: GesturePoint[], origin: GesturePoint): GesturePoint[] =>
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

const indicativeAngle = (points: GesturePoint[]): number => {
  const start = points[0];
  const end = points[Math.floor(points.length / 2)];
  return Math.atan2(end.y - start.y, end.x - start.x);
};

const rotateBy = (points: GesturePoint[], radians: number): GesturePoint[] => {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }));
};

export const normalizeGestureTemplate = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  let next = resample(points, GESTURE_TEMPLATE_SIZE);
  next = rotateBy(next, -indicativeAngle(next));
  next = scaleTo(next, GESTURE_SQUARE_SIZE);
  next = translateTo(next, centroid(next));
  return next;
};

const vectorize = (points: GesturePoint[]): number[] => {
  const values: number[] = [];
  for (const point of points) {
    values.push(point.x, point.y);
  }
  return values;
};

const optimalAngle = (candidate: number[], template: number[]): number => {
  let a = -Math.PI / 4;
  let b = Math.PI / 4;
  const delta = Math.PI / 90;
  let x1 = a + (b - a) / 3;
  let f1 = angleDistanceAt(candidate, template, x1);
  let x2 = b - (b - a) / 3;
  let f2 = angleDistanceAt(candidate, template, x2);
  while (Math.abs(b - a) > delta) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = a + (b - a) / 3;
      f1 = angleDistanceAt(candidate, template, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = b - (b - a) / 3;
      f2 = angleDistanceAt(candidate, template, x2);
    }
  }
  return (a + b) / 2;
};

const angleDistanceAt = (
  candidate: number[],
  template: number[],
  angle: number,
): number => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let sum = 0;
  for (let index = 0; index < candidate.length; index += 2) {
    const x = candidate[index] * cos - candidate[index + 1] * sin;
    const y = candidate[index] * sin + candidate[index + 1] * cos;
    const dx = template[index] - x;
    const dy = template[index + 1] - y;
    sum += dx * dx + dy * dy;
  }
  return sum;
};

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
  const angle = optimalAngle(candidateVector, templateVector);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let sum = 0;
  for (let index = 0; index < candidateVector.length; index += 2) {
    const x = candidateVector[index] * cos - candidateVector[index + 1] * sin;
    const y = candidateVector[index] * sin + candidateVector[index + 1] * cos;
    const dx = templateVector[index] - x;
    const dy = templateVector[index + 1] - y;
    sum += dx * dx + dy * dy;
  }
  const halfDiagonal = 0.5 * Math.hypot(GESTURE_SQUARE_SIZE, GESTURE_SQUARE_SIZE);
  const maxDistance = candidateVector.length / 2 * halfDiagonal;
  return Math.max(0, 1 - sum / (maxDistance * maxDistance));
};

export const rawPathLength = (points: GesturePoint[]): number => pathLength(points);
