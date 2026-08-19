import type { Lang } from "@/types";
import { normalizeKeys } from "@/domain/keys/normalize";

export function formatKeyChord(keys: string[], lang: Lang): string {
  const parts = normalizeKeys(keys).map((k) => {
    switch (k) {
      case "Meta":
        return "⌘";
      case "Option":
        return "⌥";
      case "Control":
        return "⌃";
      case "Shift":
        return "⇧";
      case "Left":
        return "←";
      case "Right":
        return "→";
      case "Up":
        return "↑";
      case "Down":
        return "↓";
      case "Escape":
        return "Esc";
      case "Return":
        return "Enter/Return";
      case "Space":
        return lang === "ko" ? "스페이스" : "Space";
      default:
        return k;
    }
  });
  return parts.join("");
}
