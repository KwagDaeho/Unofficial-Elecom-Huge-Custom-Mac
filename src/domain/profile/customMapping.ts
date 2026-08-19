import type { ComboActivator, CustomMappingEntry, Profile } from "@/types";

export function customMappingsOf(profile: Profile): CustomMappingEntry[] {
  if (profile.customMappings === undefined) {
    return [];
  }
  return profile.customMappings;
}

export function findCustomMapping(
  profile: Profile,
  entryId: string,
): CustomMappingEntry | undefined {
  return customMappingsOf(profile).find((entry) => entry.id === entryId);
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
