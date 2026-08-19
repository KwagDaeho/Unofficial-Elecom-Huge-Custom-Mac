export const CHORD_MODIFIERS = new Set(["Control", "Option", "Shift", "Meta"]);

const MODIFIER_ORDER = ["Control", "Option", "Shift", "Meta"] as const;

export function splitChord(chord: string[]): { modifiers: string[]; keys: string[] } {
  const modifiers = MODIFIER_ORDER.filter((m) => chord.includes(m));
  const keys = chord.filter((k) => !CHORD_MODIFIERS.has(k));
  return { modifiers, keys };
}

export function chordIsValid(chord: string[]): boolean {
  return chord.length > 0;
}
