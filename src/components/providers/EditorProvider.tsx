import type { ReactNode } from "react";
import { EditorContext, useEditorState } from "@/hooks/editor";
interface EditorProviderProps {
  children: ReactNode;
}
export const EditorProvider = (props: EditorProviderProps) => {
  const value = useEditorState();
  return (
    <EditorContext.Provider value={value}>
      {props.children}
    </EditorContext.Provider>
  );
};
