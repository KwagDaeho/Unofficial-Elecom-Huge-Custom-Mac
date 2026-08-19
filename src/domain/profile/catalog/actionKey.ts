import type { Action } from "@/types";
export const actionKey = (action: Action | undefined): string => {
  if (!action) return JSON.stringify({ type: "default" });
  return JSON.stringify(action);
};
export const actionFromKey = (key: string): Action => {
  try {
    return JSON.parse(key) as Action;
  } catch {
    return { type: "default" };
  }
};
