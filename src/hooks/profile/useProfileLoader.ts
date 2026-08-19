import { useEffect, useState } from "react";
import { normalizeTiltPanStreamFlags } from "@/domain/profile";
import * as tauri from "@/services/tauri";
import type { ButtonMeta, Profile, ProfileLoader } from "@/types";
export const useProfileLoader = (): ProfileLoader => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<ButtonMeta[]>([]);
  const [bootError, setBootError] = useState("");
  const refresh = async () => {
    try {
      const [loadedProfile, buttonCatalog] = await Promise.all([
        tauri.getProfile(),
        tauri.buttonCatalog(),
      ]);
      setProfile(loadedProfile);
      setCatalog(buttonCatalog);
      setBootError("");
      const normalizedProfile = normalizeTiltPanStreamFlags(loadedProfile);
      if (normalizedProfile !== loadedProfile) {
        void tauri
          .saveProfile(normalizedProfile)
          .then(() => setProfile(normalizedProfile))
          .catch((error) => setBootError(String(error)));
      }
    } catch (error) {
      setBootError(String(error));
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const persist = async (nextProfile: Profile) => {
    try {
      await tauri.saveProfile(nextProfile);
      setProfile(nextProfile);
    } catch (error) {
      setBootError(String(error));
    }
  };
  const mutateProfile = (applyPatch: (loadedProfile: Profile) => Profile) => {
    if (profile === null) {
      return;
    }
    void persist(applyPatch(profile));
  };
  const lifecycle = {
    persist,
    setBootError,
    refresh,
  };
  return {
    profile,
    catalog,
    bootError,
    lifecycle,
    mutateProfile,
  };
};
