import {
  ADJACENT_DIRECTION_MATCH_SCORE,
  DIRECTION_SCORE_WEIGHT,
  LENGTH_RATIO_TOLERANCE,
  LENGTH_SCORE_WEIGHT,
  MIN_PATH_LENGTH_RATIO,
  MIN_SEGMENT_LENGTH_RATIO,
} from "@/constants/gesture";

import { directionsCompatible, isCardinalDirection } from "./directions";
import type { GestureVector } from "./extract";
import { normalizeGestureVector } from "./normalize";

type TemplateAlignment = {
  templateIndex: number;
  candidateRatio: number;
  directionQuality: number;
};

const directionMatchQuality = (
  candidateDirection: number,
  templateDirection: number,
): number => {
  if (candidateDirection === templateDirection) {
    return 1;
  }
  if (directionsCompatible(candidateDirection, templateDirection)) {
    return ADJACENT_DIRECTION_MATCH_SCORE;
  }
  return 0;
};

const isShortSegment = (
  vector: GestureVector,
  index: number,
  scale = 1,
): boolean => {
  return (vector.segmentLengths[index] ?? 0) < MIN_SEGMENT_LENGTH_RATIO * scale;
};

/** Noise before the current template leg anchor — never skip the next leg early. */
const skipBeforeLegAnchor = (
  candidate: GestureVector,
  candidateIndex: number,
  templateDirection: number,
  allowCardinalBridge: boolean,
): boolean => {
  const candidateDirection = candidate.directions[candidateIndex]!;
  if (allowCardinalBridge && isCardinalDirection(candidateDirection)) {
    return true;
  }
  if (directionsCompatible(candidateDirection, templateDirection)) {
    return true;
  }
  return isShortSegment(candidate, candidateIndex, 1.5);
};

/** Corner detours between the current leg and the next template leg. */
const skipBetweenLegs = (
  candidate: GestureVector,
  candidateIndex: number,
  templateDirection: number,
  nextTemplateDirection: number,
): boolean => {
  const candidateDirection = candidate.directions[candidateIndex]!;
  if (isCardinalDirection(candidateDirection)) {
    return true;
  }
  if (directionsCompatible(candidateDirection, templateDirection)) {
    return true;
  }
  if (directionsCompatible(candidateDirection, nextTemplateDirection)) {
    return true;
  }
  return isShortSegment(candidate, candidateIndex, 1.5);
};

const countSignificantDiagonalLegs = (vector: GestureVector): number => {
  let count = 0;
  for (let index = 0; index < vector.directions.length; index += 1) {
    const direction = vector.directions[index]!;
    if (isCardinalDirection(direction)) {
      continue;
    }
    if (isShortSegment(vector, index)) {
      continue;
    }
    count += 1;
  }
  return count;
};

const hasSignificantExtraLegs = (
  candidate: GestureVector,
  startIndex: number,
): boolean => {
  for (let index = startIndex; index < candidate.directions.length; index += 1) {
    if (!isShortSegment(candidate, index)) {
      return true;
    }
  }
  return false;
};

