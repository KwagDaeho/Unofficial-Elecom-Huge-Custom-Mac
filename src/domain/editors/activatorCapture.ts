import type { ActivatorEditorState } from "@/types";

export function activatorRejectedMessage(
  rejected: ActivatorEditorState["rejected"],
  labels: { left: string; tilt: string },
): string | null {
  if (rejected === "left") {
    return labels.left;
  }
  if (rejected === "tilt") {
    return labels.tilt;
  }
  return null;
}
