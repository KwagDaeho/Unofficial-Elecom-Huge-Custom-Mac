import type { KeyboardEvent } from "react";
import { comboFromDraft } from "@/domain/profile/activator";
import { chordIsValid } from "@/domain/profile";
import {
  buildComboErrorMessage,
  buildComboPreview,
} from "@/i18n/comboActivator";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { KeyChordModal } from "./KeyChordModal";
import type { ComboEditorState } from "@/types";

interface ComboActivatorEditorProps {
  editor: ComboEditorState;
}

export function ComboActivatorEditor(props: ComboActivatorEditorProps) {
  const { lang, i18n } = usePrefs();
  const { customMappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const editor = props.editor;

  const hint =
    editor.phase === "capture"
      ? i18n.customMappingTriggerCaptureHint
      : i18n.customMappingTriggerConfirmHint;

  const preview = buildComboPreview(
    editor,
    lang,
    i18n.customMappingTriggerWaiting,
  );

  const combo =
    editor.phase === "confirm" &&
    editor.draftButton !== null &&
    chordIsValid(editor.draftChord)
      ? comboFromDraft(editor.draftChord, editor.draftButton)
      : null;

  function saveCombo() {
    if (combo === null) {
      return;
    }
    customMappings.updateActivator(editor.entryId, combo);
    setEditor(null);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      setEditor(null);
      return;
    }
    if (event.key === "Enter") {
      saveCombo();
    }
  }

  return (
    <KeyChordModal
      copy={{
        title: i18n.customMappingTriggerTitle,
        hint,
        cancelLabel: i18n.cancel,
        saveLabel: i18n.save,
      }}
      preview={preview}
      error={buildComboErrorMessage(editor.rejected, {
        incomplete: i18n.customMappingTriggerIncomplete,
        tilt: i18n.activatorRejectedTilt,
      })}
      saveDisabled={combo === null}
      handlers={{
        onCancel: () => setEditor(null),
        onSave: combo !== null ? saveCombo : undefined,
        onKeyDown: handleKeyDown,
      }}
    />
  );
}
