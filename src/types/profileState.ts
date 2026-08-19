import type { Dispatch, SetStateAction } from "react";
import type {
  Action,
  ActionSlot,
  Activator,
  BallScrollSettings,
  BallScrollSlot,
  ButtonBinding,
  ButtonId,
  ButtonMeta,
  ComboActivator,
  CustomMappingEntry,
  EditorMode,
  MappingTarget,
  Profile,
} from "./index";

export type ProfileLifecycle = {
  persist: (nextProfile: Profile) => Promise<void>;
  setBootError: (message: string) => void;
  refresh: () => Promise<void>;
};

export type ProfileMutateFn = (
  applyPatch: (loadedProfile: Profile) => Profile,
) => void;

export type ProfileLoader = {
  profile: Profile | null;
  catalog: ButtonMeta[];
  bootError: string;
  lifecycle: ProfileLifecycle;
  mutateProfile: ProfileMutateFn;
};

export type ProfileMappingMutations = {
  updateSlot: (target: MappingTarget, slot: ActionSlot, action: Action) => void;
  updateButtonSlot: (
    buttonId: ButtonId,
    slot: ActionSlot,
    action: Action,
  ) => void;
  updateButtonFlags: (
    buttonId: ButtonId,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => void;
};

export type ProfileCustomMappingMutations = {
  add: (entry: CustomMappingEntry) => void;
  remove: (entryId: string) => void;
  updateFlags: (
    entryId: string,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => void;
  updateActivator: (entryId: string, activator: ComboActivator) => void;
};

export type ProfilePointerMutations = {
  update: <K extends keyof Profile["pointer"]>(
    key: K,
    value: Profile["pointer"][K],
  ) => void;
};

export type ProfileBallScrollMutations = {
  update: (patch: Partial<BallScrollSettings>) => void;
  assignActivator: (slot: BallScrollSlot, activator: Activator) => void;
};

export type ProfileCatalogMutations = {
  selectButton: (
    buttonId: ButtonId,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) => void;
  selectCustom: (
    entryId: string,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) => void;
};

export type ProfileMutations = {
  mappings: ProfileMappingMutations;
  customMappings: ProfileCustomMappingMutations;
  pointer: ProfilePointerMutations;
  ballScroll: ProfileBallScrollMutations;
  catalogSelection: ProfileCatalogMutations;
};

export type ProfileState = {
  profile: Profile | null;
  catalog: ButtonMeta[];
  bootError: string;
  lifecycle: ProfileLifecycle;
  mappings: ProfileMappingMutations;
  customMappings: ProfileCustomMappingMutations;
  pointer: ProfilePointerMutations;
  ballScroll: ProfileBallScrollMutations;
  catalogSelection: ProfileCatalogMutations;
};
