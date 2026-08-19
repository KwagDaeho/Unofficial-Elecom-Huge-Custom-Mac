import type { Profile } from "@/types";
import { DEFAULT_LONG_PRESS_MS } from "@/constants/pointer";
export const pointerSpeedX = (pointer: Profile["pointer"]): number => {
  const speed = pointer.speedX !== undefined ? pointer.speedX : pointer.speed;
  return Math.max(1, speed);
};
export const pointerSpeedY = (pointer: Profile["pointer"]): number => {
  const speed = pointer.speedY !== undefined ? pointer.speedY : pointer.speed;
  return Math.max(1, speed);
};
export const scrollSpeedVertical = (pointer: Profile["pointer"]): number => {
  return pointer.scrollSpeedVertical !== undefined
    ? pointer.scrollSpeedVertical
    : pointer.scrollSpeed;
};
export const scrollSpeedHorizontal = (pointer: Profile["pointer"]): number => {
  return pointer.scrollSpeedHorizontal !== undefined
    ? pointer.scrollSpeedHorizontal
    : pointer.scrollSpeed;
};
export const invertVerticalScrollEnabled = (
  pointer: Profile["pointer"],
): boolean => {
  return pointer.invertVerticalScroll === true;
};
export const invertHorizontalScrollEnabled = (
  pointer: Profile["pointer"],
): boolean => {
  return pointer.invertHorizontalScroll === true;
};
export const longPressMs = (profile: Profile): number => {
  const raw =
    profile.longPressMs !== undefined
      ? profile.longPressMs
      : DEFAULT_LONG_PRESS_MS;
  return Math.min(2000, Math.max(150, raw));
};
