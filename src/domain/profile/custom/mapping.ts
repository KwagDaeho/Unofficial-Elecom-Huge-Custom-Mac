import type { ComboActivator, CustomMappingEntry, Profile } from "@/types";

export const customMappingsOf = (profile: Profile): CustomMappingEntry[] => {
  if (profile.customMappings === undefined) {
    return [];
  }
  return profile.customMappings;
};

export const findCustomMapping = (
  profile: Profile,
  entryId: string,
): CustomMappingEntry | undefined => {
  return customMappingsOf(profile).find((entry) => entry.id === entryId);
};

export const newCustomMappingEntry = (): CustomMappingEntry => {
  return {
    id: crypto.randomUUID(),
    activator: { modifiers: [], keys: [], button: "fn2" },
    click: { type: "default" },
    longPress: { type: "disabled" },
    longPressEnabled: false,
    autoClick: false,
  };
};

export const comboIsValid = (activator: ComboActivator): boolean => {
  return activator.modifiers.length > 0 || activator.keys.length > 0;
};
