import { findCatalogEntry } from "@/domain/actions";
import { actionKey } from "./actionKey";
import type { Action } from "@/types";
export const catalogValueForAction = (action: Action): string => {
  const entry = findCatalogEntry(action);
  if (entry !== undefined) {
    return actionKey(entry.action);
  }
  return actionKey(action);
};
