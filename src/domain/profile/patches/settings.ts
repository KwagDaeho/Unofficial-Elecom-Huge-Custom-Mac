import type { BallScrollSettings, Profile } from "@/types";
import { activatorsEqual, ballScrollOf } from "@/domain/profile/activator";
export const withPointerPatch = <K extends keyof Profile["pointer"]>(
  profile: Profile,
  key: K,
  value: Profile["pointer"][K],
): Profile => {
  return {
    ...profile,
    pointer: { ...profile.pointer, [key]: value },
  };
};
export const withBallScrollPatch = (
  profile: Profile,
  patch: Partial<BallScrollSettings>,
): Profile => {
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
  return { ...profile, ballScroll: next };
};
export const withLongPressMs = (
  profile: Profile,
  longPressMs: number,
): Profile => {
  return { ...profile, longPressMs };
};
