import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { asBinding } from "../domain/profile/binding";
import { selectCatalogValue as selectCatalogValueDomain } from "../domain/profile/selectCatalogValue";
import { isTiltButton, normalizeTiltPanStreamFlags } from "../domain/profile/tilt";
import {
  activatorsEqual,
  ballScrollOf,
} from "../domain/profile/activator";
import { customMappingsOf } from "../domain/profile/customMapping";
import * as tauri from "../services/tauri";
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

  function updateMappingSlot(target: MappingTarget, slot: ActionSlot, action: Action) {
    if (!profile) return;
    if (target.kind === "button") {
      updateButtonSlot(target.id, slot, action);
      return;
    }
    const entries = customMappingsOf(profile);
    const next = entries.map((entry) => {
      if (entry.id !== target.id) return entry;
      const current = asBinding(entry);
      return slot === "click"
        ? { ...entry, ...current, click: action }
        : { ...entry, ...current, longPress: action };
    });
    void persist({ ...profile, customMappings: next });
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

  function updateBallScroll(patch: Partial<BallScrollSettings>) {
    if (!profile) return;
    let next = { ...ballScrollOf(profile.ballScroll), ...patch };
    if (
      next.toggleActivator &&
      next.holdActivator &&
      activatorsEqual(next.toggleActivator, next.holdActivator)
    ) {
      if (patch.toggleActivator) {
        next = { ...next, holdActivator: null };
      } else if (patch.holdActivator) {
        next = { ...next, toggleActivator: null };
      }
    }
    void persist({ ...profile, ballScroll: next });
  }

  function assignBallScrollActivator(slot: BallScrollSlot, activator: Activator) {
    if (slot === "toggle") {
      updateBallScroll({ toggleActivator: activator, toggleEnabled: true });
    } else {
      updateBallScroll({ holdActivator: activator, holdEnabled: true });
    }
  }

  function updateCustomMappingFlags(
    entryId: string,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) {
    if (!profile) return;
    const next = customMappingsOf(profile).map((entry) => {
      if (entry.id !== entryId) return entry;
      const current = asBinding(entry);
      let longPressEnabled = patch.longPressEnabled ?? !!current.longPressEnabled;
      let autoClick = patch.autoClick ?? !!current.autoClick;
      if (patch.longPressEnabled === true) autoClick = false;
      if (patch.autoClick === true) longPressEnabled = false;
      return { ...entry, ...current, longPressEnabled, autoClick };
    });
    void persist({ ...profile, customMappings: next });
  }

  function addCustomMapping(entry: CustomMappingEntry) {
    if (!profile) return;
    void persist({
      ...profile,
      customMappings: [...customMappingsOf(profile), entry],
    });
  }

  function removeCustomMapping(entryId: string) {
    if (!profile) return;
    void persist({
      ...profile,
      customMappings: customMappingsOf(profile).filter((e) => e.id !== entryId),
    });
  }

  function updateCustomMappingActivator(entryId: string, activator: ComboActivator) {
    if (!profile) return;
    const next = customMappingsOf(profile).map((entry) =>
      entry.id === entryId ? { ...entry, activator } : entry,
    );
    void persist({ ...profile, customMappings: next });
  }

  function selectCatalogValue(
    buttonId: ButtonId,
    slot: ActionSlot,
    value: string,
    setEditor: Dispatch<SetStateAction<EditorMode | null>>,
  ) {
    selectCatalogValueDomain(
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
    selectCatalogValueDomain(
      { kind: "custom", id: entryId },
      slot,
      value,
      profile,
      setEditor,
      updateMappingSlot,
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
      updateMappingSlot,
      updateButtonFlags,
      updateCustomMappingFlags,
      addCustomMapping,
      removeCustomMapping,
      updateCustomMappingActivator,
      updatePointer,
      updateBallScroll,
      assignBallScrollActivator,
      selectCatalogValue,
      selectCustomCatalogValue,
    },
  };
}
