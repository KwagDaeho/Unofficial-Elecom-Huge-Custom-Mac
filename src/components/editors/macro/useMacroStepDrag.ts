import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { MacroStep } from "@/types";

import {
  autoScrollViewport,
  measureStride,
  pointerListY,
  reorderSteps,
  updateOverIndex,
  type DragState,
} from "./macroStepDrag";

interface UseMacroStepDragOptions {
  steps: MacroStep[];
  onStepsChange: (steps: MacroStep[]) => void;
}

export const useMacroStepDrag = (options: UseMacroStepDragOptions) => {
  const stepsRef = useRef(options.steps);
  const onStepsChangeRef = useRef(options.onStepsChange);
  const listRef = useRef<HTMLUListElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<PointerEvent | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  stepsRef.current = options.steps;
  onStepsChangeRef.current = options.onStepsChange;

  useEffect(() => {
    const flushPointer = () => {
      frameRef.current = null;
      const event = pendingPointerRef.current;
      const active = dragRef.current;
      const list = listRef.current;
      if (!event || !active || !list) {
        return;
      }

      autoScrollViewport(viewportRef.current, event.clientY);

      const y = pointerListY(event.clientY, list, viewportRef.current);
      const swap = updateOverIndex(
        y,
        active.overIndex,
        active.stride,
        stepsRef.current.length,
        event.clientY,
        active.lastSwapClientY,
      );
      const offsetY = event.clientY - active.startClientY;

      if (swap.overIndex === active.overIndex && offsetY === active.offsetY) {
        return;
      }

      active.overIndex = swap.overIndex;
      active.lastSwapClientY = swap.lastSwapClientY;
      active.offsetY = offsetY;
      setDrag({ ...active });
    };

    const onMove = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }

      pendingPointerRef.current = event;
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(flushPointer);
      }
    };

    const endDrag = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingPointerRef.current = null;

      if (active.fromIndex !== active.overIndex) {
        onStepsChangeRef.current(
          reorderSteps(stepsRef.current, active.fromIndex, active.overIndex),
        );
      }

      dragRef.current = null;
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const startDrag = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const stride = measureStride(listRef.current, index);
    const next: DragState = {
      fromIndex: index,
      overIndex: index,
      pointerId: event.pointerId,
      offsetY: 0,
      startClientY: event.clientY,
      stride,
      lastSwapClientY: event.clientY,
    };
    dragRef.current = next;
    setDrag(next);
  };

  return { listRef, viewportRef, drag, startDrag };
};
