import { activatorRejectedMessage } from "@/domain/editors";
import { usePrefs } from "@/hooks/prefs";
import { useEditor } from "@/hooks/editor";
import { Button } from "../ui/Button";
import type { ActivatorEditorState } from "@/types";
interface ActivatorEditorProps {
  editor: ActivatorEditorState;
}
export const ActivatorEditor = (props: ActivatorEditorProps) => {
  const { i18n } = usePrefs();
  const { setEditor } = useEditor();
  const editor = props.editor;
  const rejectedMessage = activatorRejectedMessage(editor.rejected, {
    left: i18n.activatorRejectedLeft,
    tilt: i18n.activatorRejectedTilt,
  });
  const slotLabel =
    editor.slot === "toggle" ? i18n.ballScrollToggle : i18n.ballScrollHold;
  const statusMessage =
    rejectedMessage !== null ? rejectedMessage : i18n.activatorWaiting;
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>
          {i18n.activatorTitle} · {slotLabel}
        </h2>
        <p className="muted">{i18n.activatorHint}</p>
        <div className="chord-preview">{statusMessage}</div>
        <div className="row">
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
};
