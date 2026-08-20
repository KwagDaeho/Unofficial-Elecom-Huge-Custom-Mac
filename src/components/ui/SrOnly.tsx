import type { ReactNode } from "react";

import * as styles from "./SrOnly.css";

export const SrOnly = ({ children }: { children: ReactNode }) => (
  <span className={styles.root}>{children}</span>
);