/** Match template legs in order; skip cardinal detours between diagonals. */
const alignCandidateToTemplate = (
  candidate: GestureVector,
  template: GestureVector,
): TemplateAlignment[] | null => {
  let candidateIndex = 0;
  let pendingBridgeRatio = 0;
  const alignments: TemplateAlignment[] = [];

  for (
    let templateIndex = 0;
    templateIndex < template.directions.length;
    templateIndex += 1
  ) {
    const templateDirection = template.directions[templateIndex]!;
    const nextTemplateDirection = template.directions[templateIndex + 1];
    const allowCornerBridge = nextTemplateDirection !== undefined;

    while (candidateIndex < candidate.directions.length) {
      const candidateDirection = candidate.directions[candidateIndex]!;
      if (directionsCompatible(candidateDirection, templateDirection)) {
        break;
      }
      if (
        skipBeforeLegAnchor(
          candidate,
          candidateIndex,
          templateDirection,
          allowCornerBridge,
        )
      ) {
        pendingBridgeRatio += candidate.segmentLengths[candidateIndex] ?? 0;
        candidateIndex += 1;
        continue;
      }
      return null;
    }

    if (candidateIndex >= candidate.directions.length) {
      return null;
    }
    if (
      !directionsCompatible(
        candidate.directions[candidateIndex]!,
        templateDirection,
      )
    ) {
      return null;
    }

    const directionQuality = directionMatchQuality(
      candidate.directions[candidateIndex]!,
      templateDirection,
    );
    let candidateRatio = pendingBridgeRatio;
    pendingBridgeRatio = 0;
    candidateRatio += candidate.segmentLengths[candidateIndex] ?? 0;
    candidateIndex += 1;

    while (candidateIndex < candidate.directions.length) {
      const candidateDirection = candidate.directions[candidateIndex]!;
      if (
        nextTemplateDirection !== undefined &&
        directionsCompatible(candidateDirection, nextTemplateDirection)
      ) {
        break;
      }
      if (directionsCompatible(candidateDirection, templateDirection)) {
        candidateRatio += candidate.segmentLengths[candidateIndex] ?? 0;
        candidateIndex += 1;
        continue;
      }
      if (
        allowCornerBridge &&
        skipBetweenLegs(
          candidate,
          candidateIndex,
          templateDirection,
          nextTemplateDirection!,
        )
      ) {
        candidateRatio += candidate.segmentLengths[candidateIndex] ?? 0;
        candidateIndex += 1;
        continue;
      }
      break;
    }

    alignments.push({ templateIndex, candidateRatio, directionQuality });
  }

  if (alignments.length !== template.directions.length) {
    return null;
  }
  if (hasSignificantExtraLegs(candidate, candidateIndex)) {
    return null;
  }
  return alignments;
};

const segmentRatioDelta = (
  candidateRatio: number,
  templateRatio: number,
): number => {
  return Math.abs(Math.log((candidateRatio + 1e-6) / (templateRatio + 1e-6)));
};

const templateDirectionScore = (alignments: TemplateAlignment[]): number => {
  if (alignments.length === 0) {
    return 0;
  }
  const total = alignments.reduce(
    (sum, alignment) => sum + alignment.directionQuality,
    0,
  );
  return total / alignments.length;
};

const templateLengthScore = (
  alignments: TemplateAlignment[],
  template: GestureVector,
): number => {
  if (alignments.length === 0) {
    return 0;
  }

  let total = 0;
  for (const alignment of alignments) {
    const templateRatio =
      template.segmentLengths[alignment.templateIndex] ?? 0;
    const ratioDelta = segmentRatioDelta(
      alignment.candidateRatio,
      templateRatio,
    );
    total += Math.max(0, 1 - ratioDelta / LENGTH_RATIO_TOLERANCE);
  }
  return total / alignments.length;
};

export const prepareGestureVectorForMatch = (
  vector: GestureVector,
): GestureVector => {
  return normalizeGestureVector(vector);
};

export const matchGestureVector = (
  candidate: GestureVector,
  template: GestureVector,
): number => {
  if (
    candidate.directions.length === 0 ||
    template.directions.length === 0 ||
    template.totalLength <= 0
  ) {
    return 0;
  }

  if (candidate.totalLength < template.totalLength * MIN_PATH_LENGTH_RATIO) {
    return 0;
  }

  const prepared = prepareGestureVectorForMatch(candidate);
  if (
    countSignificantDiagonalLegs(prepared) > template.directions.length
  ) {
    return 0;
  }

  const alignments = alignCandidateToTemplate(prepared, template);
  if (alignments === null) {
    return 0;
  }

  const directionScore = templateDirectionScore(alignments);
  const lengthScore = templateLengthScore(alignments, template);
  return (
    directionScore * DIRECTION_SCORE_WEIGHT + lengthScore * LENGTH_SCORE_WEIGHT
  );
};

export const passesGestureVectorChecks = (
  candidate: GestureVector,
  template: GestureVector,
): boolean => {
  if (template.totalLength <= 0 || candidate.directions.length === 0) {
    return false;
  }
  return candidate.totalLength >= template.totalLength * MIN_PATH_LENGTH_RATIO;
};
