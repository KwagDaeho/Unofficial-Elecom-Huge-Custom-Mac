import {
  MIN_RAW_PATH_LENGTH,
  rawPathLength,
} from "@/domain/gesture";
import type { GestureDrawPhase } from "@/domain/gesture/gestureCanvasUiEvent";
import type { GesturePoint } from "@/types";

export type GesturePathUiLabels = {
  recording: string;
  tooShort: string;
  preview: string;
};

export type GesturePathUiRefs = {
  status: HTMLParagraphElement | null;
  redrawRow: HTMLDivElement | null;
  saveButton: HTMLButtonElement | null;
  canvas: HTMLCanvasElement | null;
  modal: HTMLDivElement | null;
};

export const applyGesturePathUi = (
  refs: GesturePathUiRefs,
  phase: GestureDrawPhase,
  points: GesturePoint[],
  labels: GesturePathUiLabels,
): void => {
  const isDrawing = phase === "drawing";
  const pathOk = rawPathLength(points) >= MIN_RAW_PATH_LENGTH;
  const showRedraw = !isDrawing && points.length > 0;
  const strokeLocked = phase === "done" && points.length > 0;

  if (refs.status) {
    refs.status.dataset.phase = phase;
    if (isDrawing) {
      refs.status.textContent = labels.recording;
    } else if (!pathOk || points.length < 2) {
      refs.status.textContent = labels.tooShort;
    } else {
      refs.status.textContent = labels.preview.replace("{score}", "…");
    }
  }

  if (refs.redrawRow) {
    refs.redrawRow.classList.toggle("visible", showRedraw);
    refs.redrawRow.setAttribute("aria-hidden", showRedraw ? "false" : "true");
  }

  if (refs.saveButton) {
    refs.saveButton.disabled = !pathOk || isDrawing;
  }

  if (refs.canvas) {
    refs.canvas.classList.toggle("locked", strokeLocked);
    refs.canvas.setAttribute("aria-disabled", strokeLocked ? "true" : "false");
  }

  if (refs.modal) {
    refs.modal.classList.toggle("gesture-path-done", phase === "done");
  }
};
