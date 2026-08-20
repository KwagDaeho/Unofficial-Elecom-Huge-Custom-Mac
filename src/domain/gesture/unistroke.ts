export type GesturePoint = { x: number; y: number };

export const GESTURE_TEMPLATE_SIZE = 64;
export const GESTURE_SQUARE_SIZE = 250;
export const DEFAULT_GESTURE_MIN_SCORE = 0.88;
export const MIN_RAW_PATH_LENGTH = 24;
export const MIN_PATH_LENGTH_RATIO = 0.75;
export const MIN_TURNING_RATIO = 0.85;
export const MIN_TEMPLATE_TURNING = 0.35;
export const MIN_CORNER_ANGLE = Math.PI / 5;
const SIMPLIFY_EPSILON_RATIO = 0.04;
const MIN_SIMPLIFY_EPSILON = 3;
const MAX_CORNER_COUNT_DIFF_RATIO = 0.25;
const MIN_CORNER_AXIS_RATIO = 0.28;
export const MAX_BEARING_DELTA = Math.PI / 3;

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

const PREVIEW_POINT_COUNT = 48;

/** Resample + scale + center. Orientation is preserved (no rotation). */
export const normalizeGestureTemplate = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  let next = resample(points, GESTURE_TEMPLATE_SIZE);
  next = scaleTo(next, GESTURE_SQUARE_SIZE);
  next = translateTo(next, centroid(next));
  return next;
};

/** UI preview — canvas-space resample so thumbnails match what was drawn. */
export const normalizeGesturePreview = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  if (points.length <= PREVIEW_POINT_COUNT) {
    return points.map((point) => ({ ...point }));
  }
  return resample(points, PREVIEW_POINT_COUNT);
};

const boundingDiagonal = (points: GesturePoint[]): number => {
  if (points.length === 0) {
    return 0;
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
  return Math.hypot(maxX - minX, maxY - minY);
};

const perpendicularDistance = (
  point: GesturePoint,
  lineStart: GesturePoint,
  lineEnd: GesturePoint,
): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq,
    ),
  );
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
};

/** Collapse noisy samples so corners/turns reflect shape, not resampling. */
export const simplifyGesturePath = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length <= 2) {
    return [...points];
  }
  const epsilon = Math.max(
    MIN_SIMPLIFY_EPSILON,
    boundingDiagonal(points) * SIMPLIFY_EPSILON_RATIO,
  );

  const simplify = (segment: GesturePoint[]): GesturePoint[] => {
    if (segment.length <= 2) {
      return [...segment];
    }
    let maxDistance = 0;
    let splitIndex = 0;
    const start = segment[0];
    const end = segment[segment.length - 1];
    for (let index = 1; index < segment.length - 1; index += 1) {
      const distance = perpendicularDistance(segment[index], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        splitIndex = index;
      }
    }
    if (maxDistance <= epsilon) {
      return [start, end];
    }
    const left = simplify(segment.slice(0, splitIndex + 1));
    const right = simplify(segment.slice(splitIndex));
    return [...left.slice(0, -1), ...right];
  };

  return simplify(points);
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

