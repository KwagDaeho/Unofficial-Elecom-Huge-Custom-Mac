import {
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cx } from "@/utils/cx";

import * as styles from "./Modal.css";

interface ModalProps {
  children: ReactNode;
  wide?: boolean;
  compact?: boolean;
  plainBackdrop?: boolean;
  nested?: boolean;
  className?: string;
  tabIndex?: number;
  onBackdropClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>((props, ref) => {
  const backdropClass = props.nested
    ? styles.nestedBackdrop
    : props.plainBackdrop
      ? styles.backdropPlain
      : styles.backdrop;

  return (
    <div
      className={backdropClass}
      role="presentation"
      onClick={props.onBackdropClick}
    >
      <div
        ref={ref}
        className={cx(
          styles.dialog,
          props.wide && styles.dialogWide,
          props.compact && styles.dialogCompact,
          props.className,
        )}
        role="dialog"
        aria-modal="true"
        tabIndex={props.tabIndex}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={props.onKeyDown}
      >
        {props.children}
      </div>
    </div>
  );
});
Modal.displayName = "Modal";
