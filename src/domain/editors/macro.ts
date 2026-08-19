export function clampMacroDelayMs(value: number): number {
  return Math.max(0, Math.min(5000, value));
}
