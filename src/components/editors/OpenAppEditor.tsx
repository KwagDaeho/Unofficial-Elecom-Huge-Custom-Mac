import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { Button } from "../ui/Button";
import type { EditorMode } from "../../types";

type OpenAppEditorState = Extract<EditorMode, { kind: "open_app" }>;

export function OpenAppEditor({ editor }: { editor: OpenAppEditorState }) {
  const { i18n } = usePrefs();
  const { actions } = useProfileCtx();
  const { setEditor } = useSession();

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
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
          <Button
            disabled={!editor.selected}
            onClick={() => {
              if (!editor.selected) return;
              actions.updateMappingSlot(editor.target, editor.slot, {
                type: "open_app",
                bundle_id: editor.selected.bundleId,
                name: editor.selected.name,
              });
              setEditor(null);
            }}>
            {i18n.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
