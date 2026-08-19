import { comboIsValid } from "@/domain/profile/customMapping";
import type { ComboEditorState, CustomMappingEntry } from "@/types";
export const comboEditorStateFromEntry = (
  entry: CustomMappingEntry,
): ComboEditorState => {
  const validActivator = comboIsValid(entry.activator);
  return {
    kind: "custom_combo_activator",
    entryId: entry.id,
    phase: "capture",
    draftChord: [...entry.activator.modifiers, ...entry.activator.keys],
    draftButton: validActivator ? entry.activator.button : null,
    rejected: null,
  };
};
