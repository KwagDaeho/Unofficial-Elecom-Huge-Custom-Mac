import type { Dispatch, SetStateAction } from "react";
import type { ActionSlot, EditorMode } from "../ui";
import type { ButtonId } from "../profile";

export type EditorCatalogSelection = {
  selectButton: (buttonId: ButtonId, slot: ActionSlot, value: string) => void;
  selectCustom: (entryId: string, slot: ActionSlot, value: string) => void;
};

export type EditorContextValue = {
  editor: EditorMode | null;
  setEditor: Dispatch<SetStateAction<EditorMode | null>>;
  catalogSelection: EditorCatalogSelection;
};
