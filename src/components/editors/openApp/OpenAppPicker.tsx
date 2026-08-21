import type { InstalledAppWithIcon, OpenAppEditorState } from "@/types";
import { Muted } from "@/components/ui";

import { OpenAppList } from "./OpenAppList";
import * as styles from "./OpenAppPicker.css";

interface OpenAppPickerProps {
  editor: OpenAppEditorState;
  apps: InstalledAppWithIcon[];
  loadingLabel: string;
  errorLabel: string;
  emptyLabel: string;
  onSelect: (app: InstalledAppWithIcon) => void;
}

export const OpenAppPicker = (props: OpenAppPickerProps) => {
  if (props.editor.loading) {
    return <Muted>{props.loadingLabel}</Muted>;
  }
  if (props.editor.error !== null) {
    return <Muted>{props.errorLabel}</Muted>;
  }
  return (
    <ul className={styles.list} role="listbox">
      <OpenAppList
        editor={props.editor}
        apps={props.apps}
        emptyLabel={props.emptyLabel}
        onSelect={props.onSelect}
      />
    </ul>
  );
};
