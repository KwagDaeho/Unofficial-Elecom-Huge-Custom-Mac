import { activatorRejectedMessage } from "@/domain/editors";
import { usePrefs } from "@/hooks/prefs";
import { useEditor } from "@/hooks/editor";
import {
  Button,
  ChordPreview,
  Modal,
  Muted,
  Row,
} from "@/components/ui";
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
    gesture: i18n.ballScrollRejectedGesture,
  });
  const slotLabel =
    editor.slot === "toggle" ? i18n.ballScrollToggle : i18n.ballScrollHold;
  const statusMessage =
    rejectedMessage !== null ? rejectedMessage : i18n.activatorWaiting;

  return (
    <Modal>
      <h2>
        {i18n.activatorTitle} · {slotLabel}
      </h2>
      <Muted variant="modal">{i18n.activatorHint}</Muted>
      <ChordPreview>{statusMessage}</ChordPreview>
      <Row>
        <Button variant="ghost" onClick={() => setEditor(null)}>
          {i18n.cancel}
        </Button>
      </Row>
    </Modal>
  );
};
