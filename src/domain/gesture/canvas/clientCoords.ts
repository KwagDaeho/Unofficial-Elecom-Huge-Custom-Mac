import type { GesturePoint } from "@/types";

import {
  CANVAS_RECORDER_HEIGHT,
  CANVAS_RECORDER_WIDTH,
} from "@/constants/gestureCanvas";

import { clampCanvasPoint } from "./clamp";

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
