import type { ActionCategoryId, CatalogEntry } from "@/types";
import { ACTION_CATEGORY_ORDER } from "@/constants/actionCategories";
import { ACTION_CATALOG } from "./catalog";
const entriesForCategory = (
  map: Map<ActionCategoryId, CatalogEntry[]>,
  categoryId: ActionCategoryId,
): CatalogEntry[] => {
  const entries = map.get(categoryId);
  if (entries === undefined) {
    throw new Error(`Unknown action category: ${categoryId}`);
  }
  return entries;
};
export const groupCatalogEntries = (): {
  id: ActionCategoryId;
  entries: CatalogEntry[];
}[] => {
  const map = new Map<ActionCategoryId, CatalogEntry[]>();
  for (const categoryId of ACTION_CATEGORY_ORDER) {
    map.set(categoryId, []);
  }
  for (const entry of ACTION_CATALOG) {
    entriesForCategory(map, entry.category).push(entry);
  }
  return ACTION_CATEGORY_ORDER.map((categoryId) => ({
    id: categoryId,
    entries: entriesForCategory(map, categoryId),
  }));
};
