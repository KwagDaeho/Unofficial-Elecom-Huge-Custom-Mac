import type { Action, CatalogEntry } from "../../types/index";
import type { Lang } from "../../i18n/types";
import { ACTION_CATALOG } from "./catalog";
import { ENTRY_LABELS } from "./categories";

function normalizeKeys(keys: string[]): string[] {
  return keys.map((k) => {
    const lower = k.toLowerCase();
    if (["meta", "cmd", "command"].includes(lower)) return "Meta";
    if (["alt", "option"].includes(lower)) return "Option";
    if (["ctrl", "control"].includes(lower)) return "Control";
    if (lower === "shift") return "Shift";
    if (["esc", "escape"].includes(lower)) return "Escape";
    if (["return", "enter"].includes(lower)) return "Return";
    if (["left", "arrow_left", "arrowleft"].includes(lower)) return "Left";
    if (["right", "arrow_right", "arrowright"].includes(lower)) return "Right";
    if (["up", "arrow_up", "arrowup"].includes(lower)) return "Up";
    if (["down", "arrow_down", "arrowdown"].includes(lower)) return "Down";
    if (lower === "space") return "Space";
    if (lower === "tab") return "Tab";
    if (["delete", "backspace"].includes(lower)) return "Delete";
    if (k.length === 1) return k.toUpperCase();
    return k;
  });
}

export function actionsEqual(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "key_stroke" && b.type === "key_stroke") {
    const ak = normalizeKeys(a.keys).join("+");
    const bk = normalizeKeys(b.keys).join("+");
    return ak === bk;
  }
  if (a.type === "open_app" && b.type === "open_app") {
    return a.bundle_id === b.bundle_id && !!a.bundle_id;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export function findCatalogEntry(action: Action): CatalogEntry | undefined {
  return ACTION_CATALOG.find(
    (e) => !e.special && actionsEqual(e.action, action),
  );
}

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

export function describeAction(action: Action, lang: Lang): string {
  const entry = findCatalogEntry(action);
  if (entry) {
    return ENTRY_LABELS[lang][entry.id] ?? entry.id;
  }
  if (action.type === "key_stroke") {
    const chord = formatKeyChord(action.keys, lang);
    return lang === "ko" ? `커스텀[${chord}]` : `Custom[${chord}]`;
  }
  if (action.type === "macro") {
    const n = action.steps.length;
    return lang === "ko" ? `매크로 (${n}단계)` : `Macro (${n} steps)`;
  }
  if (action.type === "open_app") {
    const label = action.name?.trim() || action.bundle_id;
    return lang === "ko" ? `앱 열기 · ${label}` : `Open app · ${label}`;
  }
  return JSON.stringify(action);
}

/** Map a KeyboardEvent to our key name tokens. */
export function eventToKeyName(e: KeyboardEvent): string | null {
  const modMap: Record<string, string> = {
    Meta: "Meta",
    Control: "Control",
    Alt: "Option",
    Shift: "Shift",
  };
  if (e.key in modMap) return modMap[e.key];

  switch (e.code) {
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case "Escape":
      return "Escape";
    case "Enter":
    case "NumpadEnter":
      return "Return";
    case "Tab":
      return "Tab";
    case "Space":
      return "Space";
    case "Backspace":
    case "Delete":
      return "Delete";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    case "Equal":
    case "NumpadAdd":
      return "=";
    case "Minus":
    case "NumpadSubtract":
      return "-";
    default:
      break;
  }

  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(e.code)) return e.code;

  if (e.key.length === 1) return e.key.toUpperCase();
  return null;
}

export function chordFromEvent(e: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (e.ctrlKey) keys.push("Control");
  if (e.altKey) keys.push("Option");
  if (e.shiftKey) keys.push("Shift");
  if (e.metaKey) keys.push("Meta");

  const main = eventToKeyName(e);
  if (
    main &&
    !["Control", "Option", "Shift", "Meta"].includes(main) &&
    !keys.includes(main)
  ) {
    keys.push(main);
  }
  return keys;
}
