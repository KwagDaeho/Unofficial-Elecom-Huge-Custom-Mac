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
    <Modal>
      <h2>{i18n.gestureHoldKeyTitle}</h2>
      <Muted variant="modal">{i18n.gestureHoldKeyHint}</Muted>
      <ChordPreview>{statusMessage}</ChordPreview>
      <Row>
        <Button variant="ghost" onClick={() => setEditor(null)}>
          {i18n.cancel}
        </Button>
      </Row>
    </Modal>
  );
};
