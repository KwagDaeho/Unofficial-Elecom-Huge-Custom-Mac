import { activatorRejectedMessage } from "@/domain/editors";
import { usePrefs } from "@/hooks/prefs";
import { useEditor } from "@/hooks/editor";
import type { GestureHoldActivatorState } from "@/types";

import { ActivatorCaptureModal } from "../shared";

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
    <ActivatorCaptureModal
      title={i18n.gestureHoldKeyTitle}
      hint={i18n.gestureHoldKeyHint}
      statusMessage={statusMessage}
      cancelLabel={i18n.cancel}
      onCancel={() => setEditor(null)}
    />
  );
};
