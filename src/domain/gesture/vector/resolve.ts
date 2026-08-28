import type { GestureMappingEntry } from "@/types";

import { extractGestureVector, type GestureVector } from "./extract";

export const resolveGestureVector = (
  entry: GestureMappingEntry,
): GestureVector => {
  const directions = entry.templateDirections;
  const segmentLengths = entry.templateSegmentLengths;
  if (
    directions !== undefined &&
    segmentLengths !== undefined &&
    directions.length > 0 &&
    directions.length === segmentLengths.length
  ) {
    return {
      directions,
      segmentLengths,
      totalLength: entry.templatePathLength ?? 0,
    };
  }
  if (entry.template !== undefined && entry.template.length >= 2) {
    return extractGestureVector(entry.template);
  }
  return { directions: [], segmentLengths: [], totalLength: 0 };
};
