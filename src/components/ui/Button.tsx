import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cx } from "@/utils/cx";
import type { ButtonSize, ButtonVariant } from "@/types";

import * as styles from "./Button.css";

interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "type" | "className" | "onClick" | "children"
  > {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const variant = props.variant !== undefined ? props.variant : "default";
  const size = props.size !== undefined ? props.size : "default";
  const className = cx(
    variant === "ghost" && styles.ghost,
    size === "tiny" && styles.tiny,
  );
  const { children, variant: _variant, size: _size, onClick, ...rest } = props;
  return (
    <button
      ref={ref}
      type="button"
      className={className || undefined}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";
