import { createContext, useContext, useState } from "react";
import { useKeyCapture } from "@/hooks/capture/useKeyCapture";
import { useProfileCtx } from "@/hooks/profile";
import type {
  ActionSlot,
  ButtonId,
  EditorContextValue,
  EditorMode,
} from "@/types";
export const EditorContext = createContext<EditorContextValue | null>(null);
export const useEditor = (): EditorContextValue => {
  const context = useContext(EditorContext);
  if (context === null) {
    throw new Error("useEditor must be used within EditorProvider");
  }
  return context;
};
export const useEditorState = (): EditorContextValue => {
  const { ballScroll, catalogSelection } = useProfileCtx();
  const [editor, setEditor] = useState<EditorMode | null>(null);
  useKeyCapture(editor, setEditor, (slot, activator) => {
    ballScroll.assignActivator(slot, activator);
  });
  const selectButton = (
    buttonId: ButtonId,
    slot: ActionSlot,
    value: string,
  ) => {
    catalogSelection.selectButton(buttonId, slot, value, setEditor);
  };
  const selectCustom = (entryId: string, slot: ActionSlot, value: string) => {
    catalogSelection.selectCustom(entryId, slot, value, setEditor);
  };
  return {
    editor,
    setEditor,
    catalogSelection: {
      selectButton,
      selectCustom,
    },
  };
};
