import type { Dispatch, SetStateAction } from "react";
import type { Action, ActionSlot, ButtonId, EditorMode } from "../../types";
import type { Dict } from "../../i18n";

type OpenAppEditorState = Extract<EditorMode, { kind: "open_app" }>;

export function OpenAppEditor({
  editor,
  i18n,
  setEditor,
  onSave,
}: {
  editor: OpenAppEditorState;
  i18n: Dict;
  setEditor: Dispatch<SetStateAction<EditorMode | null>>;
  onSave: (buttonId: ButtonId, slot: ActionSlot, action: Action) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <h2>{i18n.openAppTitle}</h2>
        <p className="muted">{i18n.openAppHint}</p>
        <label className="app-search">
          <span className="sr-only">{i18n.openAppSearch}</span>
          <input
            type="search"
            autoFocus
            placeholder={i18n.openAppSearch}
            value={editor.query}
            onChange={(e) => setEditor({ ...editor, query: e.target.value })}
          />
        </label>
        {editor.loading ? (
          <p className="muted">{i18n.openAppLoading}</p>
        ) : editor.error ? (
          <p className="muted">{i18n.openAppError}</p>
        ) : (
          <ul className="app-list" role="listbox">
            {editor.apps
              .filter((app) => {
                const q = editor.query.trim().toLowerCase();
                if (!q) return true;
                return (
                  app.name.toLowerCase().includes(q) ||
                  app.bundleId.toLowerCase().includes(q)
                );
              })
              .slice(0, 80)
              .map((app) => {
                const on = editor.selected?.bundleId === app.bundleId;
                return (
                  <li key={app.bundleId}>
                    <button
                      type="button"
                      className={on ? "app-row on" : "app-row"}
                      role="option"
                      aria-selected={on}
                      onClick={() =>
                        setEditor({
                          ...editor,
                          selected: { name: app.name, bundleId: app.bundleId },
                        })
                      }>
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
            {!editor.loading &&
              editor.apps.filter((app) => {
                const q = editor.query.trim().toLowerCase();
                if (!q) return true;
                return (
                  app.name.toLowerCase().includes(q) ||
                  app.bundleId.toLowerCase().includes(q)
                );
              }).length === 0 && <li className="muted">{i18n.openAppEmpty}</li>}
          </ul>
        )}
        <div className="row">
          <button type="button" className="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </button>
          <button
            type="button"
            disabled={!editor.selected}
            onClick={() => {
              if (!editor.selected) return;
              onSave(editor.buttonId, editor.slot, {
                type: "open_app",
                bundle_id: editor.selected.bundleId,
                name: editor.selected.name,
              });
              setEditor(null);
            }}>
            {i18n.save}
          </button>
        </div>
      </div>
    </div>
  );
}
