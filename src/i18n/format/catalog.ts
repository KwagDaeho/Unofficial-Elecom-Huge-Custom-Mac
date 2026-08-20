import type { ActionCategoryId, CatalogEntry, Lang } from "@/types";
import { groupCatalogEntries } from "@/domain/actions";
import { categoryLabel } from "../translate";
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
