import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { CHORD_MODIFIERS } from "../domain/profile/chordCapture";
import * as tauri from "../services/tauri";
import type { Activator, BallScrollSlot, ComboActivator, EditorMode } from "../types";

type ActivatorCapturePayload = {
  escape: boolean;
  rejected: string | null;
  activator: Activator | null;
};

type ComboTriggerCapturePayload = {
  escape: boolean;
  rejected: string | null;
  combo: ComboActivator | null;
};

type CaptureMode =
  | "off"
  | "custom_key"
  | "combo_capture"
  | "combo_confirm"
  | "macro"
  | "ball_scroll";

function captureModeOf(editor: EditorMode | null): CaptureMode {
  if (!editor) return "off";
  if (editor.kind === "custom_key") return "custom_key";
  if (editor.kind === "custom_combo_activator") {
    return editor.phase === "capture" ? "combo_capture" : "combo_confirm";
  }
  if (editor.kind === "macro" && editor.capturing) return "macro";
  if (editor.kind === "ball_scroll_activator") return "ball_scroll";
  return "off";
}

function captureSessionFor(mode: CaptureMode): tauri.CaptureSession {
  switch (mode) {
    case "custom_key":
      return {
        keyCapture: true,
        comboTrigger: false,
        activatorCapture: false,
        uiModal: true,
      };
    case "combo_capture":
      return {
        keyCapture: false,
        comboTrigger: true,
        activatorCapture: false,
        uiModal: true,
      };
    case "combo_confirm":
      return {
        keyCapture: false,
        comboTrigger: false,
        activatorCapture: false,
        uiModal: true,
      };
    case "macro":
      return {
        keyCapture: true,
        comboTrigger: false,
        activatorCapture: false,
        uiModal: true,
      };
    case "ball_scroll":
      return {
        keyCapture: false,
        comboTrigger: false,
        activatorCapture: true,
        uiModal: true,
      };
    default:
      return tauri.CAPTURE_SESSION_OFF;
  }
}

/**
 * Native key capture for custom-key / macro / ball-scroll / combo activator editors.
 */
export function useKeyCapture(
  editor: EditorMode | null,
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  onActivator?: (slot: BallScrollSlot, activator: Activator) => void,
) {
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const onActivatorRef = useRef(onActivator);
  onActivatorRef.current = onActivator;

  const captureMode = captureModeOf(editor);
  const captureSession = useMemo(
    () => captureSessionFor(captureMode),
    [captureMode],
  );

  // Sync backend capture flags — only when capture *mode* changes, not on every draft edit.
  useEffect(() => {
    void tauri.applyCaptureSession(captureSession);
    return () => {
      void tauri.applyCaptureSession(tauri.CAPTURE_SESSION_OFF);
    };
  }, [captureSession]);

  // Event listeners — also keyed on capture mode only.
  useEffect(() => {
    if (captureMode === "off") return;

    let cancelled = false;
    const unlistenPromise = import("@tauri-apps/api/event").then(async ({ listen }) => {
      const unsubs: Array<() => void> = [];

      if (
        captureMode === "custom_key" ||
        captureMode === "macro" ||
        captureMode === "combo_capture"
      ) {
        const unChord = await listen<{ keys: string[]; escape: boolean }>(
          "key-capture",
          (ev) => {
            if (cancelled) return;
            const ed = editorRef.current;
            if (!ed) return;
            const { keys, escape } = ev.payload;

            if (captureMode === "custom_key" && ed.kind === "custom_key") {
              if (escape) {
                setEditor(null);
                return;
              }
              const hasMain = keys.some((k) => !CHORD_MODIFIERS.has(k));
              if (hasMain) {
                setEditor((prev) =>
                  prev?.kind === "custom_key" ? { ...prev, draft: keys } : prev,
                );
              }
              return;
            }

            if (captureMode === "macro" && ed.kind === "macro" && ed.capturing) {
              if (escape) {
                setEditor((prev) =>
                  prev?.kind === "macro" ? { ...prev, capturing: false } : prev,
                );
                return;
              }
              const hasMain = keys.some((k) => !CHORD_MODIFIERS.has(k));
              if (!hasMain) return;
              setEditor((prev) =>
                prev?.kind === "macro" && prev.capturing
                  ? {
                      ...prev,
                      capturing: false,
                      steps: [...prev.steps, { type: "key_stroke", keys }],
                    }
                  : prev,
              );
              return;
            }

            if (captureMode === "combo_capture" && ed.kind === "custom_combo_activator") {
              if (escape) {
                setEditor(null);
                return;
              }
              if (keys.length === 0) return;
              setEditor((prev) => {
                if (prev?.kind !== "custom_combo_activator" || prev.phase !== "capture") {
                  return prev;
                }
                return {
                  ...prev,
                  draftChord: keys,
                  draftButton: null,
                  rejected: null,
                };
              });
            }
          },
        );
        unsubs.push(unChord);
      }

      if (captureMode === "combo_capture") {
        const unCombo = await listen<ComboTriggerCapturePayload>(
          "combo-trigger-capture",
          (ev) => {
            if (cancelled) return;
            const { escape, combo } = ev.payload;

            if (escape) {
              setEditor(null);
              return;
            }
            if (combo) {
              const chord = [...combo.modifiers, ...combo.keys];
              setEditor((prev) => {
                if (prev?.kind !== "custom_combo_activator") return prev;
                return {
                  ...prev,
                  draftChord: chord,
                  draftButton: combo.button,
                  phase: "confirm",
                  rejected: null,
                };
              });
            }
          },
        );
        unsubs.push(unCombo);
      }

      if (captureMode === "ball_scroll") {
        const unAct = await listen<ActivatorCapturePayload>(
          "activator-capture",
          (ev) => {
            if (cancelled) return;
            const ed = editorRef.current;
            if (ed?.kind !== "ball_scroll_activator") return;

            const { escape, rejected, activator } = ev.payload;
            if (escape) {
              setEditor(null);
              return;
            }
            if (rejected) {
              setEditor((prev) =>
                prev?.kind === "ball_scroll_activator"
                  ? { ...prev, rejected }
                  : prev,
              );
              return;
            }
            if (activator) {
              onActivatorRef.current?.(ed.slot, activator);
              setEditor(null);
            }
          },
        );
        unsubs.push(unAct);
      }

      return () => {
        for (const un of unsubs) un();
      };
    });

    const blockBrowser = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      (e as KeyboardEvent).stopImmediatePropagation?.();
    };
    const blockOpts: AddEventListenerOptions = { capture: true };
    window.addEventListener("keydown", blockBrowser, blockOpts);
    window.addEventListener("keyup", blockBrowser, blockOpts);
    window.addEventListener("keypress", blockBrowser, blockOpts);

    return () => {
      cancelled = true;
      void unlistenPromise.then((un) => un?.());
      window.removeEventListener("keydown", blockBrowser, blockOpts);
      window.removeEventListener("keyup", blockBrowser, blockOpts);
      window.removeEventListener("keypress", blockBrowser, blockOpts);
    };
  }, [captureMode, setEditor]);
}
