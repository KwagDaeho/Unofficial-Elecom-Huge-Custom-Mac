import type { Action } from "../../types/index";

export function actionKey(action: Action | undefined): string {
  if (!action) return JSON.stringify({ type: "default" });
  return JSON.stringify(action);
}

export function actionFromKey(key: string): Action {
  try {
    return JSON.parse(key) as Action;
  } catch {
    return { type: "default" };
  }
}
