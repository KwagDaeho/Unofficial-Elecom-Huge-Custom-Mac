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
  MappingTarget,
  Profile,
  ProfileMutateFn,
  ProfileMutations,
} from "@/types";

export function useProfileMutations(
  profile: Profile | null,
  mutateProfile: ProfileMutateFn,
): ProfileMutations {
  function updateMappingSlot(
    target: MappingTarget,
    slot: ActionSlot,
    action: Action,
  ) {
    mutateProfile((loadedProfile) =>
      withMappingSlot(loadedProfile, target, slot, action),
    );
  }

  function updateButtonSlot(
    buttonId: ButtonId,
    slot: ActionSlot,
    action: Action,
  ) {
    mutateProfile((loadedProfile) =>
      withButtonSlot(loadedProfile, buttonId, slot, action),
    );
  }

  function updateButtonFlags(
    buttonId: ButtonId,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) {
    if (isTiltButton(buttonId)) {
      return;
    }
    mutateProfile((loadedProfile) =>
      withButtonFlags(loadedProfile, buttonId, patch),
    );
  }

  function updatePointer<K extends keyof Profile["pointer"]>(
    key: K,
    value: Profile["pointer"][K],
  ) {
    mutateProfile((loadedProfile) =>
      withPointerPatch(loadedProfile, key, value),
    );
  }

  function updateBallScroll(patch: Partial<BallScrollSettings>) {
    mutateProfile((loadedProfile) =>
      withBallScrollPatch(loadedProfile, patch),
    );
  }

  function assignBallScrollActivator(
    slot: BallScrollSlot,
    activator: Activator,
  ) {
    if (slot === "toggle") {
      updateBallScroll({ toggleActivator: activator, toggleEnabled: true });
      return;
    }
    updateBallScroll({ holdActivator: activator, holdEnabled: true });
  }

  function updateCustomMappingFlags(
    entryId: string,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) {
    mutateProfile((loadedProfile) =>
      withCustomMappingFlags(loadedProfile, entryId, patch),
    );
  }

  function addCustomMapping(entry: CustomMappingEntry) {
    mutateProfile((loadedProfile) =>
      withCustomMappingAdded(loadedProfile, entry),
    );
  }

  function removeCustomMapping(entryId: string) {
    mutateProfile((loadedProfile) =>
      withCustomMappingRemoved(loadedProfile, entryId),
    );
  }

  function updateCustomMappingActivator(
    entryId: string,
    activator: ComboActivator,
  ) {
    mutateProfile((loadedProfile) =>
      withCustomMappingActivator(loadedProfile, entryId, activator),
    );
  }

  function selectCatalogValue(
    buttonId: ButtonId,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) {
    applyCatalogSelection(
      { kind: "button", id: buttonId },
      slot,
      value,
      profile,
      setEditor,
      updateMappingSlot,
    );
  }

  function selectCustomCatalogValue(
    entryId: string,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) {
    applyCatalogSelection(
      { kind: "custom", id: entryId },
      slot,
      value,
      profile,
      setEditor,
      updateMappingSlot,
    );
  }

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
    },
  };
}
