import type { GesturePoint } from "./unistroke";

export const CANVAS_RECORDER_WIDTH = 320;
export const CANVAS_RECORDER_HEIGHT = 220;
export const CANVAS_MIN_POINT_DISTANCE = 2;
/** HUGE ball HID counts → canvas px (template draw; not OS pointer speed). */
export const CANVAS_BALL_DELTA_SCALE = 0.45;

export const CANVAS_BG = "#ffffff";
export const CANVAS_STROKE = "#c07bc4";
export const CANVAS_GUIDE = "#6b6270";

export const clampCanvasPoint = (point: GesturePoint): GesturePoint => ({
  x: Math.max(0, Math.min(CANVAS_RECORDER_WIDTH, point.x)),
  y: Math.max(0, Math.min(CANVAS_RECORDER_HEIGHT, point.y)),
});

export const appendCanvasPoint = (
  points: GesturePoint[],
  point: GesturePoint,
  minDistance = CANVAS_MIN_POINT_DISTANCE,
): GesturePoint[] => {
  const clamped = clampCanvasPoint(point);
  const last = points[points.length - 1];
  if (
    last &&
    Math.hypot(clamped.x - last.x, clamped.y - last.y) < minDistance
  ) {
    return points;
  }
  return [...points, clamped];
};

const drawStrokeAtCoords = (
  context: CanvasRenderingContext2D,
  points: GesturePoint[],
  lineWidth = 2.5,
) => {
  if (points.length < 2) {
    return;
  }
  context.strokeStyle = CANVAS_STROKE;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.stroke();
};

/** Live recorder canvas — 1:1 with pointer/ball coordinates (no bbox zoom). */
export const paintGestureCanvas = (
  context: CanvasRenderingContext2D,
  points: GesturePoint[],
  hint?: string,
) => {
  context.clearRect(0, 0, CANVAS_RECORDER_WIDTH, CANVAS_RECORDER_HEIGHT);
  context.fillStyle = CANVAS_BG;
  context.fillRect(0, 0, CANVAS_RECORDER_WIDTH, CANVAS_RECORDER_HEIGHT);
  if (points.length === 0) {
    if (hint) {
      context.fillStyle = CANVAS_GUIDE;
      context.font = "13px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        hint,
        CANVAS_RECORDER_WIDTH / 2,
        CANVAS_RECORDER_HEIGHT / 2,
        CANVAS_RECORDER_WIDTH - 24,
      );
    }
    return;
  }
  if (points.length === 1) {
    context.fillStyle = CANVAS_STROKE;
    context.beginPath();
    context.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2);
    context.fill();
    return;
  }
  drawStrokeAtCoords(context, points);
};

/** Thumbnail / hover preview — scale normalized template to fit a square viewport. */
export const paintGestureStroke = (
  context: CanvasRenderingContext2D,
  points: GesturePoint[],
  hint?: string,
  width = CANVAS_RECORDER_WIDTH,
  height = CANVAS_RECORDER_HEIGHT,
) => {
  if (points.length === 0) {
    if (hint) {
      context.fillStyle = CANVAS_GUIDE;
      context.font = "13px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(hint, width / 2, height / 2, width - 24);
    }
    return;
  }
  if (points.length === 1) {
    const scale = Math.min(width / CANVAS_RECORDER_WIDTH, height / CANVAS_RECORDER_HEIGHT);
    context.fillStyle = CANVAS_STROKE;
    context.beginPath();
    context.arc(width / 2, height / 2, 3 * scale, 0, Math.PI * 2);
    context.fill();
    return;
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
  const pad = Math.max(8, Math.min(width, height) * 0.14);
  const dataWidth = Math.max(maxX - minX, 1);
  const dataHeight = Math.max(maxY - minY, 1);
  const scale = Math.min((width - pad * 2) / dataWidth, (height - pad * 2) / dataHeight);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const toScreen = (point: GesturePoint): GesturePoint => ({
    x: width / 2 + (point.x - centerX) * scale,
    y: height / 2 + (point.y - centerY) * scale,
  });

  const screenPoints = points.map(toScreen);
  drawStrokeAtCoords(context, screenPoints, Math.max(1.5, 2.5 * scale));
};

export const clientToCanvasPoint = (
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  clamp = false,
): GesturePoint | null => {
  const rect = canvas.getBoundingClientRect();
  const displayScale = Math.min(
    rect.width / CANVAS_RECORDER_WIDTH,
    rect.height / CANVAS_RECORDER_HEIGHT,
  );
  if (displayScale <= 0) {
    return null;
  }
  const renderedWidth = CANVAS_RECORDER_WIDTH * displayScale;
  const renderedHeight = CANVAS_RECORDER_HEIGHT * displayScale;
  const offsetX = rect.left + (rect.width - renderedWidth) / 2;
  const offsetY = rect.top + (rect.height - renderedHeight) / 2;
  const x = (clientX - offsetX) / displayScale;
  const y = (clientY - offsetY) / displayScale;

  if (
    !clamp &&
    (x < 0 || x > CANVAS_RECORDER_WIDTH || y < 0 || y > CANVAS_RECORDER_HEIGHT)
  ) {
    return null;
  }
  return clampCanvasPoint({ x, y });
};
