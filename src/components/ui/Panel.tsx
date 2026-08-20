import type { ElementType, ReactNode } from "react";

import { cx } from "@/utils/cx";

import * as styles from "./Panel.css";

type PanelVariant = "default" | "row" | "rowSplit" | "warn";

interface PanelProps {
  as?: ElementType;
  children: ReactNode;
  variant?: PanelVariant;
  className?: string;
}

export const Panel = ({
  as: Tag = "section",
  children,
  variant = "default",
  className,
}: PanelProps) => {
  const variantClass =
    variant === "row"
      ? styles.row
      : variant === "rowSplit"
        ? cx(styles.row, styles.rowSplit)
        : variant === "warn"
          ? styles.warn
          : styles.root;

  return <Tag className={cx(variantClass, className)}>{children}</Tag>;
};

export { styles as panelStyles };
