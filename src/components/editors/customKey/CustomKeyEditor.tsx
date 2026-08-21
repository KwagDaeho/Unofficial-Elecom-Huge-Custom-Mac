import { formatKeyChord } from "@/i18n";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import type { CustomKeyEditorState } from "@/types";

import { KeyChordModal } from "../shared";

interface CustomKeyEditorProps {
  editor: CustomKeyEditorState;
}

export const CustomKeyEditor = (props: CustomKeyEditorProps) => {
  const { lang, i18n } = usePrefs();
  const { mappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const editor = props.editor;
  const preview =
    editor.draft.length > 0
      ? formatKeyChord(editor.draft, lang)
      : i18n.customKeyWaiting;

  return (
    <KeyChordModal
      copy={{
        title: i18n.customKeyTitle,
        hint: i18n.customKeyHint,
        cancelLabel: i18n.cancel,
        saveLabel: i18n.save,
      }}
      preview={preview}
      saveDisabled={editor.draft.length === 0}
      handlers={{
        onCancel: () => setEditor(null),
        onSave: () => {
          mappings.updateSlot(editor.target, editor.slot, {
            type: "key_stroke",
            keys: editor.draft,
          });
          setEditor(null);
        },
      }}
    />
  );
};
