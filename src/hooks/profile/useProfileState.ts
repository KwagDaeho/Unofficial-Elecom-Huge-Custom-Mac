import type { ProfileState } from "@/types";
import { useProfileLoader } from "./useProfileLoader";
import { useProfileMutations } from "./useProfileMutations";

export const useProfileState = (): ProfileState => {
  const { profile, catalog, bootError, lifecycle, mutateProfile } =
    useProfileLoader();
  const {
    mappings,
    customMappings,
    gestureMappings,
    pointer,
    ballScroll,
    catalogSelection,
  } = useProfileMutations(profile, mutateProfile);
  return {
    profile,
    catalog,
    bootError,
    lifecycle,
    mappings,
    customMappings,
    gestureMappings,
    pointer,
    ballScroll,
    catalogSelection,
  };
};