const startEndBearing = (points: GesturePoint[]): number | null => {
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

const bearingDelta = (left: number, right: number): number => {
  let diff = Math.abs(left - right);
  if (diff > Math.PI) {
    diff = 2 * Math.PI - diff;
  }
  return diff;
};

const cornerCountTolerance = (expected: number): number => {
  if (expected <= 1) {
    return 0;
  }
  return Math.max(1, Math.ceil(expected * MAX_CORNER_COUNT_DIFF_RATIO));
};

const pathBBox = (points: GesturePoint[]): { width: number; height: number } => {
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

const passesAxisShapeCheck = (
  candidateRaw: GesturePoint[],
  template: GesturePoint[],
  expectedCornerCount: number,
): boolean => {
  if (expectedCornerCount < 1) {
    return true;
  }
  const templateBox = pathBBox(simplifyGesturePath(template));
  const candidateBox = pathBBox(simplifyGesturePath(candidateRaw));
  const templateLong = Math.max(templateBox.width, templateBox.height);
  const templateShort = Math.min(templateBox.width, templateBox.height);
  const candidateLong = Math.max(candidateBox.width, candidateBox.height);
  const candidateShort = Math.min(candidateBox.width, candidateBox.height);
  if (templateLong <= 0 || candidateLong <= 0) {
    return true;
  }
  const templateAspect = templateShort / templateLong;
  const candidateAspect = candidateShort / candidateLong;
  if (templateAspect >= 0.18 && candidateAspect < templateAspect * MIN_CORNER_AXIS_RATIO) {
    return false;
  }
  return true;
};

const expectedShapeMetadata = (
  template: GesturePoint[],
  templateCornerCount: number,
  templateBendSignature: number,
): { cornerCount: number; bendSignature: number } => ({
  cornerCount:
    templateCornerCount > 0
      ? templateCornerCount
      : significantCornerCount(template),
  bendSignature:
    templateBendSignature !== 0
      ? templateBendSignature
      : pathBendSignature(template),
});

const shapeCompatibilityPenalty = (
  candidateRaw: GesturePoint[],
  template: GesturePoint[],
  templateCornerCount = 0,
  templateBendSignature = 0,
): number => {
  const expected = expectedShapeMetadata(
    template,
    templateCornerCount,
    templateBendSignature,
  );

  if (expected.cornerCount >= 1) {
    const candidateCorners = significantCornerCount(candidateRaw);
    const maxDiff = cornerCountTolerance(expected.cornerCount);
    if (candidateCorners < expected.cornerCount - maxDiff) {
      return 0.5;
    }
    if (Math.abs(candidateCorners - expected.cornerCount) > maxDiff) {
      return 0.5;
    }
  }

  if (expected.bendSignature !== 0) {
    const candidateSignature = pathBendSignature(candidateRaw);
    if (
      candidateSignature === 0 ||
      Math.sign(expected.bendSignature) !== Math.sign(candidateSignature)
    ) {
      return 0.5;
    }
  }

  if (
    !passesAxisShapeCheck(
      candidateRaw,
      template,
      expected.cornerCount,
    )
  ) {
    return 0.5;
  }

  const templateBearing = startEndBearing(template);
  const candidateBearing = startEndBearing(
    normalizeGestureTemplate(candidateRaw),
  );
  if (
    templateBearing !== null &&
    candidateBearing !== null &&
    bearingDelta(templateBearing, candidateBearing) > MAX_BEARING_DELTA
  ) {
    return 0.5;
  }

  return 1;
};

export const passesShapeChecks = (
  candidateRaw: GesturePoint[],
  template: GesturePoint[],
  templatePathLength: number,
  templateCornerCount = 0,
  templateBendSignature = 0,
): boolean => {
  if (templatePathLength > 0) {
    const ratio = pathLength(candidateRaw) / templatePathLength;
    if (ratio < MIN_PATH_LENGTH_RATIO) {
      return false;
    }
  }

  const expected = expectedShapeMetadata(
    template,
    templateCornerCount,
    templateBendSignature,
  );

  const templateSimplified = simplifyGesturePath(template);
  const candidateSimplified = simplifyGesturePath(candidateRaw);

  const templateTurning = pathTurning(templateSimplified);
  if (templateTurning >= MIN_TEMPLATE_TURNING) {
    const candidateTurning = pathTurning(candidateSimplified);
    if (candidateTurning / templateTurning < MIN_TURNING_RATIO) {
      return false;
    }
  }

  if (expected.cornerCount >= 1) {
    const candidateCorners = significantCornerCount(candidateRaw);
    const maxDiff = cornerCountTolerance(expected.cornerCount);
    if (candidateCorners < expected.cornerCount - maxDiff) {
      return false;
    }
    if (Math.abs(candidateCorners - expected.cornerCount) > maxDiff) {
      return false;
    }
  }

  if (expected.bendSignature !== 0) {
    const candidateSignature = pathBendSignature(candidateRaw);
    if (
      candidateSignature === 0 ||
      Math.sign(expected.bendSignature) !== Math.sign(candidateSignature)
    ) {
      return false;
    }
  }

  if (
    !passesAxisShapeCheck(
      candidateRaw,
      template,
      expected.cornerCount,
    )
  ) {
    return false;
  }

  const templateBearing = startEndBearing(template);
  const candidateBearing = startEndBearing(
    normalizeGestureTemplate(candidateRaw),
  );
  if (
    templateBearing !== null &&
    candidateBearing !== null &&
    bearingDelta(templateBearing, candidateBearing) > MAX_BEARING_DELTA
  ) {
    return false;
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
  templateCornerCount = 0,
  templateBendSignature = 0,
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
  const pointScore = Math.max(0, 1 - sum / (maxDistance * maxDistance));
  return (
    pointScore *
    shapeCompatibilityPenalty(
      candidateRaw,
      template,
      templateCornerCount,
      templateBendSignature,
    )
  );
};

export const rawPathLength = (points: GesturePoint[]): number => pathLength(points);
