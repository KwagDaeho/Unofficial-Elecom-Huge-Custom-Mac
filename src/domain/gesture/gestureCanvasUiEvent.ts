import type { GesturePoint } from "@/types";

export type GestureDrawPhase = "idle" | "drawing" | "done";

export type GestureCanvasUiDetail = {
  phase: GestureDrawPhase;
  points: GesturePoint[];
};

const EVENT = "gesture-canvas-ui-change";

export const emitGestureCanvasUiChange = (
  detail: GestureCanvasUiDetail,
): void => {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
};

export const subscribeGestureCanvasUiChange = (
  listener: (detail: GestureCanvasUiDetail) => void,
): (() => void) => {
  const handler = (event: Event) => {
    listener((event as CustomEvent<GestureCanvasUiDetail>).detail);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
