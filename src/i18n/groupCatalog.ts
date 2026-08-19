import type { ActionCategoryId, CatalogEntry, Lang } from "@/types";
import { groupCatalogEntries } from "@/domain/actions/groupEntries";
import { categoryLabel } from "./core";
export const groupCatalog = (
  lang: Lang,
): {
  id: ActionCategoryId;
  label: string;
  entries: CatalogEntry[];
}[] => {
  return groupCatalogEntries().map(({ id, entries }) => ({
    id,
    label: categoryLabel(id, lang),
    entries,
  }));
};
