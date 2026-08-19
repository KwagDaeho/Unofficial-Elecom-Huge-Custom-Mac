import type {
  Activator,
  ButtonId,
  ComboActivator,
  Lang,
  MouseClickButton,
} from "@/types";
import { formatKeyChord } from "./keys";
import { buttonLabel, entryLabel } from "./core";
/** Catalog entry ids for injectable mouse-click actions (SSOT with ACTION_CATALOG). */
export const MOUSE_CLICK_ENTRY: Record<MouseClickButton, string> = {
  left: "mouse_left",
  right: "mouse_right",
  middle: "mouse_middle",
  back: "mouse_back",
  forward: "mouse_forward",
};
export const mouseClickLabel = (
  button: MouseClickButton,
  lang: Lang,
): string => {
  return entryLabel(MOUSE_CLICK_ENTRY[button], lang);
};
export const hugeButtonLabel = (id: ButtonId, lang: Lang): string => {
  return buttonLabel(id, lang);
};
export const formatActivator = (activator: Activator, lang: Lang): string => {
  if (activator.type === "key") {
    return formatKeyChord([activator.name], lang);
  }
  if (activator.type === "mouse") {
    return mouseClickLabel(activator.button, lang);
  }
  return hugeButtonLabel(activator.button, lang);
};
export const formatComboActivator = (
  combo: ComboActivator,
  lang: Lang,
): string => {
  const parts: string[] = [];
  for (const mod of ["Control", "Option", "Shift", "Meta"]) {
    if (combo.modifiers.includes(mod)) {
      parts.push(formatKeyChord([mod], lang).replace(/\s+/g, ""));
    }
  }
  for (const key of combo.keys) {
    parts.push(formatKeyChord([key], lang));
  }
  parts.push(hugeButtonLabel(combo.button, lang));
  return parts.join(" + ");
};
