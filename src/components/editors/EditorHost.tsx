import { CustomKeyEditor } from "./CustomKeyEditor";
import { MacroEditor } from "./MacroEditor";
import { OpenAppEditor } from "./OpenAppEditor";
import { ActivatorEditor } from "./ActivatorEditor";
import { ComboActivatorEditor } from "./ComboActivatorEditor";
import { useSession } from "../../context/session";

export function EditorHost() {
  const { editor } = useSession();
  if (!editor) return null;

  switch (editor.kind) {
    case "custom_key":
      return <CustomKeyEditor editor={editor} />;
    case "macro":
      return <MacroEditor editor={editor} />;
    case "open_app":
      return <OpenAppEditor editor={editor} />;
    case "ball_scroll_activator":
      return <ActivatorEditor editor={editor} />;
    case "custom_combo_activator":
      return <ComboActivatorEditor editor={editor} />;
    default:
      return null;
  }
}
