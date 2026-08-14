import type { Dispatch, SetStateAction } from "react";
import { formatKeyChord } from "../../domain/actions";
import type { Action, ActionSlot, ButtonId, EditorMode } from "../../types";
import type { Dict, Lang } from "../../i18n";

type CustomKeyEditorState = Extract<EditorMode, { kind: "custom_key" }>;

export function CustomKeyEditor({
  editor,
  lang,
  i18n,
  setEditor,
  onSave,
}: {
  editor: CustomKeyEditorState;
  lang: Lang;
  i18n: Dict;
  setEditor: Dispatch<SetStateAction<EditorMode | null>>;
  onSave: (buttonId: ButtonId, slot: ActionSlot, action: Action) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{i18n.customKeyTitle}</h2>
        <p className="muted">{i18n.customKeyHint}</p>
        <div className="chord-preview">
          {editor.draft.length > 0 ? formatKeyChord(editor.draft, lang) : i18n.customKeyWaiting}
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => setEditor({ ...editor, draft: [] })}>
            {i18n.clear}
          </button>
          <button type="button" className="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </button>
          <button
            type="button"
            disabled={editor.draft.length === 0}
            onClick={() => {
              onSave(editor.buttonId, editor.slot, {
                type: "key_stroke",
                keys: editor.draft,
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
