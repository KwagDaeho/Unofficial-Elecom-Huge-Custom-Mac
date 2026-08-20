import { useEffect, useRef, useState } from "react";

import { CANVAS_BG } from "@/constants/gestureCanvas";
import { paintGestureStroke } from "@/domain/gesture";
import { cx } from "@/utils/cx";
import type { GesturePoint } from "@/types";
import * as styles from "./GestureTemplateThumbnail.css";

const THUMB_SIZE = 36;
const POPOVER_SIZE = 160;

interface GestureTemplateThumbnailProps {
  template: GesturePoint[];
  emptyLabel: string;
  previewLabel: string;
}

const paintPreview = (
  canvas: HTMLCanvasElement,
  template: GesturePoint[],
  width: number,
  height: number,
) => {
  const context = canvas.getContext("2d");
  if (context === null) {
    return;
  }
  context.clearRect(0, 0, width, height);
  context.fillStyle = CANVAS_BG;
  context.fillRect(0, 0, width, height);
  paintGestureStroke(context, template, undefined, width, height);
};

export const GestureTemplateThumbnail = (props: GestureTemplateThumbnailProps) => {
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const popoverRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const hasTemplate = props.template.length >= 2;

  useEffect(() => {
    const canvas = thumbRef.current;
    if (canvas === null) {
      return;
    }
    paintPreview(canvas, props.template, THUMB_SIZE, THUMB_SIZE);
  }, [props.template]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const canvas = popoverRef.current;
    if (canvas === null) {
      return;
    }
    paintPreview(canvas, props.template, POPOVER_SIZE, POPOVER_SIZE);
  }, [open, props.template]);

  if (!hasTemplate) {
    return (
      <div className={styles.thumbEmpty} aria-hidden="true">
        <span className={styles.thumbEmptyMark}>—</span>
      </div>
    );
  }

  return (
    <div
      className={cx(styles.thumb, open && styles.thumbOpen)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen((current) => !current);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={props.previewLabel}
    >
      <canvas
        ref={thumbRef}
        className={styles.thumbCanvas}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
      />
      {open ? (
        <div className={styles.thumbPopover} role="tooltip">
          <canvas
            ref={popoverRef}
            className={styles.thumbPopoverCanvas}
            width={POPOVER_SIZE}
            height={POPOVER_SIZE}
          />
        </div>
      ) : null}
    </div>
  );
};
