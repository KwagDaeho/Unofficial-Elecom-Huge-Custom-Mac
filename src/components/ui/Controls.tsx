import type { ReactNode } from "react";

import { cx } from "@/utils/cx";

import * as styles from "./Controls.css";

interface ControlsProps {
  children: ReactNode;
  tight?: boolean;
  tools?: boolean;
  className?: string;
}

export const Controls = ({ children, tight, tools, className }: ControlsProps) => (
  <div
    className={cx(
      styles.root,
      tight && styles.tight,
      tools && styles.tools,
      className,
    )}
  >
    {children}
  </div>
);
