import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "default" | "ghost";
type ButtonSize = "default" | "tiny";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className" | "onClick">;

export function Button({
  children,
  variant = "default",
  size = "default",
  onClick,
  ...rest
}: ButtonProps) {
  const className = [
    variant === "ghost" ? "ghost" : "",
    size === "tiny" ? "tiny-btn" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className || undefined}
      onClick={onClick}
      {...rest}>
      {children}
    </button>
  );
}
