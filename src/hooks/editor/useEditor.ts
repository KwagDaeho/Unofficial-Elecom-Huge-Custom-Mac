import { createContext, useContext, useState } from "react";
import { useKeyCapture } from "@/hooks/capture/useKeyCapture";
import { useProfileCtx } from "@/hooks/profile";
import {
  ballScrollHoldConflictsWithGesture,
  gestureHoldConflictsWithBallScroll,
} from "@/domain/profile";
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
  const { profile, ballScroll, gestureMappings, catalogSelection } =
    useProfileCtx();
  const [editor, setEditor] = useState<EditorMode | null>(null);
  useKeyCapture(
    editor,
    setEditor,
    (slot, activator) => {
      if (
        slot === "hold" &&
        profile !== null &&
        ballScrollHoldConflictsWithGesture(profile, activator)
      ) {
        setEditor((previousEditor) => {
          if (
            previousEditor === null ||
            previousEditor.kind !== "ball_scroll_activator" ||
            previousEditor.slot !== "hold"
          ) {
            return previousEditor;
          }
          return { ...previousEditor, rejected: "gesture" };
        });
        return false;
      }
      ballScroll.assignActivator(slot, activator);
      return true;
    },
    (entryId, activator) => {
      if (
        profile !== null &&
        gestureHoldConflictsWithBallScroll(profile, activator)
      ) {
        setEditor((previousEditor) => {
          if (
            previousEditor === null ||
            previousEditor.kind !== "gesture_hold_activator" ||
            previousEditor.entryId !== entryId
          ) {
            return previousEditor;
          }
          return { ...previousEditor, rejected: "ball_scroll" };
        });
        return false;
      }
      gestureMappings.updateHoldActivator(entryId, activator);
      return true;
    },
  );
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
  const selectGesture = (entryId: string, slot: ActionSlot, value: string) => {
    catalogSelection.selectGesture(entryId, slot, value, setEditor);
  };
  return {
    editor,
    setEditor,
    catalogSelection: {
      selectButton,
      selectCustom,
      selectGesture,
    },
  };
};
