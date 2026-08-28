import { MIN_VECTOR_SEGMENT_LENGTH } from "@/constants/gesture";
import type { GesturePoint } from "@/types";

import { pathLength } from "../geometry";
import { directionsCompatible } from "./directions";

export type GestureVector = {
  directions: number[];
  segmentLengths: number[];
  totalLength: number;
};

const emptyVector = (): GestureVector => ({
  directions: [],
  segmentLengths: [],
  totalLength: 0,
});

/** 0=E, 1=NE, 2=N, … 7=SE (screen coords, y down). */
export const quantizeDirection = (dx: number, dy: number): number => {
  const angle = Math.atan2(-dy, dx);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  return Math.round(normalized / (Math.PI / 4)) % 8;
};

export const extractGestureVector = (points: GesturePoint[]): GestureVector => {
  if (points.length < 2) {
    return emptyVector();
  }

  const directions: number[] = [];
  const rawLengths: number[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index]!.x - points[index - 1]!.x;
    const dy = points[index]!.y - points[index - 1]!.y;
    const segment = Math.hypot(dx, dy);
    if (segment <= 0) {
      continue;
    }

    const direction = quantizeDirection(dx, dy);
    const lastDirection = directions[directions.length - 1];

    if (lastDirection === undefined) {
      directions.push(direction);
      rawLengths.push(segment);
      continue;
    }

    if (lastDirection === direction) {
      rawLengths[rawLengths.length - 1] =
        (rawLengths[rawLengths.length - 1] ?? 0) + segment;
      continue;
    }

    // Corner rounding on short adjacent diagonals; otherwise start a new run.
    if (
      segment < MIN_VECTOR_SEGMENT_LENGTH &&
      directionsCompatible(lastDirection, direction)
    ) {
      rawLengths[rawLengths.length - 1] =
        (rawLengths[rawLengths.length - 1] ?? 0) + segment;
      continue;
    }

    directions.push(direction);
    rawLengths.push(segment);
  }

  const totalLength = rawLengths.reduce((sum, value) => sum + value, 0);
  if (directions.length === 0 || totalLength <= 0) {
    return emptyVector();
  }

  return {
    directions,
    segmentLengths: rawLengths.map((value) => value / totalLength),
    totalLength,
  };
};

export const rawPathLength = (points: GesturePoint[]): number => {
  return pathLength(points);
};
