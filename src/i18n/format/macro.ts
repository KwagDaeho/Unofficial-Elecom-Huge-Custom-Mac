import { formatKeyChord, mouseClickLabel } from "@/i18n";
import type { Lang, MacroStep } from "@/types";
export const formatMacroStepLabel = (step: MacroStep, lang: Lang): string => {
  if (step.type === "key_stroke") {
    return formatKeyChord(step.keys, lang);
  }
  if (step.type === "delay") {
    return `${step.ms} ms`;
  }
  return mouseClickLabel(step.button, lang);
};
