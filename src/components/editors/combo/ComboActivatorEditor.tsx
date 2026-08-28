import type { KeyboardEvent } from "react";

import { chordIsValid, comboFromDraft } from "@/domain/profile";
import {
  buildComboErrorMessage,
  buildComboPreview,
} from "@/i18n";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import type { ComboEditorState } from "@/types";

import { KeyChordModal } from "../shared";

interface ComboActivatorEditorProps {
  editor: ComboEditorState;
}

export const ComboActivatorEditor = (props: ComboActivatorEditorProps) => {
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
  const saveCombo = () => {
    if (combo === null) {
      return;
    }
    customMappings.updateActivator(editor.entryId, combo);
    setEditor(null);
  };
  const resetTrigger = () => {
    setEditor({
      ...editor,
      phase: "capture",
      draftChord: [],
      draftButton: null,
      rejected: null,
    });
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setEditor(null);
      return;
    }
    if (event.key === "Enter") {
      saveCombo();
    }
  };

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
      resetLabel={i18n.customMappingTriggerReset}
      onReset={resetTrigger}
      handlers={{
        onCancel: () => setEditor(null),
        onSave: combo !== null ? saveCombo : undefined,
        onKeyDown: handleKeyDown,
      }}
    />
  );
};
