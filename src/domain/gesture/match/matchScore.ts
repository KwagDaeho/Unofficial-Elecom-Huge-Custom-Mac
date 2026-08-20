import type { GesturePoint } from "@/types";

import { GESTURE_SQUARE_SIZE } from "@/constants/gesture";
import { normalizeGestureTemplate } from "../template";
import { shapeCompatibilityPenalty } from "./shapeChecks";

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
  const maxDistance = (candidateVector.length / 2) * halfDiagonal;
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
