import {
  CUSTOM_KEY_SENTINEL,
  MACRO_SENTINEL,
  OPEN_APP_SENTINEL,
} from "@/constants/sentinels";
import { asBinding } from "@/domain/profile";
import { customMappingsOf, gestureMappingsOf } from "@/domain/profile";
import type {
  Action,
  ActionSlot,
  CatalogSelectionResult,
  MappingTarget,
  Profile,
} from "@/types";
const bindingForTarget = (profile: Profile | null, target: MappingTarget) => {
  if (profile === null) {
    return asBinding(undefined);
  }
  if (target.kind === "button") {
    return asBinding(profile.buttons[target.id]);
  }
  if (target.kind === "gesture") {
    const entry = gestureMappingsOf(profile).find(
      (mapping) => mapping.id === target.id,
    );
    return asBinding(entry);
  }
  const entry = customMappingsOf(profile).find(
    (mapping) => mapping.id === target.id,
  );
  return asBinding(entry);
};
export const resolveCatalogSelection = (
  target: MappingTarget,
  slot: ActionSlot,
  value: string,
  profile: Profile | null,
): CatalogSelectionResult => {
  if (value === CUSTOM_KEY_SENTINEL) {
    return {
      kind: "editor",
      editor: { kind: "custom_key", target, slot, draft: [] },
    };
  }
  if (value === MACRO_SENTINEL) {
    const existingBinding = bindingForTarget(profile, target);
    const currentAction =
      slot === "click" ? existingBinding.click : existingBinding.longPress;
    const steps = currentAction.type === "macro" ? currentAction.steps : [];
    return {
      kind: "editor",
      editor: { kind: "macro", target, slot, steps, keyPrompt: null },
    };
  }
  if (value === OPEN_APP_SENTINEL) {
    const existingBinding = bindingForTarget(profile, target);
    const currentAction =
      slot === "click" ? existingBinding.click : existingBinding.longPress;
    const selected =
      currentAction.type === "open_app" && currentAction.bundle_id
        ? {
            name:
              currentAction.name !== undefined && currentAction.name.length > 0
                ? currentAction.name
                : currentAction.bundle_id,
            bundleId: currentAction.bundle_id,
          }
        : null;
    return {
      kind: "editor",
      editor: {
        kind: "open_app",
        target,
        slot,
        query: "",
        selected,
        apps: [],
        loading: true,
        error: null,
      },
    };
  }
  try {
    return { kind: "action", action: JSON.parse(value) as Action };
  } catch {
    return {
      kind: "action",
      action: { type: slot === "click" ? "default" : "disabled" },
    };
  }
};
