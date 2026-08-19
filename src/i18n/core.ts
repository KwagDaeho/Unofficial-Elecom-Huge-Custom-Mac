import { ko } from "./ko";
import { en } from "./en";
import type { ActionCategoryId, Dict, Lang } from "@/types";

const STRINGS = {
  ko,
  en,
} as const;

export function t(lang: Lang): Dict {
  return STRINGS[lang] as Dict;
}

export function buttonLabel(id: string, lang: Lang): string {
  const labels = t(lang).buttons as Record<string, string>;
  if (id in labels) {
    return labels[id];
  }
  return id;
}

export function entryLabel(id: string, lang: Lang): string {
  const labels = t(lang).entries as Record<string, string>;
  if (id in labels) {
    return labels[id];
  }
  return id;
}

export function categoryLabel(id: ActionCategoryId, lang: Lang): string {
  return t(lang).categories[id];
}

export { formatKeyChord } from "./keys";
export { describeAction } from "./describeAction";
export { groupCatalog } from "./groupCatalog";
export {
  formatActivator,
  formatComboActivator,
  hugeButtonLabel,
  mouseClickLabel,
  MOUSE_CLICK_ENTRY,
} from "./activators";
