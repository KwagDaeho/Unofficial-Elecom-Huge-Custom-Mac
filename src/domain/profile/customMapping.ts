import type { ComboActivator, CustomMappingEntry, Profile } from "../../types";

export function customMappingsOf(profile: Profile): CustomMappingEntry[] {
  return profile.customMappings ?? [];
}

export function newCustomMappingEntry(): CustomMappingEntry {
  return {
    id: crypto.randomUUID(),
    activator: { modifiers: [], keys: [], button: "fn2" },
    click: { type: "default" },
    longPress: { type: "disabled" },
    longPressEnabled: false,
    autoClick: false,
  };
}

export function comboIsValid(activator: ComboActivator): boolean {
  return activator.modifiers.length > 0 || activator.keys.length > 0;
}
