import type { ProfileState } from "@/types";
import { useProfileLoader } from "./useProfileLoader";
import { useProfileMutations } from "./useProfileMutations";

export function useProfileState(): ProfileState {
  const { profile, catalog, bootError, lifecycle, mutateProfile } =
    useProfileLoader();
  const { mappings, customMappings, pointer, ballScroll, catalogSelection } =
    useProfileMutations(profile, mutateProfile);

  return {
    profile,
    catalog,
    bootError,
    lifecycle,
    mappings,
    customMappings,
    pointer,
    ballScroll,
    catalogSelection,
  };
}
