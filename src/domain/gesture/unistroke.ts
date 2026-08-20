export type GesturePoint = { x: number; y: number };

export const GESTURE_TEMPLATE_SIZE = 64;
export const GESTURE_SQUARE_SIZE = 250;
export const DEFAULT_GESTURE_MIN_SCORE = 0.85;
export const MIN_RAW_PATH_LENGTH = 24;
export const MIN_PATH_LENGTH_RATIO = 0.68;
export const MIN_TURNING_RATIO = 0.55;
export const MIN_TEMPLATE_TURNING = 0.35;

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

/** UI preview path — same scale/center as template, but keeps drawn orientation. */
export const normalizeGesturePreview = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  let next = resample(points, GESTURE_TEMPLATE_SIZE);
  next = scaleTo(next, GESTURE_SQUARE_SIZE);
  next = translateTo(next, centroid(next));
  return next;
};

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

export const passesShapeChecks = (
  candidateRaw: GesturePoint[],
  template: GesturePoint[],
  templatePathLength: number,
): boolean => {
  if (templatePathLength > 0) {
    const ratio = pathLength(candidateRaw) / templatePathLength;
    if (ratio < MIN_PATH_LENGTH_RATIO) {
      return false;
    }
  }

  const templateTurning = pathTurning(template);
  if (templateTurning >= MIN_TEMPLATE_TURNING) {
    const candidateTurning = pathTurning(normalizeGestureTemplate(candidateRaw));
    if (candidateTurning / templateTurning < MIN_TURNING_RATIO) {
      return false;
    }
  }

  return true;
};

const vectorize = (points: GesturePoint[]): number[] => {
  const values: number[] = [];
  for (const point of points) {
    values.push(point.x, point.y);
  }
  return values;
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
  let sum = 0;
  for (let index = 0; index < candidateVector.length; index += 2) {
    const dx = templateVector[index] - candidateVector[index];
    const dy = templateVector[index + 1] - candidateVector[index + 1];
    sum += dx * dx + dy * dy;
  }
  const halfDiagonal = 0.5 * Math.hypot(GESTURE_SQUARE_SIZE, GESTURE_SQUARE_SIZE);
  const maxDistance = candidateVector.length / 2 * halfDiagonal;
  return Math.max(0, 1 - sum / (maxDistance * maxDistance));
};

export const rawPathLength = (points: GesturePoint[]): number => pathLength(points);
