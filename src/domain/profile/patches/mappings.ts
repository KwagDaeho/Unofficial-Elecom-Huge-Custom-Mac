import type {
  Action,
  ActionSlot,
  ButtonBinding,
  ComboActivator,
  CustomMappingEntry,
  MappingTarget,
  Profile,
} from "@/types";
import { asBinding } from "@/domain/profile/binding";
import { customMappingsOf } from "@/domain/profile/customMapping";
import { resolveBindingFlags } from "@/domain/profile/fields";
import { withButtonSlot } from "./buttons";
export const withMappingSlot = (
  profile: Profile,
  target: MappingTarget,
  slot: ActionSlot,
  action: Action,
): Profile => {
  if (target.kind === "button") {
    return withButtonSlot(profile, target.id, slot, action);
  }
  const entries = customMappingsOf(profile);
  const nextEntries = entries.map((entry) => {
    if (entry.id !== target.id) {
      return entry;
    }
    const currentBinding = asBinding(entry);
    return slot === "click"
      ? { ...entry, ...currentBinding, click: action }
      : { ...entry, ...currentBinding, longPress: action };
  });
  return { ...profile, customMappings: nextEntries };
};
export const withCustomMappingFlags = (
  profile: Profile,
  entryId: string,
  patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
): Profile => {
  const nextEntries = customMappingsOf(profile).map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }
    const currentBinding = asBinding(entry);
    const flags = resolveBindingFlags(currentBinding, patch);
    return { ...entry, ...currentBinding, ...flags };
  });
  return { ...profile, customMappings: nextEntries };
};
export const withCustomMappingAdded = (
  profile: Profile,
  entry: CustomMappingEntry,
): Profile => {
  return {
    ...profile,
    customMappings: [...customMappingsOf(profile), entry],
  };
};
export const withCustomMappingRemoved = (
  profile: Profile,
  entryId: string,
): Profile => {
  return {
    ...profile,
    customMappings: customMappingsOf(profile).filter(
      (entry) => entry.id !== entryId,
    ),
  };
};
export const withCustomMappingActivator = (
  profile: Profile,
  entryId: string,
  activator: ComboActivator,
): Profile => {
  const nextEntries = customMappingsOf(profile).map((entry) =>
    entry.id === entryId ? { ...entry, activator } : entry,
  );
  return { ...profile, customMappings: nextEntries };
};
