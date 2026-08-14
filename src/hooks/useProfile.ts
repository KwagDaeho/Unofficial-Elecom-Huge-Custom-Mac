import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { asBinding } from "../domain/profile/binding";
import { selectCatalogValue as selectCatalogValueDomain } from "../domain/profile/selectCatalogValue";
import { isTiltButton, normalizeTiltPanStreamFlags } from "../domain/profile/tilt";
import * as tauri from "../services/tauri";
import type {
  Action,
  ActionSlot,
  ButtonBinding,
  ButtonId,
  ButtonMeta,
  EditorMode,
  Profile,
} from "../types";

export function useProfileState() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<ButtonMeta[]>([]);
  const [bootError, setBootError] = useState("");

  async function refresh() {
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
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function persist(next: Profile) {
    try {
      await tauri.saveProfile(next);
      setProfile(next);
    } catch (e) {
      setBootError(String(e));
    }
  }

  function updateButtonSlot(id: ButtonId, slot: ActionSlot, action: Action) {
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
  }

  function updateButtonFlags(
    id: ButtonId,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) {
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
  }

  function updatePointer<K extends keyof Profile["pointer"]>(
    key: K,
    value: Profile["pointer"][K],
  ) {
    if (!profile) return;
    void persist({
      ...profile,
      pointer: { ...profile.pointer, [key]: value },
    });
  }

  function selectCatalogValue(
    buttonId: ButtonId,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) {
    selectCatalogValueDomain(
      buttonId,
      slot,
      value,
      profile,
      setEditor,
      updateButtonSlot,
    );
  }

  return {
    profile,
    catalog,
    bootError,
    actions: {
      persist,
      setBootError,
      refresh,
      updateButtonSlot,
      updateButtonFlags,
      updatePointer,
      selectCatalogValue,
    },
  };
}
