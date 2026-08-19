import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ButtonSize, ButtonVariant } from "@/types";

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

export function Button(props: ButtonProps) {
  const variant = props.variant !== undefined ? props.variant : "default";
  const size = props.size !== undefined ? props.size : "default";
  const className = [
    variant === "ghost" ? "ghost" : "",
    size === "tiny" ? "tiny-btn" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const {
    children,
    variant: _variant,
    size: _size,
    onClick,
    ...rest
  } = props;

  return (
    <button
      type="button"
      className={className.length > 0 ? className : undefined}
      onClick={onClick}
      {...rest}>
      {children}
    </button>
  );
}
