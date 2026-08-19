import { useEffect, useState } from "react";
import { normalizeTiltPanStreamFlags } from "@/domain/profile";
import * as tauri from "@/services/tauri";
import type { ButtonMeta, Profile, ProfileLoader } from "@/types";

export function useProfileLoader(): ProfileLoader {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<ButtonMeta[]>([]);
  const [bootError, setBootError] = useState("");

  async function refresh() {
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
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function persist(nextProfile: Profile) {
    try {
      await tauri.saveProfile(nextProfile);
      setProfile(nextProfile);
    } catch (error) {
      setBootError(String(error));
    }
  }

  function mutateProfile(applyPatch: (loadedProfile: Profile) => Profile) {
    if (profile === null) {
      return;
    }
    void persist(applyPatch(profile));
  }

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
}
