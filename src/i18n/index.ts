import { ko } from "./ko";
import { en } from "./en";
import type { ActionCategoryId, Dict, Lang } from "../types";

const STRINGS = {
  ko,
  en,
} as const;

export function t(lang: Lang): Dict {
  return STRINGS[lang] as Dict;
}

export function buttonLabel(id: string, lang: Lang): string {
  const labels = t(lang).buttons as Record<string, string>;
  return labels[id] ?? id;
}

export function entryLabel(id: string, lang: Lang): string {
  const labels = t(lang).entries as Record<string, string>;
  return labels[id] ?? id;
}

export function categoryLabel(id: ActionCategoryId, lang: Lang): string {
  return t(lang).categories[id];
}
