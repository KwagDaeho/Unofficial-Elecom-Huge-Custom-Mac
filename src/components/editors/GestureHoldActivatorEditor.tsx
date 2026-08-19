import { activatorRejectedMessage } from "@/domain/editors";
import { usePrefs } from "@/hooks/prefs";
import { useEditor } from "@/hooks/editor";
import { Button } from "../ui/Button";
import type { GestureHoldActivatorState } from "@/types";

interface GestureHoldActivatorEditorProps {
  editor: GestureHoldActivatorState;
}

export const GestureHoldActivatorEditor = (
  props: GestureHoldActivatorEditorProps,
) => {
  const { i18n } = usePrefs();
  const { setEditor } = useEditor();
  const editor = props.editor;
  const rejectedMessage = activatorRejectedMessage(editor.rejected, {
    left: i18n.activatorRejectedLeft,
    tilt: i18n.activatorRejectedTilt,
    ball_scroll: i18n.gestureHoldRejectedBallScroll,
  });
  const statusMessage =
    rejectedMessage !== null ? rejectedMessage : i18n.gestureHoldKeyWaiting;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{i18n.gestureHoldKeyTitle}</h2>
        <p className="muted">{i18n.gestureHoldKeyHint}</p>
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
