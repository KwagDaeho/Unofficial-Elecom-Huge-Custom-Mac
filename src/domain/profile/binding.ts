import type { Action, ButtonBinding, Profile } from "../../types/index";
import { DEFAULT_LONG_PRESS_MS } from "../../constants/pointer";

export function asBinding(
  value: Action | ButtonBinding | undefined,
): ButtonBinding {
  if (!value) {
    return {
      click: { type: "default" },
      longPress: { type: "disabled" },
      longPressEnabled: false,
      autoClick: false,
    };
  }
  if ("click" in value) {
    let longPressEnabled = value.longPressEnabled ?? false;
    let autoClick = value.autoClick ?? false;
    if (longPressEnabled && autoClick) autoClick = false;
    return {
      click: value.click,
      longPress: value.longPress ?? { type: "disabled" },
      longPressEnabled,
      autoClick,
    };
  }
  return {
    click: value,
    longPress: { type: "disabled" },
    longPressEnabled: false,
    autoClick: false,
  };
}

export function longPressMs(p: Profile): number {
  const n = p.longPressMs ?? DEFAULT_LONG_PRESS_MS;
  return Math.min(2000, Math.max(150, n));
}
