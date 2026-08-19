import { formatKeyChord } from "../../domain/actions";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { KeyChordModal } from "./KeyChordModal";
import type { EditorMode } from "../../types";

type CustomKeyEditorState = Extract<EditorMode, { kind: "custom_key" }>;

export function CustomKeyEditor({ editor }: { editor: CustomKeyEditorState }) {
  const { lang, i18n } = usePrefs();
  const { actions } = useProfileCtx();
  const { setEditor } = useSession();

  return (
    <KeyChordModal
      title={i18n.customKeyTitle}
      hint={i18n.customKeyHint}
      preview={
        editor.draft.length > 0
          ? formatKeyChord(editor.draft, lang)
          : i18n.customKeyWaiting
      }
      cancelLabel={i18n.cancel}
      saveLabel={i18n.save}
      saveDisabled={editor.draft.length === 0}
      onCancel={() => setEditor(null)}
      onSave={() => {
        actions.updateMappingSlot(editor.target, editor.slot, {
          type: "key_stroke",
          keys: editor.draft,
        });
        setEditor(null);
      }}
    />
  );
}
