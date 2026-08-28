import type { Activator, MouseClickButton } from "@/types";

type StandardMouseClickButton = Extract<MouseClickButton, string>;

const STANDARD_MOUSE_BUTTONS = new Set<string>([
  "left",
  "right",
  "middle",
  "back",
  "forward",
]);

/** Accept Rust serde `{ other: { number } }` and canonical `{ type: "other", number }`. */
export const normalizeMouseButton = (button: unknown): MouseClickButton => {
  if (typeof button === "string" && STANDARD_MOUSE_BUTTONS.has(button)) {
    return button as StandardMouseClickButton;
  }
  if (typeof button === "number" && Number.isFinite(button)) {
    return { type: "other", number: button };
  }
  if (button !== null && typeof button === "object") {
    const record = button as Record<string, unknown>;
    if (record.type === "other" && typeof record.number === "number") {
      return { type: "other", number: record.number };
    }
    const nested = record.other;
    if (nested !== null && typeof nested === "object") {
      const number = (nested as { number?: unknown }).number;
      if (typeof number === "number") {
        return { type: "other", number };
      }
    }
  }
  return "middle";
};

export const normalizeActivator = (activator: Activator): Activator => {
  if (activator.type !== "mouse") {
    return activator;
  }
  return {
    type: "mouse",
    button: normalizeMouseButton(activator.button),
  };
};

export const mouseButtonEventNumber = (
  button: MouseClickButton | unknown,
): number | null => {
  const normalized = normalizeMouseButton(button);
  if (typeof normalized === "string") {
    switch (normalized) {
      case "left":
        return 0;
      case "right":
        return 1;
      case "middle":
        return 2;
      case "back":
        return 3;
      case "forward":
        return 4;
      default:
        return null;
    }
  }
  return normalized.number;
};

export const mouseButtonsEqual = (
  left: MouseClickButton | unknown,
  right: MouseClickButton | unknown,
): boolean => {
  const leftNum = mouseButtonEventNumber(left);
  const rightNum = mouseButtonEventNumber(right);
  return leftNum !== null && leftNum === rightNum;
};

export const isStandardMouseButton = (
  button: MouseClickButton,
): button is StandardMouseClickButton => {
  return typeof button === "string";
};

/** Karabiner-style label: CG button number N → "Button N+1". */
export const extraMouseButtonLabel = (
  cgNumber: number,
  lang: "ko" | "en",
): string => {
  const karabiner = cgNumber + 1;
  return lang === "ko" ? `버튼 ${karabiner}` : `Button ${karabiner}`;
};
