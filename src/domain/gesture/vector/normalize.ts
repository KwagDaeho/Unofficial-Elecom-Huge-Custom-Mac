import { MIN_SEGMENT_LENGTH_RATIO } from "@/constants/gesture";

import type { GestureVector } from "./extract";
import { directionsCompatible } from "./directions";

/** Drop tiny runs and merge consecutive compatible directions before matching. */
export const normalizeGestureVector = (vector: GestureVector): GestureVector => {
  if (vector.directions.length === 0) {
    return vector;
  }

  let directions = [...vector.directions];
  let lengths = vector.segmentLengths.map(
    (ratio) => ratio * vector.totalLength,
  );

  const mergeAt = (index: number, intoPrevious: boolean) => {
    if (intoPrevious) {
      if (index <= 0 || index >= directions.length) {
        return;
      }
      lengths[index - 1] = (lengths[index - 1] ?? 0) + (lengths[index] ?? 0);
      directions.splice(index, 1);
      lengths.splice(index, 1);
      return;
    }
    if (index < 0 || index >= directions.length - 1) {
      return;
    }
    lengths[index] = (lengths[index] ?? 0) + (lengths[index + 1] ?? 0);
    directions.splice(index + 1, 1);
    lengths.splice(index + 1, 1);
  };

  let changed = true;
  while (changed && directions.length > 0) {
    changed = false;
    for (let index = directions.length - 1; index >= 0; index -= 1) {
      const ratio = (lengths[index] ?? 0) / vector.totalLength;
      if (ratio >= MIN_SEGMENT_LENGTH_RATIO) {
        continue;
      }
      const prev = directions[index - 1];
      const next = directions[index + 1];
      const current = directions[index]!;
      if (prev !== undefined && directionsCompatible(prev, current)) {
        mergeAt(index, true);
        changed = true;
        break;
      }
      if (next !== undefined && directionsCompatible(current, next)) {
        mergeAt(index, false);
        changed = true;
        break;
      }
      if (directions.length > 1) {
        const prevLen = lengths[index - 1] ?? 0;
        const nextLen = lengths[index + 1] ?? 0;
        mergeAt(index, prevLen >= nextLen);
        changed = true;
        break;
      }
    }
  }

  for (let index = directions.length - 1; index > 0; index -= 1) {
    if (directions[index] === directions[index - 1]) {
      mergeAt(index, true);
    }
  }

  const totalLength = lengths.reduce((sum, value) => sum + value, 0);
  if (totalLength <= 0) {
    return {
      directions: [],
      segmentLengths: [],
      totalLength: 0,
    };
  }

  return {
    directions,
    segmentLengths: lengths.map((value) => value / totalLength),
    totalLength,
  };
};
