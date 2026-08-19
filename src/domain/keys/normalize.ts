export const normalizeKeys = (keys: string[]): string[] => {
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
};
