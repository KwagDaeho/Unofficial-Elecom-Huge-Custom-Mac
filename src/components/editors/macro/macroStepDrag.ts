import type { MacroStep } from "@/types";

export type DragState = {
  fromIndex: number;
  overIndex: number;
  pointerId: number;
  offsetY: number;
  startClientY: number;
  stride: number;
  lastSwapClientY: number;
};

export const SWAP_COOLDOWN_PX = 18;

export const reorderSteps = (
  steps: MacroStep[],
  from: number,
  to: number,
): MacroStep[] => {
  if (from === to) {
    return steps;
  }
  const next = steps.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const measureStride = (
  list: HTMLUListElement | null,
  index: number,
): number => {
  const item = list?.children.item(index);
  const next = list?.children.item(index + 1);
  if (item instanceof HTMLElement && next instanceof HTMLElement) {
    return next.offsetTop - item.offsetTop;
  }
  if (item instanceof HTMLElement) {
    const listStyles = window.getComputedStyle(list!);
    const gap = Number.parseFloat(listStyles.rowGap || listStyles.gap || "0") || 0;
    return item.offsetHeight + gap;
  }
  return 40;
};

export const pointerListY = (
  clientY: number,
  list: HTMLUListElement,
  viewport: HTMLElement | null,
): number => {
  const listRect = list.getBoundingClientRect();
  const scrollTop = viewport?.scrollTop ?? 0;
  return clientY - listRect.top + scrollTop;
};

const desiredOverIndex = (
  y: number,
  count: number,
  stride: number,
): number => {
  const raw = Math.floor((y + stride * 0.5) / stride);
  return Math.max(0, Math.min(count - 1, raw));
};

export const updateOverIndex = (
  y: number,
  overIndex: number,
  stride: number,
  count: number,
  clientY: number,
  lastSwapClientY: number,
): { overIndex: number; lastSwapClientY: number } => {
  if (count <= 1 || stride <= 0) {
    return { overIndex: 0, lastSwapClientY };
  }

  const desired = desiredOverIndex(y, count, stride);
  if (desired === overIndex) {
    return { overIndex, lastSwapClientY };
  }

  if (Math.abs(clientY - lastSwapClientY) < SWAP_COOLDOWN_PX) {
    return { overIndex, lastSwapClientY };
  }

  const next = overIndex + (desired > overIndex ? 1 : -1);
  return { overIndex: next, lastSwapClientY: clientY };
};

export const itemShiftY = (index: number, drag: DragState): number => {
  const { fromIndex, overIndex, stride } = drag;
  if (index === fromIndex) {
    return 0;
  }
  if (fromIndex < overIndex && index > fromIndex && index <= overIndex) {
    return -stride;
  }
  if (fromIndex > overIndex && index >= overIndex && index < fromIndex) {
    return stride;
  }
  return 0;
};

export const isEditableStep = (step: MacroStep): boolean =>
  step.type === "delay" || step.type === "key_stroke";

export const autoScrollViewport = (
  viewport: HTMLElement | null,
  clientY: number,
) => {
  if (!viewport) {
    return;
  }
  const rect = viewport.getBoundingClientRect();
  const edge = 32;
  if (clientY < rect.top + edge) {
    viewport.scrollTop -= 6;
  } else if (clientY > rect.bottom - edge) {
    viewport.scrollTop += 6;
  }
};
