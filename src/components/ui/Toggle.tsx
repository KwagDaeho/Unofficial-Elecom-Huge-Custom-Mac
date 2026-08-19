import type { ReactNode } from "react";
import type { ToggleVariant } from "@/types";
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  children?: ReactNode;
  description?: ReactNode;
  variant?: ToggleVariant;
}
export const Toggle = (props: ToggleProps) => {
  const disabled = props.disabled === true;
  const variant = props.variant !== undefined ? props.variant : "default";
  const className = [
    "toggle",
    variant === "inline" ? "toggle-inline" : "",
    variant === "flag" ? "flag-toggle" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <label className={className} title={props.title}>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={disabled}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {variant === "inline" ? (
        <>
          {props.children ? (
            <span className="toggle-title">{props.children}</span>
          ) : null}
          {props.description ? (
            <span className="toggle-desc">{props.description}</span>
          ) : null}
        </>
      ) : (
        props.children
      )}
    </label>
  );
};
