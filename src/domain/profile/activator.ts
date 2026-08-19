import { formatKeyChord } from "../actions";
import { hugeButtonLabel, mouseClickLabel } from "../../i18n/names";
import { splitChord } from "./chordCapture";
import type { Activator, BallScrollSettings, ComboActivator, ButtonId, Lang } from "../../types";

export const DEFAULT_BALL_SCROLL: BallScrollSettings = {
  toggleEnabled: false,
  toggleActivator: null,
  holdEnabled: false,
  holdActivator: null,
  invertVertical: false,
  invertHorizontal: false,
  speed: 1,
};

export function ballScrollOf(
  value: BallScrollSettings | undefined,
): BallScrollSettings {
  return { ...DEFAULT_BALL_SCROLL, ...value };
}

export function activatorsEqual(a: Activator | null, b: Activator | null): boolean {
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  if (a.type === "key" && b.type === "key") return a.name === b.name;
  if (a.type === "mouse" && b.type === "mouse") return a.button === b.button;
  if (a.type === "huge" && b.type === "huge") return a.button === b.button;
  return false;
}

export function formatActivator(activator: Activator, lang: Lang): string {
  if (activator.type === "key") {
    return formatKeyChord([activator.name], lang);
  }
  if (activator.type === "mouse") {
    return mouseClickLabel(activator.button, lang);
  }
  return hugeButtonLabel(activator.button, lang);
}

export function formatComboActivator(combo: ComboActivator, lang: Lang): string {
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
}

export function comboFromDraft(
  chord: string[],
  button: ButtonId,
): ComboActivator | null {
  const { modifiers, keys } = splitChord(chord);
  if (modifiers.length === 0 && keys.length === 0) return null;
  return { modifiers, keys, button };
}
