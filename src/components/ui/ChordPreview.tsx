import type { ReactNode } from "react";

import { cx } from "@/utils/cx";

import * as styles from "./ChordPreview.css";

interface ChordPreviewProps {
  children: ReactNode;
  className?: string;
}

export const ChordPreview = ({ children, className }: ChordPreviewProps) => (
  <div className={cx(styles.root, className)}>{children}</div>
);

export const ChordError = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <p className={cx(styles.error, className)}>{children}</p>;
