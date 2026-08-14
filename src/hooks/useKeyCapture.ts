import {
  type Dispatch,
  type SetStateAction,
  useEffect,
} from "react";
import * as tauri from "../services/tauri";
import type { EditorMode } from "../types";

const MODIFIERS = new Set(["Control", "Option", "Shift", "Meta"]);

/**
 * Native key capture for custom-key / macro editors.
 * Mirrors App.tsx: toggles `set_key_capture`, listens for `key-capture`,
 * and blocks browser key events while active.
 */
export function useKeyCapture(
  editor: EditorMode | null,
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
) {
  useEffect(() => {
    const nativeCapture =
      !!editor &&
      (editor.kind === "custom_key" ||
        (editor.kind === "macro" && editor.capturing));

    void tauri.setKeyCapture(nativeCapture);

    if (!nativeCapture || !editor) {
      return () => {
        void tauri.setKeyCapture(false);
      };
    }

    let cancelled = false;
    const unlistenPromise = import("@tauri-apps/api/event").then(({ listen }) =>
      listen<{ keys: string[]; escape: boolean }>("key-capture", (ev) => {
        if (cancelled) return;
        const { keys, escape } = ev.payload;

        if (editor.kind === "custom_key") {
          if (escape) {
            setEditor(null);
            return;
          }
          const hasMain = keys.some((k) => !MODIFIERS.has(k));
          if (hasMain) setEditor({ ...editor, draft: keys });
          return;
        }

        if (editor.kind === "macro" && editor.capturing) {
          if (escape) {
            setEditor({ ...editor, capturing: false });
            return;
          }
          const hasMain = keys.some((k) => !MODIFIERS.has(k));
          if (!hasMain) return;
          setEditor({
            ...editor,
            capturing: false,
            steps: [...editor.steps, { type: "key_stroke", keys }],
          });
        }
      }),
    );

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
      void tauri.setKeyCapture(false);
      void unlistenPromise.then((un) => un());
      window.removeEventListener("keydown", blockBrowser, blockOpts);
      window.removeEventListener("keyup", blockBrowser, blockOpts);
      window.removeEventListener("keypress", blockBrowser, blockOpts);
    };
  }, [editor, setEditor]);
}
