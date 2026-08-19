import type { Action } from "../action";
import type { EditorMode } from "../ui";

export type CatalogSelectionResult =
  | { kind: "editor"; editor: EditorMode }
  | { kind: "action"; action: Action }
  | { kind: "noop" };
