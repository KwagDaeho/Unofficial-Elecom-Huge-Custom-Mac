import type { ActivatorEditorState } from "@/types";

export const activatorRejectedMessage = (
  rejected: ActivatorEditorState["rejected"],
  labels: {
    left: string;
    tilt: string;
    ball_scroll?: string;
    gesture?: string;
  },
): string | null => {
  if (rejected === "left") {
    return labels.left;
  }
  if (rejected === "tilt") {
    return labels.tilt;
  }
  if (rejected === "ball_scroll" && labels.ball_scroll) {
    return labels.ball_scroll;
  }
  if (rejected === "gesture" && labels.gesture) {
    return labels.gesture;
  }
  return null;
};
