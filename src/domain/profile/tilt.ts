import type { Action, ButtonId, Profile } from "@/types";
import { asBinding } from "./binding";
export const isTiltButton = (id: ButtonId): boolean => {
  return id === "wheel_tilt_left" || id === "wheel_tilt_right";
};
export const isTiltPanStreamAction = (action: Action): boolean => {
  if (action.type === "default") return true;
  return action.type === "scroll" && action.dy === 0 && action.dx !== 0;
};
export const tiltForcesAutoClick = (id: ButtonId, _click: Action): boolean => {
  return isTiltButton(id);
};
export const normalizeTiltPanStreamFlags = (profile: Profile): Profile => {
  let changed = false;
  const buttons = { ...profile.buttons };
  for (const id of ["wheel_tilt_left", "wheel_tilt_right"] as ButtonId[]) {
    const current = asBinding(buttons[id]);
    if (current.autoClick && !current.longPressEnabled) continue;
    buttons[id] = {
      ...current,
      autoClick: true,
      longPressEnabled: false,
    };
    changed = true;
  }
  return changed ? { ...profile, buttons } : profile;
};
