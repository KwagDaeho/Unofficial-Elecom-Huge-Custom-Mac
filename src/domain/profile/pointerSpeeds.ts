import type { Profile } from "../../types/index";

export function pointerSpeedX(p: Profile["pointer"]): number {
  return Math.max(1, p.speedX ?? p.speed);
}

export function pointerSpeedY(p: Profile["pointer"]): number {
  return Math.max(1, p.speedY ?? p.speed);
}

export function scrollSpeedVertical(p: Profile["pointer"]): number {
  return p.scrollSpeedVertical ?? p.scrollSpeed;
}

export function scrollSpeedHorizontal(p: Profile["pointer"]): number {
  return p.scrollSpeedHorizontal ?? p.scrollSpeed;
}
