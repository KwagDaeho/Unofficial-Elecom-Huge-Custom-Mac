import type { ActionCategoryId, Dict, Lang } from "@/types";

import { en } from "./locales/en";
import { ko } from "./locales/ko";

const STRINGS = {
  ko,
  en,
} as const;

export const t = (lang: Lang): Dict => {
  return STRINGS[lang] as Dict;
};

export const buttonLabel = (id: string, lang: Lang): string => {
  const labels = t(lang).buttons as Record<string, string>;
  if (id in labels) {
    return labels[id];
  }
  return id;
};

export const entryLabel = (id: string, lang: Lang): string => {
  const labels = t(lang).entries as Record<string, string>;
  if (id in labels) {
    return labels[id];
  }
  return id;
};

export const categoryLabel = (id: ActionCategoryId, lang: Lang): string => {
  return t(lang).categories[id];
};
