import type { GesturePoint } from "@/types";

import {
  GESTURE_PREVIEW_POINT_COUNT,
  GESTURE_SQUARE_SIZE,
  GESTURE_TEMPLATE_SIZE,
} from "@/constants/gesture";
import { centroid, resample, scaleTo, translateTo } from "../geometry";

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

/** Canvas-space resample so thumbnails match what was drawn. */
export const normalizeGesturePreview = (points: GesturePoint[]): GesturePoint[] => {
  if (points.length === 0) {
    return [];
  }
  if (points.length <= GESTURE_PREVIEW_POINT_COUNT) {
    return points.map((point) => ({ ...point }));
  }
  return resample(points, GESTURE_PREVIEW_POINT_COUNT);
};
