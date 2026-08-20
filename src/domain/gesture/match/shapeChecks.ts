import type { GesturePoint } from "@/types";

import {
  MAX_BEARING_DELTA,
  MAX_CORNER_COUNT_DIFF_RATIO,
  MIN_CORNER_AXIS_RATIO,
  MIN_PATH_LENGTH_RATIO,
  MIN_TEMPLATE_TURNING,
  MIN_TURNING_RATIO,
} from "@/constants/gesture";
import {
  bearingDelta,
  pathBBox,
  pathLength,
  pathTurning,
  simplifyGesturePath,
  startEndBearing,
} from "../geometry";
import {
  normalizeGestureTemplate,
  pathBendSignature,
  significantCornerCount,
} from "../template";

const cornerCountTolerance = (expected: number): number => {
  if (expected <= 1) {
    return 0;
  }
  return Math.max(1, Math.ceil(expected * MAX_CORNER_COUNT_DIFF_RATIO));
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
  if (
    templateAspect >= 0.18 &&
    candidateAspect < templateAspect * MIN_CORNER_AXIS_RATIO
  ) {
    return false;
  }
  return true;
};

const passesBendAndCornerChecks = (
  candidateRaw: GesturePoint[],
  expected: { cornerCount: number; bendSignature: number },
): boolean => {
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

  return true;
};

const passesBearingCheck = (
  candidateRaw: GesturePoint[],
  template: GesturePoint[],
): boolean => {
  const templateBearing = startEndBearing(template);
  const candidateBearing = startEndBearing(normalizeGestureTemplate(candidateRaw));
  if (
    templateBearing !== null &&
    candidateBearing !== null &&
    bearingDelta(templateBearing, candidateBearing) > MAX_BEARING_DELTA
  ) {
    return false;
  }
  return true;
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

  if (!passesBendAndCornerChecks(candidateRaw, expected)) {
    return false;
  }

  if (!passesAxisShapeCheck(candidateRaw, template, expected.cornerCount)) {
    return false;
  }

  return passesBearingCheck(candidateRaw, template);
};

/** Soft penalty applied to point-distance score when shape metadata diverges. */
export const shapeCompatibilityPenalty = (
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

  if (!passesBendAndCornerChecks(candidateRaw, expected)) {
    return 0.5;
  }

  if (!passesAxisShapeCheck(candidateRaw, template, expected.cornerCount)) {
    return 0.5;
  }

  if (!passesBearingCheck(candidateRaw, template)) {
    return 0.5;
  }

  return 1;
};
