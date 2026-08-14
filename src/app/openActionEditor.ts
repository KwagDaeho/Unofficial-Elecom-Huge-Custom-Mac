import type { Dispatch, SetStateAction } from "react";
import {
  CUSTOM_KEY_SENTINEL,
  MACRO_SENTINEL,
  OPEN_APP_SENTINEL,
} from "../constants/sentinels";
import { asBinding } from "../domain/profile/binding";
import * as tauri from "../services/tauri";
import type {
  Action,
  ActionSlot,
  ButtonId,
  EditorMode,
  MacroStep,
  Profile,
} from "../types";

export function openActionEditor(
  buttonId: ButtonId,
  slot: ActionSlot,
  value: string,
  profile: Profile | null,
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  updateButtonSlot: (id: ButtonId, slot: ActionSlot, action: Action) => void,
) {
  if (value === CUSTOM_KEY_SENTINEL) {
    setEditor({ kind: "custom_key", buttonId, slot, draft: [] });
    return;
  }
  if (value === MACRO_SENTINEL) {
    const existing = asBinding(profile?.buttons[buttonId]);
    const current = slot === "click" ? existing.click : existing.longPress;
    const steps = current.type === "macro" ? current.steps : ([] as MacroStep[]);
    setEditor({ kind: "macro", buttonId, slot, steps, capturing: false });
    return;
  }
  if (value === OPEN_APP_SENTINEL) {
    const existing = asBinding(profile?.buttons[buttonId]);
    const current = slot === "click" ? existing.click : existing.longPress;
    const selected =
      current.type === "open_app" && current.bundle_id
        ? { name: current.name ?? current.bundle_id, bundleId: current.bundle_id }
        : null;
    setEditor({
      kind: "open_app",
      buttonId,
      slot,
      query: "",
      selected,
      apps: [],
      loading: true,
      error: null,
    });
    void tauri
      .listInstalledApps()
      .then((apps) => {
        setEditor((prev) =>
          prev?.kind === "open_app"
            ? { ...prev, apps, loading: false, error: null }
            : prev,
        );
        const queue = apps.map((a) => a.path);
        const workers = Array.from({ length: 6 }, async () => {
          while (queue.length > 0) {
            const path = queue.shift();
            if (!path) break;
            try {
              const icon = await tauri.getAppIcon(path);
              if (!icon) continue;
              setEditor((prev) => {
                if (prev?.kind !== "open_app") return prev;
                return {
                  ...prev,
                  apps: prev.apps.map((a) => (a.path === path ? { ...a, icon } : a)),
                };
              });
            } catch {
              /* ignore missing icons */
            }
          }
        });
        void Promise.all(workers);
      })
      .catch((e) => {
        setEditor((prev) =>
          prev?.kind === "open_app"
            ? { ...prev, loading: false, error: String(e) }
            : prev,
        );
      });
    return;
  }
  try {
    updateButtonSlot(buttonId, slot, JSON.parse(value) as Action);
  } catch {
    updateButtonSlot(buttonId, slot, {
      type: slot === "click" ? "default" : "disabled",
    });
  }
}
