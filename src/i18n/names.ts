import type { ButtonId, Lang, MouseClickButton } from "../types";
import { ko } from "./ko";
import { en } from "./en";

/** Catalog entry ids for injectable mouse-click actions (SSOT with ACTION_CATALOG). */
export const MOUSE_CLICK_ENTRY: Record<MouseClickButton, string> = {
  left: "mouse_left",
  right: "mouse_right",
  middle: "mouse_middle",
  back: "mouse_back",
  forward: "mouse_forward",
};

function dict(lang: Lang) {
  return lang === "ko" ? ko : en;
}

/** Injectable mouse-click action label (i18n entries.*). */
export function mouseClickLabel(button: MouseClickButton, lang: Lang): string {
  const id = MOUSE_CLICK_ENTRY[button];
  const labels = dict(lang).entries as Record<string, string>;
  return labels[id] ?? id;
}

/** HUGE physical button label (i18n buttons.*). */
export function hugeButtonLabel(id: ButtonId, lang: Lang): string {
  const labels = dict(lang).buttons as Record<string, string>;
  return labels[id] ?? id;
}
