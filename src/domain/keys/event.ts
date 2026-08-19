export const eventToKeyName = (e: KeyboardEvent): string | null => {
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
};
export const chordFromEvent = (e: KeyboardEvent): string[] => {
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
};
