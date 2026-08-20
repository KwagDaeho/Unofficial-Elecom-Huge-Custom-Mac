import type { ReactNode } from "react";

import { cx } from "@/utils/cx";

import * as styles from "./SectionHead.css";

interface SectionHeadProps {
  title: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export const SectionHead = ({ title, badge, className }: SectionHeadProps) => (
  <div className={cx(styles.root, badge !== undefined && styles.headWithBadge, className)}>
    <h2 className={styles.title}>{title}</h2>
    {badge !== undefined ? <em className={styles.badge}>{badge}</em> : null}
  </div>
);
