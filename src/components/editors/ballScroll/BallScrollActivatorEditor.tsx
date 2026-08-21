import { activatorRejectedMessage } from "@/domain/editors";
import { usePrefs } from "@/hooks/prefs";
import { useEditor } from "@/hooks/editor";
import type { ActivatorEditorState } from "@/types";

import { ActivatorCaptureModal } from "../shared";

interface BallScrollActivatorEditorProps {
  editor: ActivatorEditorState;
}

export const BallScrollActivatorEditor = (props: BallScrollActivatorEditorProps) => {
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
    <ActivatorCaptureModal
      title={
        <>
          {i18n.activatorTitle} · {slotLabel}
        </>
      }
      hint={i18n.activatorHint}
      statusMessage={statusMessage}
      cancelLabel={i18n.cancel}
      onCancel={() => setEditor(null)}
    />
  );
};
