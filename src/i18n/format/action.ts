import type { Action, Lang } from "@/types";
import { findCatalogEntry } from "@/domain/actions";
import { entryLabel } from "../translate";
import { formatKeyChord } from "./keys";
export const describeAction = (action: Action, lang: Lang): string => {
  const entry = findCatalogEntry(action);
  if (entry) {
    return entryLabel(entry.id, lang);
  }
  if (action.type === "key_stroke") {
    const chord = formatKeyChord(action.keys, lang);
    return lang === "ko" ? `커스텀[${chord}]` : `Custom[${chord}]`;
  }
  if (action.type === "macro") {
    const stepCount = action.steps.length;
    return lang === "ko"
      ? `매크로 (${stepCount}단계)`
      : `Macro (${stepCount} steps)`;
  }
  if (action.type === "open_app") {
    const trimmedName = action.name !== undefined ? action.name.trim() : "";
    const label = trimmedName.length > 0 ? trimmedName : action.bundle_id;
    return lang === "ko" ? `앱 열기 · ${label}` : `Open app · ${label}`;
  }
  return JSON.stringify(action);
};
