import { useCallback, useEffect, useState } from "react";
import { asBinding } from "../domain/profile/binding";
import { isTiltButton, normalizeTiltPanStreamFlags } from "../domain/profile/tilt";
import * as tauri from "../services/tauri";
import type {
  Action,
  ActionSlot,
  ButtonBinding,
  ButtonId,
  ButtonMeta,
  Profile,
} from "../types";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<ButtonMeta[]>([]);
  const [bootError, setBootError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [p, buttons] = await Promise.all([
        tauri.getProfile(),
        tauri.buttonCatalog(),
      ]);
      setProfile(p);
      setCatalog(buttons);
      setBootError("");
      const normalized = normalizeTiltPanStreamFlags(p);
      if (normalized !== p) {
        void tauri
          .saveProfile(normalized)
          .then(() => setProfile(normalized))
          .catch((e) => setBootError(String(e)));
      }
    } catch (e) {
      setBootError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persist = useCallback(async (next: Profile) => {
    try {
      await tauri.saveProfile(next);
      setProfile(next);
    } catch (e) {
      setBootError(String(e));
    }
  }, []);

  const updateButtonSlot = useCallback(
    (id: ButtonId, slot: ActionSlot, action: Action) => {
      if (!profile) return;
      const current = asBinding(profile.buttons[id]);
      let next: ButtonBinding =
        slot === "click"
          ? { ...current, click: action }
          : { ...current, longPress: action };
      if (slot === "click" && isTiltButton(id)) {
        // Tilt AC is always locked ON (LP off). Engine pulses remaps; scroll uses pan-stream.
        next = { ...next, autoClick: true, longPressEnabled: false };
      }
      void persist({
        ...profile,
        buttons: { ...profile.buttons, [id]: next },
      });
    },
    [persist, profile],
  );

  const updateBinding = updateButtonSlot;

  const updateButtonFlags = useCallback(
    (
      id: ButtonId,
      patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
    ) => {
      if (!profile) return;
      const current = asBinding(profile.buttons[id]);
      // Tilt flags are locked (AC on, LP off).
      if (isTiltButton(id)) {
        return;
      }
      let longPressEnabled = patch.longPressEnabled ?? !!current.longPressEnabled;
      let autoClick = patch.autoClick ?? !!current.autoClick;
      if (patch.longPressEnabled === true) autoClick = false;
      if (patch.autoClick === true) longPressEnabled = false;
      void persist({
        ...profile,
        buttons: {
          ...profile.buttons,
          [id]: { ...current, longPressEnabled, autoClick },
        },
      });
    },
    [persist, profile],
  );

  const updatePointer = useCallback(
    <K extends keyof Profile["pointer"]>(key: K, value: Profile["pointer"][K]) => {
      if (!profile) return;
      void persist({
        ...profile,
        pointer: { ...profile.pointer, [key]: value },
      });
    },
    [persist, profile],
  );

  const setPointerSpeeds = updatePointer;

  return {
    profile,
    setProfile,
    catalog,
    bootError,
    setBootError,
    refresh,
    persist,
    updateBinding,
    updateButtonSlot,
    updateButtonFlags,
    updatePointer,
    setPointerSpeeds,
  };
}
