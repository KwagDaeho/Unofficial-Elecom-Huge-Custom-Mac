import type { Action, CatalogEntry } from "@/types";
import { normalizeKeys } from "@/domain/keys";
import { ACTION_CATALOG } from "./catalog";
export const actionsEqual = (a: Action, b: Action): boolean => {
  if (a.type !== b.type) return false;
  if (a.type === "key_stroke" && b.type === "key_stroke") {
    const normalizedLeft = normalizeKeys(a.keys).join("+");
    const normalizedRight = normalizeKeys(b.keys).join("+");
    return normalizedLeft === normalizedRight;
  }
  if (a.type === "open_app" && b.type === "open_app") {
    return (
      a.bundle_id === b.bundle_id &&
      a.bundle_id !== undefined &&
      a.bundle_id.length > 0
    );
  }
  return JSON.stringify(a) === JSON.stringify(b);
};
export const findCatalogEntry = (action: Action): CatalogEntry | undefined => {
  return ACTION_CATALOG.find(
    (e) => !e.special && actionsEqual(e.action, action),
  );
};
