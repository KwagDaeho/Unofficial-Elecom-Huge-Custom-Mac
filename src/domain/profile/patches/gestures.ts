import { asBinding, gestureMappingsOf } from "@/domain/profile";
import { resolveBindingFlags } from "@/domain/profile";
import type {
  Action,
  ActionSlot,
  Activator,
  ButtonBinding,
  GestureMappingEntry,
  MappingTarget,
  Profile,
} from "@/types";

export const withGestureMappingAdded = (
  profile: Profile,
  entry: GestureMappingEntry,
): Profile => ({
  ...profile,
  gestureMappings: [...gestureMappingsOf(profile), entry],
});

export const withGestureMappingRemoved = (
  profile: Profile,
  entryId: string,
): Profile => ({
  ...profile,
  gestureMappings: gestureMappingsOf(profile).filter(
    (entry) => entry.id !== entryId,
  ),
});

export const withGestureMappingHoldActivator = (
  profile: Profile,
  entryId: string,
  holdActivator: Activator,
): Profile => ({
  ...profile,
  gestureMappings: gestureMappingsOf(profile).map((entry) =>
    entry.id === entryId ? { ...entry, holdActivator } : entry,
  ),
});

export const withGestureMappingTemplate = (
  profile: Profile,
  entryId: string,
  templateDirections: number[],
  templateSegmentLengths: number[],
  templatePathLength: number,
): Profile => ({
  ...profile,
  gestureMappings: gestureMappingsOf(profile).map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          templateDirections,
          templateSegmentLengths,
          templatePathLength,
          template: undefined,
          templatePreview: undefined,
          templateCornerCount: undefined,
          templateBendSignature: undefined,
        }
      : entry,
  ),
});

export const withGestureMappingFlags = (
  profile: Profile,
  entryId: string,
  patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
): Profile => ({
  ...profile,
  gestureMappings: gestureMappingsOf(profile).map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }
    const currentBinding = asBinding(entry);
    const flags = resolveBindingFlags(currentBinding, patch);
    return { ...entry, ...currentBinding, ...flags };
  }),
});

export const withGestureMappingSlot = (
  profile: Profile,
  target: Extract<MappingTarget, { kind: "gesture" }>,
  slot: ActionSlot,
  action: Action,
): Profile => ({
  ...profile,
  gestureMappings: gestureMappingsOf(profile).map((entry) => {
    if (entry.id !== target.id) {
      return entry;
    }
    const currentBinding = asBinding(entry);
    return slot === "click"
      ? { ...entry, ...currentBinding, click: action }
      : { ...entry, ...currentBinding, longPress: action };
  }),
});
