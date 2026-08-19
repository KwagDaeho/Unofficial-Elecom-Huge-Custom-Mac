import type { OpenAppEditorState, OpenAppListItem } from "@/types";
import { OpenAppList } from "./OpenAppList";
interface OpenAppPickerContentProps {
  editor: OpenAppEditorState;
  apps: OpenAppListItem[];
  loadingLabel: string;
  errorLabel: string;
  emptyLabel: string;
  onSelect: (app: OpenAppListItem) => void;
}
export const OpenAppPickerContent = (props: OpenAppPickerContentProps) => {
  if (props.editor.loading) {
    return <p className="muted">{props.loadingLabel}</p>;
  }
  if (props.editor.error !== null) {
    return <p className="muted">{props.errorLabel}</p>;
  }
  return (
    <ul className="app-list" role="listbox">
      <OpenAppList
        editor={props.editor}
        apps={props.apps}
        emptyLabel={props.emptyLabel}
        onSelect={props.onSelect}
      />
    </ul>
  );
};
