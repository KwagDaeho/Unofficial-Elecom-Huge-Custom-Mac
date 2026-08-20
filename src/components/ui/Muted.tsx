import type { ReactNode } from "react";

import { cx } from "@/utils/cx";

import * as styles from "./Muted.css";

interface MutedProps {
  children: ReactNode;
  as?: "p" | "span" | "li";
  variant?: "default" | "modal" | "tiny" | "help" | "inList";
  className?: string;
}

export const Muted = ({
  children,
  as: Tag = "p",
  variant = "default",
  className,
}: MutedProps) => {
  const variantClass =
    variant === "modal"
      ? cx(styles.root, styles.inModal)
      : variant === "tiny"
        ? cx(styles.root, styles.tiny)
        : variant === "help"
          ? cx(styles.root, styles.help)
          : variant === "inList"
            ? cx(styles.root, styles.inList)
            : styles.root;

  return <Tag className={cx(variantClass, className)}>{children}</Tag>;
};
