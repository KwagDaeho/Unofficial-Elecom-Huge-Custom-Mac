import type { CSSProperties } from "react";

import { formatMacroStepLabel } from "@/i18n";
import { cx } from "@/utils/cx";
import { Button } from "@/components/ui";
import {
  OverlayScrollArea,
  overlayScrollAreaStyles,
} from "@/components/layout/OverlayScrollArea";
import type { Lang, MacroStep } from "@/types";

import { isEditableStep, itemShiftY } from "./macroStepDrag";
import { useMacroStepDrag } from "./useMacroStepDrag";
import * as styles from "./MacroStepList.css";

interface MacroStepListProps {
  steps: MacroStep[];
  lang: Lang;
  editLabel: string;
  removeLabel: string;
  reorderHint: string;
  onStepsChange: (steps: MacroStep[]) => void;
  onEditStep?: (index: number) => void;
}

export const MacroStepList = (props: MacroStepListProps) => {
  const { listRef, viewportRef, drag, startDrag } = useMacroStepDrag({
    steps: props.steps,
    onStepsChange: props.onStepsChange,
  });

  return (
    <OverlayScrollArea
      className={styles.stepsArea}
      contentKey={String(props.steps.length)}
    >
      <ul
        ref={(node) => {
          listRef.current = node;
          viewportRef.current =
            node?.closest(`.${overlayScrollAreaStyles.viewport}`) ?? null;
        }}
        aria-label={props.reorderHint}
        className={cx(styles.list, drag && styles.listDragging)}
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
              className={cx(styles.stepItem, dragging && styles.stepDragging)}
              style={style}
            >
              <button
                type="button"
                className={styles.dragZone}
                aria-label={props.reorderHint}
                title={props.reorderHint}
                onPointerDown={(event) => startDrag(stepIndex, event)}
              >
                <span className={styles.handle} aria-hidden>
                  ⋮⋮
                </span>
                <span className={styles.order}>{stepIndex + 1}</span>
              </button>
              <span className={styles.label}>
                {formatMacroStepLabel(step, props.lang)}
              </span>
              <div className={styles.actions}>
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
