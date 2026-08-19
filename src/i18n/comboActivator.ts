import { formatKeyChord, hugeButtonLabel } from "@/i18n";
import type { ComboEditorState, Lang } from "@/types";

export function buildComboPreview(
  editor: ComboEditorState,
  lang: Lang,
  waitingLabel: string,
): string {
  const chordPreview =
    editor.draftChord.length > 0
      ? formatKeyChord(editor.draftChord, lang)
      : null;
  const buttonPreview =
    editor.draftButton !== null
      ? hugeButtonLabel(editor.draftButton, lang)
      : null;
  const previewParts = [chordPreview, buttonPreview].filter(
    (part): part is string => part !== null,
  );
  if (previewParts.length === 0) {
    return waitingLabel;
  }
  return previewParts.join(" + ");
}

export function buildComboErrorMessage(
  rejected: ComboEditorState["rejected"],
  labels: { incomplete: string; tilt: string },
): string | null {
  if (rejected === "incomplete") {
    return labels.incomplete;
  }
  if (rejected === "tilt") {
    return labels.tilt;
  }
  return null;
}
