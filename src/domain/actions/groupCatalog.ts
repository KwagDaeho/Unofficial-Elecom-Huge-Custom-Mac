import type { ActionCategoryId, CatalogEntry, Lang } from "../../types";
import { categoryLabel } from "../../i18n";
import { ACTION_CATALOG } from "./catalog";
import { CATEGORY_ORDER } from "./categories";

export function groupCatalog(lang: Lang): {
  id: ActionCategoryId;
  label: string;
  entries: CatalogEntry[];
}[] {
  const map = new Map<ActionCategoryId, CatalogEntry[]>();
  for (const cat of CATEGORY_ORDER) map.set(cat, []);
  for (const entry of ACTION_CATALOG) {
    map.get(entry.category)?.push(entry);
  }
  return CATEGORY_ORDER.map((cat) => ({
    id: cat,
    label: categoryLabel(cat, lang),
    entries: map.get(cat) ?? [],
  }));
}
