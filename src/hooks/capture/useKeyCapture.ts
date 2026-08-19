import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  applyComboTriggerCapture,
  applyKeyCapture,
  captureModeOf,
  captureSessionFor,
  resolveActivatorCapture,
} from "@/domain/capture";
import * as tauri from "@/services/tauri";
import type {
  Activator,
  ActivatorCapturePayload,
  BallScrollSlot,
  ComboTriggerCapturePayload,
  EditorMode,
} from "@/types";

function blockBrowserKeyEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (event instanceof KeyboardEvent && typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
}

/**
 * Native key capture for custom-key / macro / ball-scroll / combo activator editors.
 */
export function useKeyCapture(
  editor: EditorMode | null,
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  onActivatorAssigned: (slot: BallScrollSlot, activator: Activator) => void,
) {
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const onActivatorAssignedRef = useRef(onActivatorAssigned);
  onActivatorAssignedRef.current = onActivatorAssigned;

  const captureMode = captureModeOf(editor);
  const captureSession = useMemo(
    () => captureSessionFor(captureMode),
    [captureMode],
  );

  useEffect(() => {
    void tauri.applyCaptureSession(captureSession);
    return () => {
      void tauri.applyCaptureSession(tauri.CAPTURE_SESSION_OFF);
    };
  }, [captureSession]);

  useEffect(() => {
    if (captureMode === "off") {
      return;
    }

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
          (event) => {
            if (cancelled) {
              return;
            }
            const activeEditor = editorRef.current;
            if (activeEditor === null) {
              return;
            }
            const nextEditor = applyKeyCapture(
              activeEditor,
              captureMode,
              event.payload,
            );
            if (nextEditor === null) {
              setEditor(null);
            } else if (nextEditor !== activeEditor) {
              setEditor(nextEditor);
            }
          },
        );
        unsubs.push(unChord);
      }

      if (captureMode === "combo_capture") {
        const unCombo = await listen<ComboTriggerCapturePayload>(
          "combo-trigger-capture",
          (event) => {
            if (cancelled) {
              return;
            }
            const activeEditor = editorRef.current;
            if (activeEditor === null) {
              return;
            }
            const nextEditor = applyComboTriggerCapture(
              activeEditor,
              event.payload,
            );
            if (nextEditor === null) {
              setEditor(null);
            } else if (nextEditor !== activeEditor) {
              setEditor(nextEditor);
            }
          },
        );
        unsubs.push(unCombo);
      }

      if (captureMode === "ball_scroll") {
        const unAct = await listen<ActivatorCapturePayload>(
          "activator-capture",
          (event) => {
            if (cancelled) {
              return;
            }
            const activeEditor = editorRef.current;
            if (activeEditor === null) {
              return;
            }
            const result = resolveActivatorCapture(activeEditor, event.payload);
            if (result === null) {
              return;
            }
            if (result.kind === "close") {
              setEditor(null);
              return;
            }
            if (result.kind === "reject") {
              setEditor((previousEditor) => {
                if (
                  previousEditor === null ||
                  previousEditor.kind !== "ball_scroll_activator"
                ) {
                  return previousEditor;
                }
                return { ...previousEditor, rejected: result.rejected };
              });
              return;
            }
            onActivatorAssignedRef.current(result.slot, result.activator);
            setEditor(null);
          },
        );
        unsubs.push(unAct);
      }

      return () => {
        for (const unsubscribe of unsubs) {
          unsubscribe();
        }
      };
    });

    const blockOpts: AddEventListenerOptions = { capture: true };
    window.addEventListener("keydown", blockBrowserKeyEvent, blockOpts);
    window.addEventListener("keyup", blockBrowserKeyEvent, blockOpts);
    window.addEventListener("keypress", blockBrowserKeyEvent, blockOpts);

    return () => {
      cancelled = true;
      void unlistenPromise.then((cleanup) => {
        if (cleanup !== undefined) {
          cleanup();
        }
      });
      window.removeEventListener("keydown", blockBrowserKeyEvent, blockOpts);
      window.removeEventListener("keyup", blockBrowserKeyEvent, blockOpts);
      window.removeEventListener("keypress", blockBrowserKeyEvent, blockOpts);
    };
  }, [captureMode, setEditor]);
}
