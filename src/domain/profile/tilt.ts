import type { Action, ButtonId, Profile } from "../../types/index";
import { asBinding } from "./binding";

/** Tilt sides whose OS-default / L-R scroll use continuous HID pan streaming. */
export function isTiltButton(id: ButtonId): boolean {
  return id === "wheel_tilt_left" || id === "wheel_tilt_right";
}

/** Matches engine `tilt_uses_pan_stream` action check (OS default or horiz scroll). */
export function isTiltPanStreamAction(action: Action): boolean {
  if (action.type === "default") return true;
  return action.type === "scroll" && action.dy === 0 && action.dx !== 0;
}

/** UI/profile: tilt continuous-click is always locked ON (disabled in UI). */
export function tiltForcesAutoClick(id: ButtonId, _click: Action): boolean {
  return isTiltButton(id);
}

/**
 * Tilt continuous-click is never user-editable — always ON + long-press OFF.
 * (Engine still pulses remapped tilt; L-R scroll uses pan-stream.)
 */
export function normalizeTiltPanStreamFlags(profile: Profile): Profile {
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
}
