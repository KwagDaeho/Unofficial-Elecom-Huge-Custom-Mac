import type { ReactNode } from "react";

import { cx } from "@/utils/cx";

import * as styles from "./Row.css";

interface RowProps {
  children: ReactNode;
  wrap?: boolean;
  className?: string;
}

export const Row = ({ children, wrap, className }: RowProps) => (
  <div className={cx(styles.root, wrap && styles.wrap, className)}>{children}</div>
);
