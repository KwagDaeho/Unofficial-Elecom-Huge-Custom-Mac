import { DEFAULT_GESTURE_MIN_SCORE, MIN_RAW_PATH_LENGTH } from "@/constants/gesture";
import { activatorsEqual, ballScrollOf } from "../activator";
import type { Activator, GestureMappingEntry, Profile } from "@/types";

export const gestureMappingsOf = (profile: Profile): GestureMappingEntry[] => {
  return profile.gestureMappings ?? [];
};

export const findGestureMapping = (
  profile: Profile,
  entryId: string,
): GestureMappingEntry | undefined => {
  return gestureMappingsOf(profile).find((entry) => entry.id === entryId);
};

export const newGestureMappingEntry = (): GestureMappingEntry => ({
  id: crypto.randomUUID(),
  holdActivator: null,
  template: [],
  minScore: DEFAULT_GESTURE_MIN_SCORE,
  click: { type: "default" },
  longPress: { type: "disabled" },
  longPressEnabled: false,
  autoClick: false,
});

export const gestureEntryIsValid = (entry: GestureMappingEntry): boolean =>
  entry.holdActivator !== null &&
  entry.template.length >= 2 &&
  (entry.templatePathLength ?? 0) >= MIN_RAW_PATH_LENGTH;

export const gestureHoldLabel = (
  entry: GestureMappingEntry,
  formatActivator: (activator: Activator) => string,
  unsetLabel: string,
): string => {
  if (entry.holdActivator === null) {
    return unsetLabel;
  }
  return formatActivator(entry.holdActivator);
};

export const gestureHoldConflictsWithBallScroll = (
  profile: Profile,
  activator: Activator,
): boolean => {
  const ball = ballScrollOf(profile.ballScroll);
  return (
    ball.holdEnabled &&
    ball.holdActivator !== null &&
    activatorsEqual(ball.holdActivator, activator)
  );
};

export const ballScrollHoldConflictsWithGesture = (
  profile: Profile,
  activator: Activator,
): boolean => {
  return gestureMappingsOf(profile).some(
    (entry) =>
      entry.holdActivator !== null &&
      activatorsEqual(entry.holdActivator, activator),
  );
};
