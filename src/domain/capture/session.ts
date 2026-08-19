import type { EditorMode, CaptureMode, CaptureSession } from "@/types";
import { CAPTURE_SESSION_OFF } from "@/services/tauri";
export const captureModeOf = (editor: EditorMode | null): CaptureMode => {
  if (!editor) return "off";
  if (editor.kind === "custom_key") return "custom_key";
  if (editor.kind === "custom_combo_activator") {
    return editor.phase === "capture" ? "combo_capture" : "combo_confirm";
  }
  if (editor.kind === "macro" && editor.keyPrompt) return "macro";
  if (editor.kind === "ball_scroll_activator") return "ball_scroll";
  if (editor.kind === "gesture_hold_activator") return "ball_scroll";
  if (editor.kind === "gesture_path_recorder") return "gesture_record";
  return "off";
};
export const captureSessionFor = (mode: CaptureMode): CaptureSession => {
  switch (mode) {
    case "custom_key":
      return {
        keyCapture: true,
        comboTrigger: false,
        activatorCapture: false,
        uiModal: true,
        gestureRecord: false,
      };
    case "combo_capture":
      return {
        keyCapture: false,
        comboTrigger: true,
        activatorCapture: false,
        uiModal: true,
        gestureRecord: false,
      };
    case "combo_confirm":
      return {
        keyCapture: false,
        comboTrigger: false,
        activatorCapture: false,
        uiModal: true,
        gestureRecord: false,
      };
    case "macro":
      return {
        keyCapture: true,
        comboTrigger: false,
        activatorCapture: false,
        uiModal: true,
        gestureRecord: false,
      };
    case "ball_scroll":
      return {
        keyCapture: false,
        comboTrigger: false,
        activatorCapture: true,
        uiModal: true,
        gestureRecord: false,
      };
    case "gesture_record":
      return {
        keyCapture: false,
        comboTrigger: false,
        activatorCapture: false,
        uiModal: true,
        gestureRecord: true,
      };
    default:
      return CAPTURE_SESSION_OFF;
  }
};
