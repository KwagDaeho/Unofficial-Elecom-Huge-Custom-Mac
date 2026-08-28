import { vectorToPreviewPoints } from "@/domain/gesture/vector";
import { resolveGestureVector } from "@/domain/gesture/vector/resolve";
import type { GestureMappingEntry, GesturePoint } from "@/types";

const PREVIEW_SIZE = 160;

/** Pick stroke points for mapping-row thumbnails / hover preview. */
export const gesturePreviewPoints = (entry: GestureMappingEntry): GesturePoint[] => {
  if (entry.templatePreview && entry.templatePreview.length >= 2) {
    return entry.templatePreview;
  }
  if (entry.template && entry.template.length >= 2) {
    return entry.template;
  }
  const vector = resolveGestureVector(entry);
  if (vector.directions.length >= 1) {
    return vectorToPreviewPoints(
      vector.directions,
      vector.segmentLengths,
      PREVIEW_SIZE,
    );
  }
  return [];
};
