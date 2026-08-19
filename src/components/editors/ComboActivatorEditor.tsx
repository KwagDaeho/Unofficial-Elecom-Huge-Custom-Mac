import { formatKeyChord } from "../../domain/actions";
import { comboFromDraft } from "../../domain/profile/activator";
import { chordIsValid } from "../../domain/profile/chordCapture";
import { hugeButtonLabel } from "../../i18n/names";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { KeyChordModal } from "./KeyChordModal";
import type { EditorMode } from "../../types";

type ComboEditorState = Extract<EditorMode, { kind: "custom_combo_activator" }>;

export function ComboActivatorEditor({ editor }: { editor: ComboEditorState }) {
  const { lang, i18n } = usePrefs();
  const { actions } = useProfileCtx();
  const { setEditor } = useSession();

  const hint =
    editor.phase === "capture"
      ? i18n.customMappingTriggerCaptureHint
      : i18n.customMappingTriggerConfirmHint;

  const chordPreview =
    editor.draftChord.length > 0
      ? formatKeyChord(editor.draftChord, lang)
      : null;
  const buttonPreview = editor.draftButton
    ? hugeButtonLabel(editor.draftButton, lang)
    : null;

  const previewParts = [chordPreview, buttonPreview].filter(Boolean);
  const preview =
    previewParts.length > 0
      ? previewParts.join(" + ")
      : i18n.customMappingTriggerWaiting;

  const combo =
    editor.phase === "confirm" &&
    editor.draftButton &&
    chordIsValid(editor.draftChord)
      ? comboFromDraft(editor.draftChord, editor.draftButton)
      : null;

  return (
    <KeyChordModal
      title={i18n.customMappingTriggerTitle}
      hint={hint}
      preview={preview}
      error={
        editor.rejected === "incomplete"
          ? i18n.customMappingTriggerIncomplete
          : editor.rejected === "tilt"
            ? i18n.activatorRejectedTilt
            : null
      }
      cancelLabel={i18n.cancel}
      saveLabel={i18n.save}
      saveDisabled={!combo}
      onCancel={() => setEditor(null)}
      onSave={
        combo
          ? () => {
              actions.updateCustomMappingActivator(editor.entryId, combo);
              setEditor(null);
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setEditor(null);
        } else if (e.key === "Enter" && combo) {
          actions.updateCustomMappingActivator(editor.entryId, combo);
          setEditor(null);
        }
      }}
    />
  );
}
