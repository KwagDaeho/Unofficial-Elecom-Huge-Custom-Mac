import { isOpenAppSelection } from "@/domain/apps";
import type { InstalledAppWithIcon, OpenAppEditorState } from "@/types";
interface OpenAppListProps {
  editor: OpenAppEditorState;
  apps: InstalledAppWithIcon[];
  emptyLabel: string;
  onSelect: (app: InstalledAppWithIcon) => void;
}
export const OpenAppList = (props: OpenAppListProps) => {
  if (props.apps.length === 0) {
    return <li className="muted">{props.emptyLabel}</li>;
  }
  return (
    <>
      {props.apps.map((app) => {
        const selected = isOpenAppSelection(props.editor, app.bundleId);
        return (
          <li key={app.bundleId}>
            <button
              type="button"
              className={selected ? "app-row on" : "app-row"}
              role="option"
              aria-selected={selected}
              onClick={() => props.onSelect(app)}
            >
              {app.icon ? (
                <img className="app-icon" src={app.icon} alt="" />
              ) : (
                <span className="app-icon app-icon-fallback" aria-hidden />
              )}
              <span className="app-meta">
                <strong>{app.name}</strong>
                <span>{app.bundleId}</span>
              </span>
            </button>
          </li>
        );
      })}
    </>
  );
};
