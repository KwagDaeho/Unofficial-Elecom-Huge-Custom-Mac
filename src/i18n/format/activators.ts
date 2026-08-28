import type {
  Activator,
  ButtonId,
  ComboActivator,
  Lang,
  MouseClickButton,
} from "@/types";
import { normalizeActivator } from "@/domain/profile/mouseButton";
import { buttonLabel, entryLabel } from "../translate";
import {
  extraMouseButtonLabel,
  normalizeMouseButton,
} from "@/domain/profile/mouseButton";
import { formatKeyChord } from "./keys";
/** Catalog entry ids for injectable mouse-click actions (SSOT with ACTION_CATALOG). */
export const MOUSE_CLICK_ENTRY = {
  left: "mouse_left",
  right: "mouse_right",
  middle: "mouse_middle",
  back: "mouse_back",
  forward: "mouse_forward",
} as const satisfies Record<
  "left" | "right" | "middle" | "back" | "forward",
  string
>;
export const mouseClickLabel = (
  button: MouseClickButton | unknown,
  lang: Lang,
): string => {
  const normalized = normalizeMouseButton(button);
  if (typeof normalized === "object" && normalized.type === "other") {
    return extraMouseButtonLabel(normalized.number, lang);
  }
  if (typeof normalized === "string") {
    return entryLabel(MOUSE_CLICK_ENTRY[normalized], lang);
  }
  return lang === "ko" ? "마우스 버튼" : "Mouse button";
};
export const hugeButtonLabel = (id: ButtonId, lang: Lang): string => {
  return buttonLabel(id, lang);
};
export const formatActivator = (activator: Activator, lang: Lang): string => {
  const normalized = normalizeActivator(activator);
  if (normalized.type === "key") {
    return formatKeyChord([normalized.name], lang);
  }
  if (normalized.type === "mouse") {
    return mouseClickLabel(normalized.button, lang);
  }
  return hugeButtonLabel(normalized.button, lang);
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
