import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { formatMacroStepLabel } from "@/i18n/macro";
import { OverlayScrollArea } from "../layout/OverlayScrollArea";
import { Button } from "../ui/Button";
import type { Lang, MacroStep } from "@/types";

interface MacroStepListProps {
  steps: MacroStep[];
  lang: Lang;
  editLabel: string;
  removeLabel: string;
  reorderHint: string;
  onStepsChange: (steps: MacroStep[]) => void;
  onEditStep?: (index: number) => void;
}

const reorderSteps = (steps: MacroStep[], from: number, to: number): MacroStep[] => {
  if (from === to) {
    return steps;
  }
  const next = steps.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

type DragState = {
  fromIndex: number;
  overIndex: number;
  pointerId: number;
  offsetY: number;
  startClientY: number;
  stride: number;
  lastSwapClientY: number;
};

const SWAP_COOLDOWN_PX = 18;

const measureStride = (
  list: HTMLUListElement | null,
  index: number,
): number => {
  const item = list?.children.item(index);
  const next = list?.children.item(index + 1);
  if (item instanceof HTMLElement && next instanceof HTMLElement) {
    return next.offsetTop - item.offsetTop;
  }
  if (item instanceof HTMLElement) {
    const styles = window.getComputedStyle(list!);
    const gap = Number.parseFloat(styles.rowGap || styles.gap || "0") || 0;
    return item.offsetHeight + gap;
  }
  return 40;
};

const pointerListY = (
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

const updateOverIndex = (
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

const itemShiftY = (index: number, drag: DragState): number => {
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

const isEditableStep = (step: MacroStep): boolean =>
  step.type === "delay" || step.type === "key_stroke";

const autoScrollViewport = (
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

export const MacroStepList = (props: MacroStepListProps) => {
  const stepsRef = useRef(props.steps);
  const onStepsChangeRef = useRef(props.onStepsChange);
  const listRef = useRef<HTMLUListElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<PointerEvent | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  stepsRef.current = props.steps;
  onStepsChangeRef.current = props.onStepsChange;

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

  return (
    <OverlayScrollArea
      className="macro-steps"
      contentKey={String(props.steps.length)}
    >
      <ul
        ref={(node) => {
          listRef.current = node;
          viewportRef.current =
            node?.closest(".overlay-scroll-area-viewport") ?? null;
        }}
        aria-label={props.reorderHint}
        className={drag ? "macro-steps-list dragging" : "macro-steps-list"}
      >
        {props.steps.map((step, stepIndex) => {
          const dragging = drag?.fromIndex === stepIndex;
          const shiftY = drag ? itemShiftY(stepIndex, drag) : 0;
          const editable = isEditableStep(step) && props.onEditStep;
          const style: CSSProperties | undefined = drag
            ? {
                transform: dragging
                  ? `translateY(${drag.offsetY}px)`
                  : shiftY
                    ? `translateY(${shiftY}px)`
                    : undefined,
              }
            : undefined;

          return (
            <li
              key={stepIndex}
              className={dragging ? "macro-step-dragging" : ""}
              style={style}
            >
              <button
                type="button"
                className="macro-step-drag-zone"
                aria-label={props.reorderHint}
                title={props.reorderHint}
                onPointerDown={(event) => startDrag(stepIndex, event)}
              >
                <span className="macro-step-handle" aria-hidden>
                  ⋮⋮
                </span>
                <span className="macro-step-order">{stepIndex + 1}</span>
              </button>
              <span className="macro-step-label">
                {formatMacroStepLabel(step, props.lang)}
              </span>
              <div className="macro-step-actions">
                {editable ? (
                  <Button
                    variant="ghost"
                    size="tiny"
                    onClick={() => props.onEditStep?.(stepIndex)}
                  >
                    {props.editLabel}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="tiny"
                  onClick={() =>
                    props.onStepsChange(
                      props.steps.filter((_, index) => index !== stepIndex),
                    )
                  }
                >
                  {props.removeLabel}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </OverlayScrollArea>
  );
};
