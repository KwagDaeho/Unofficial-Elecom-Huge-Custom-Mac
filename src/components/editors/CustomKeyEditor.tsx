import { formatKeyChord } from "../../domain/actions";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { Button } from "../ui/Button";
import type { EditorMode } from "../../types";

type CustomKeyEditorState = Extract<EditorMode, { kind: "custom_key" }>;

export function CustomKeyEditor({ editor }: { editor: CustomKeyEditorState }) {
  const { lang, i18n } = usePrefs();
  const { actions } = useProfileCtx();
  const { setEditor } = useSession();

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{i18n.customKeyTitle}</h2>
        <p className="muted">{i18n.customKeyHint}</p>
        <div className="chord-preview">
          {editor.draft.length > 0
            ? formatKeyChord(editor.draft, lang)
            : i18n.customKeyWaiting}
        </div>
        <div className="row">
          <Button variant="ghost" onClick={() => setEditor({ ...editor, draft: [] })}>
            {i18n.clear}
          </Button>
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
          <Button
            disabled={editor.draft.length === 0}
            onClick={() => {
              actions.updateButtonSlot(editor.buttonId, editor.slot, {
                type: "key_stroke",
                keys: editor.draft,
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
