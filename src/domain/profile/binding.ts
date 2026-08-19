import type { Action, ButtonBinding } from "@/types";
import { resolveBindingFlags } from "./fields";

export function asBinding(
  value: Action | ButtonBinding | undefined,
): ButtonBinding {
  if (value === undefined) {
    return {
      click: { type: "default" },
      longPress: { type: "disabled" },
      longPressEnabled: false,
      autoClick: false,
    };
  }
  if ("click" in value) {
    const flags = resolveBindingFlags(
      {
        click: value.click,
        longPress:
          value.longPress !== undefined
            ? value.longPress
            : { type: "disabled" },
        longPressEnabled: value.longPressEnabled,
        autoClick: value.autoClick,
      },
      {},
    );
    return {
      click: value.click,
      longPress:
        value.longPress !== undefined
          ? value.longPress
          : { type: "disabled" },
      ...flags,
    };
  }
  return {
    click: value,
    longPress: { type: "disabled" },
    longPressEnabled: false,
    autoClick: false,
  };
}

export { longPressMs } from "./pointerSpeeds";
