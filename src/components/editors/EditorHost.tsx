import { CustomKeyEditor } from "./CustomKeyEditor";
import { MacroEditor } from "./MacroEditor";
import { OpenAppEditor } from "./OpenAppEditor";
import { ActivatorEditor } from "./ActivatorEditor";
import { ComboActivatorEditor } from "./ComboActivatorEditor";
import { GestureHoldActivatorEditor } from "./GestureHoldActivatorEditor";
import { GesturePathEditor } from "./GesturePathEditor";
import { useEditor } from "@/hooks/editor";

export const EditorHost = () => {
  const { editor } = useEditor();
  if (editor === null) {
    return null;
  }
  switch (editor.kind) {
    case "custom_key":
      return <CustomKeyEditor editor={editor} />;
    case "macro":
      return <MacroEditor editor={editor} />;
    case "open_app":
      return <OpenAppEditor editor={editor} />;
    case "ball_scroll_activator":
      return <ActivatorEditor editor={editor} />;
    case "gesture_hold_activator":
      return <GestureHoldActivatorEditor editor={editor} />;
    case "gesture_path_recorder":
      return <GesturePathEditor editor={editor} />;
    case "custom_combo_activator":
      return <ComboActivatorEditor editor={editor} />;
    default:
      return null;
  }
};
