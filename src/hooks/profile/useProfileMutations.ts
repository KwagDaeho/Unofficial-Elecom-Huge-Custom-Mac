import type { Dispatch, SetStateAction } from "react";
import {
  isTiltButton,
  withBallScrollPatch,
  withButtonFlags,
  withButtonSlot,
  withCustomMappingActivator,
  withCustomMappingAdded,
  withCustomMappingFlags,
  withCustomMappingRemoved,
  withGestureMappingAdded,
  withGestureMappingFlags,
  withGestureMappingHoldActivator,
  withGestureMappingRemoved,
  withGestureMappingTemplate,
  withMappingSlot,
  withPointerPatch,
} from "@/domain/profile";
import { applyCatalogSelection } from "@/services/catalogSelection";
import type {
  Action,
  ActionSlot,
  Activator,
  BallScrollSettings,
  BallScrollSlot,
  ButtonBinding,
  ButtonId,
  ComboActivator,
  CustomMappingEntry,
  EditorMode,
  GestureMappingEntry,
  MappingTarget,
  Profile,
  ProfileMutateFn,
  ProfileMutations,
} from "@/types";

export const useProfileMutations = (
  profile: Profile | null,
  mutateProfile: ProfileMutateFn,
): ProfileMutations => {
  const updateMappingSlot = (
    target: MappingTarget,
    slot: ActionSlot,
    action: Action,
  ) => {
    mutateProfile((loadedProfile) =>
      withMappingSlot(loadedProfile, target, slot, action),
    );
  };

  const updateButtonSlot = (
    buttonId: ButtonId,
    slot: ActionSlot,
    action: Action,
  ) => {
    mutateProfile((loadedProfile) =>
      withButtonSlot(loadedProfile, buttonId, slot, action),
    );
  };

  const updateButtonFlags = (
    buttonId: ButtonId,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => {
    if (isTiltButton(buttonId)) {
      return;
    }
    mutateProfile((loadedProfile) =>
      withButtonFlags(loadedProfile, buttonId, patch),
    );
  };

  const updatePointer = <K extends keyof Profile["pointer"]>(
    key: K,
    value: Profile["pointer"][K],
  ) => {
    mutateProfile((loadedProfile) =>
      withPointerPatch(loadedProfile, key, value),
    );
  };

  const updateBallScroll = (patch: Partial<BallScrollSettings>) => {
    mutateProfile((loadedProfile) => withBallScrollPatch(loadedProfile, patch));
  };

  const assignBallScrollActivator = (
    slot: BallScrollSlot,
    activator: Activator,
  ) => {
    if (slot === "toggle") {
      updateBallScroll({ toggleActivator: activator, toggleEnabled: true });
      return;
    }
    updateBallScroll({ holdActivator: activator, holdEnabled: true });
  };

  const updateCustomMappingFlags = (
    entryId: string,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => {
    mutateProfile((loadedProfile) =>
      withCustomMappingFlags(loadedProfile, entryId, patch),
    );
  };

  const addCustomMapping = (entry: CustomMappingEntry) => {
    mutateProfile((loadedProfile) =>
      withCustomMappingAdded(loadedProfile, entry),
    );
  };

  const removeCustomMapping = (entryId: string) => {
    mutateProfile((loadedProfile) =>
      withCustomMappingRemoved(loadedProfile, entryId),
    );
  };

  const updateCustomMappingActivator = (
    entryId: string,
    activator: ComboActivator,
  ) => {
    mutateProfile((loadedProfile) =>
      withCustomMappingActivator(loadedProfile, entryId, activator),
    );
  };

  const addGestureMapping = (entry: GestureMappingEntry) => {
    mutateProfile((loadedProfile) =>
      withGestureMappingAdded(loadedProfile, entry),
    );
  };

  const removeGestureMapping = (entryId: string) => {
    mutateProfile((loadedProfile) =>
      withGestureMappingRemoved(loadedProfile, entryId),
    );
  };

  const updateGestureMappingFlags = (
    entryId: string,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => {
    mutateProfile((loadedProfile) =>
      withGestureMappingFlags(loadedProfile, entryId, patch),
    );
  };

  const updateGestureHoldActivator = (
    entryId: string,
    holdActivator: Activator,
  ) => {
    mutateProfile((loadedProfile) =>
      withGestureMappingHoldActivator(loadedProfile, entryId, holdActivator),
    );
  };

  const updateGestureTemplate = (
    entryId: string,
    template: GestureMappingEntry["template"],
    templatePathLength?: number,
    templatePreview?: GestureMappingEntry["templatePreview"],
  ) => {
    mutateProfile((loadedProfile) =>
      withGestureMappingTemplate(
        loadedProfile,
        entryId,
        template,
        templatePathLength,
        templatePreview,
      ),
    );
  };

  const selectCatalogValue = (
    buttonId: ButtonId,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) => {
    applyCatalogSelection(
      { kind: "button", id: buttonId },
      slot,
      value,
      profile,
      setEditor,
      updateMappingSlot,
    );
  };

  const selectCustomCatalogValue = (
    entryId: string,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) => {
    applyCatalogSelection(
      { kind: "custom", id: entryId },
      slot,
      value,
      profile,
      setEditor,
      updateMappingSlot,
    );
  };

  const selectGestureCatalogValue = (
    entryId: string,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) => {
    applyCatalogSelection(
      { kind: "gesture", id: entryId },
      slot,
      value,
      profile,
      setEditor,
      updateMappingSlot,
    );
  };

  return {
    mappings: {
      updateSlot: updateMappingSlot,
      updateButtonSlot,
      updateButtonFlags,
    },
    customMappings: {
      add: addCustomMapping,
      remove: removeCustomMapping,
      updateFlags: updateCustomMappingFlags,
      updateActivator: updateCustomMappingActivator,
    },
    gestureMappings: {
      add: addGestureMapping,
      remove: removeGestureMapping,
      updateFlags: updateGestureMappingFlags,
      updateHoldActivator: updateGestureHoldActivator,
      updateTemplate: updateGestureTemplate,
    },
    pointer: {
      update: updatePointer,
    },
    ballScroll: {
      update: updateBallScroll,
      assignActivator: assignBallScrollActivator,
    },
    catalogSelection: {
      selectButton: selectCatalogValue,
      selectCustom: selectCustomCatalogValue,
      selectGesture: selectGestureCatalogValue,
    },
  };
};
