import type { ReactNode } from "react";

import { cx } from "@/utils/cx";
import type { ToggleVariant } from "@/types";

import * as styles from "./Toggle.css";

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
  const className = cx(
    styles.root,
    variant === "inline" && styles.inline,
    variant === "flag" && styles.flag,
  );
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
            <span className={styles.title}>{props.children}</span>
          ) : null}
          {props.description ? (
            <span className={styles.description}>{props.description}</span>
          ) : null}
        </>
      ) : (
        props.children
      )}
    </label>
  );
};
