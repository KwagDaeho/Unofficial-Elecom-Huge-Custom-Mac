import type { Dispatch, SetStateAction } from "react";
import {
  CUSTOM_KEY_SENTINEL,
  MACRO_SENTINEL,
  OPEN_APP_SENTINEL,
} from "../../constants/sentinels";
import { asBinding } from "./binding";
import * as tauri from "../../services/tauri";
import type {
  Action,
  ActionSlot,
  EditorMode,
  MappingTarget,
  Profile,
} from "../../types";

function bindingForTarget(profile: Profile | null, target: MappingTarget) {
  if (!profile) return asBinding(undefined);
  if (target.kind === "button") {
    return asBinding(profile.buttons[target.id]);
  }
  const entry = profile.customMappings?.find((e) => e.id === target.id);
  return asBinding(entry);
}

export function selectCatalogValue(
  target: MappingTarget,
  slot: ActionSlot,
  value: string,
  profile: Profile | null,
  setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  updateSlot: (target: MappingTarget, slot: ActionSlot, action: Action) => void,
) {
  if (value === CUSTOM_KEY_SENTINEL) {
    setEditor({ kind: "custom_key", target, slot, draft: [] });
    return;
  }
  if (value === MACRO_SENTINEL) {
    const existing = bindingForTarget(profile, target);
    const current = slot === "click" ? existing.click : existing.longPress;
    const steps = current.type === "macro" ? current.steps : [];
    setEditor({ kind: "macro", target, slot, steps, capturing: false });
    return;
  }
  if (value === OPEN_APP_SENTINEL) {
    const existing = bindingForTarget(profile, target);
    const current = slot === "click" ? existing.click : existing.longPress;
    const selected =
      current.type === "open_app" && current.bundle_id
        ? { name: current.name ?? current.bundle_id, bundleId: current.bundle_id }
        : null;
    setEditor({
      kind: "open_app",
      target,
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
        setEditor((prev) => {
          if (!prev || prev.kind !== "open_app") return prev;
          return { ...prev, apps, loading: false, error: null };
        });
        const queue = apps.map((a) => a.path);
        const workers = Array.from({ length: 6 }, async () => {
          while (queue.length > 0) {
            const path = queue.shift();
            if (!path) break;
            try {
              const icon = await tauri.getAppIcon(path);
              if (!icon) continue;
              setEditor((prev) => {
                if (!prev || prev.kind !== "open_app") return prev;
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
        setEditor((prev) => {
          if (!prev || prev.kind !== "open_app") return prev;
          return { ...prev, loading: false, error: String(e) };
        });
      });
    return;
  }
  try {
    updateSlot(target, slot, JSON.parse(value) as Action);
  } catch {
    updateSlot(target, slot, {
      type: slot === "click" ? "default" : "disabled",
    });
  }
}
