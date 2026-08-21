import { isOpenAppSelection } from "@/domain/apps";
import { cx } from "@/utils/cx";
import { Muted } from "@/components/ui";
import type { InstalledAppWithIcon, OpenAppEditorState } from "@/types";

import * as styles from "./OpenAppList.css";

interface OpenAppListProps {
  editor: OpenAppEditorState;
  apps: InstalledAppWithIcon[];
  emptyLabel: string;
  onSelect: (app: InstalledAppWithIcon) => void;
}

export const OpenAppList = (props: OpenAppListProps) => {
  if (props.apps.length === 0) {
    return (
      <Muted as="li" variant="inList">
        {props.emptyLabel}
      </Muted>
    );
  }
  return (
    <>
      {props.apps.map((app) => {
        const selected = isOpenAppSelection(props.editor, app.bundleId);
        return (
          <li key={app.bundleId}>
            <button
              type="button"
              className={cx(styles.row, selected && styles.rowSelected)}
              role="option"
              aria-selected={selected}
              onClick={() => props.onSelect(app)}
            >
              {app.icon ? (
                <img className={styles.icon} src={app.icon} alt="" />
              ) : (
                <span className={styles.iconFallback} aria-hidden />
              )}
              <span className={styles.meta}>
                <strong className={styles.metaTitle}>{app.name}</strong>
                <span className={styles.metaSubtitle}>{app.bundleId}</span>
              </span>
            </button>
          </li>
        );
      })}
    </>
  );
};
