import { filterOpenAppEditorApps } from "@/domain/apps";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { Button } from "@/components/ui/Button";
import { OpenAppPickerContent } from "./OpenAppPickerContent";
import type { InstalledAppWithIcon, OpenAppEditorState } from "@/types";
interface OpenAppEditorProps {
  editor: OpenAppEditorState;
}
export const OpenAppEditor = (props: OpenAppEditorProps) => {
  const { i18n } = usePrefs();
  const { mappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const editor = props.editor;
  const filteredApps = filterOpenAppEditorApps(editor);
  const handleSave = () => {
    if (editor.selected === null) {
      return;
    }
    mappings.updateSlot(editor.target, editor.slot, {
      type: "open_app",
      bundle_id: editor.selected.bundleId,
      name: editor.selected.name,
    });
    setEditor(null);
  };
  const handleSelect = (app: InstalledAppWithIcon) => {
    setEditor({
      ...editor,
      selected: { name: app.name, bundleId: app.bundleId },
    });
  };
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
            onChange={(event) =>
              setEditor({ ...editor, query: event.target.value })
            }
          />
        </label>
        <OpenAppPickerContent
          editor={editor}
          apps={filteredApps}
          loadingLabel={i18n.openAppLoading}
          errorLabel={i18n.openAppError}
          emptyLabel={i18n.openAppEmpty}
          onSelect={handleSelect}
        />
        <div className="row">
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
          <Button disabled={editor.selected === null} onClick={handleSave}>
            {i18n.save}
          </Button>
        </div>
      </div>
    </div>
  );
};
