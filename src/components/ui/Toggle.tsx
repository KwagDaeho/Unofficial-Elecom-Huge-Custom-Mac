import type { ReactNode } from "react";

type ToggleVariant = "default" | "inline" | "flag";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  children?: ReactNode;
  description?: ReactNode;
  variant?: ToggleVariant;
};

export function Toggle({
  checked,
  onChange,
  disabled = false,
  title,
  children,
  description,
  variant = "default",
}: ToggleProps) {
  const className = [
    "toggle",
    variant === "inline" ? "toggle-inline" : "",
    variant === "flag" ? "flag-toggle" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={className} title={title}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {variant === "inline" ? (
        <>
          {children ? <span className="toggle-title">{children}</span> : null}
          {description ? <span className="toggle-desc">{description}</span> : null}
        </>
      ) : (
        children
      )}
    </label>
  );
}
