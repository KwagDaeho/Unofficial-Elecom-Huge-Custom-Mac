import { CHORD_MODIFIERS } from "@/domain/profile";
import type {
  ActivatorCapturePayload,
  ActivatorCaptureResult,
  ComboTriggerCapturePayload,
  EditorMode,
  KeyCapturePayload,
} from "@/types";
export const applyKeyCapture = (
  editor: EditorMode,
  captureMode: "custom_key" | "macro" | "combo_capture",
  payload: KeyCapturePayload,
): EditorMode | null => {
  const { keys, escape } = payload;
  if (captureMode === "custom_key" && editor.kind === "custom_key") {
    if (escape) return null;
    const hasMain = keys.some((k) => !CHORD_MODIFIERS.has(k));
    return hasMain ? { ...editor, draft: keys } : editor;
  }
  if (captureMode === "macro" && editor.kind === "macro" && editor.keyPrompt) {
    if (escape) return { ...editor, keyPrompt: null };
    const hasMain = keys.some((k) => !CHORD_MODIFIERS.has(k));
    if (!hasMain) return editor;
    const step = { type: "key_stroke" as const, keys };
    if (editor.keyPrompt.mode === "add") {
      return {
        ...editor,
        keyPrompt: null,
        steps: [...editor.steps, step],
      };
    }
    const nextSteps = editor.steps.slice();
    nextSteps[editor.keyPrompt.index] = step;
    return {
      ...editor,
      keyPrompt: null,
      steps: nextSteps,
    };
  }
  if (
    captureMode === "combo_capture" &&
    editor.kind === "custom_combo_activator"
  ) {
    if (escape) return null;
    if (keys.length === 0) return editor;
    if (editor.phase !== "capture") return editor;
    return {
      ...editor,
      draftChord: keys,
      draftButton: null,
      rejected: null,
    };
  }
  return editor;
};
export const applyComboTriggerCapture = (
  editor: EditorMode,
  payload: ComboTriggerCapturePayload,
): EditorMode | null => {
  const { escape, combo } = payload;
  if (escape) return null;
  if (combo === null || editor.kind !== "custom_combo_activator") return editor;
  const chord = [...combo.modifiers, ...combo.keys];
  return {
    ...editor,
    draftChord: chord,
    draftButton: combo.button,
    phase: "confirm",
    rejected: null,
  };
};
export const resolveActivatorCapture = (
  editor: EditorMode,
  payload: ActivatorCapturePayload,
): ActivatorCaptureResult | null => {
  if (editor.kind === "gesture_hold_activator") {
    const { escape, rejected, activator } = payload;
    if (escape) return { kind: "close" };
    if (rejected !== null) return { kind: "reject", rejected };
    if (activator !== null) {
      return { kind: "assign_gesture", entryId: editor.entryId, activator };
    }
    return null;
  }
  if (editor.kind !== "ball_scroll_activator") return null;
  const { escape, rejected, activator } = payload;
  if (escape) return { kind: "close" };
  if (rejected !== null) return { kind: "reject", rejected };
  if (activator !== null)
    return { kind: "assign", slot: editor.slot, activator };
  return null;
};
