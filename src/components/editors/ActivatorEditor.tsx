import { usePrefs } from "../../context/prefs";
import { useSession } from "../../context/session";
import { Button } from "../ui/Button";
import type { EditorMode } from "../../types";

type ActivatorEditorState = Extract<EditorMode, { kind: "ball_scroll_activator" }>;

export function ActivatorEditor({ editor }: { editor: ActivatorEditorState }) {
  const { i18n } = usePrefs();
  const { setEditor } = useSession();
  const rejected =
    editor.rejected === "left"
      ? i18n.activatorRejectedLeft
      : editor.rejected === "tilt"
        ? i18n.activatorRejectedTilt
        : null;

  const slotLabel =
    editor.slot === "toggle" ? i18n.ballScrollToggle : i18n.ballScrollHold;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>
          {i18n.activatorTitle} · {slotLabel}
        </h2>
        <p className="muted">{i18n.activatorHint}</p>
        <div className="chord-preview">{rejected ?? i18n.activatorWaiting}</div>
        <div className="row">
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
