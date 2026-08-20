import { significantCornerCount } from "@/domain/gesture/template";
import type { GestureMappingEntry, GesturePoint } from "@/types";

/** Pick stroke points for mapping-row thumbnails / hover preview. */
export const gesturePreviewPoints = (entry: GestureMappingEntry): GesturePoint[] => {
  const { template, templatePreview, templateCornerCount } = entry;
  if (templatePreview && templatePreview.length >= 2) {
    const previewCorners = significantCornerCount(templatePreview);
    const cornerCount = templateCornerCount ?? 0;
    const expectedCorners =
      cornerCount > 0 ? cornerCount : significantCornerCount(template);
    if (expectedCorners === 0 || previewCorners >= expectedCorners) {
      return templatePreview;
    }
  }
  if (template.length >= 2) {
    return template;
  }
  return templatePreview ?? [];
};
