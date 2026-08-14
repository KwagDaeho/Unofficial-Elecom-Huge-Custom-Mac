import { formatKeyChord } from "../../domain/actions";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { Button } from "../ui/Button";
import type { EditorMode } from "../../types";

type MacroEditorState = Extract<EditorMode, { kind: "macro" }>;

export function MacroEditor({ editor }: { editor: MacroEditorState }) {
  const { lang, i18n } = usePrefs();
  const { actions } = useProfileCtx();
  const { setEditor } = useSession();

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <h2>{i18n.macroTitle}</h2>
        <p className="muted">{i18n.macroHint}</p>
        <ul className="macro-steps">
          {editor.steps.map((step, idx) => (
            <li key={`${idx}-${step.type}`}>
              <span>
                {step.type === "key_stroke"
                  ? formatKeyChord(step.keys, lang)
                  : step.type === "delay"
                    ? `${step.ms} ms`
                    : step.button}
              </span>
              <Button
                variant="ghost"
                size="tiny"
                onClick={() =>
                  setEditor({
                    ...editor,
                    steps: editor.steps.filter((_, i) => i !== idx),
                  })
                }>
                {i18n.removeStep}
              </Button>
            </li>
          ))}
        </ul>
        {editor.capturing && <p className="chord-preview">{i18n.customKeyWaiting}</p>}
        <div className="row wrap">
          <Button
            variant="ghost"
            onClick={() => setEditor({ ...editor, capturing: true })}>
            {i18n.addKeystroke}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setEditor({
                ...editor,
                steps: [...editor.steps, { type: "delay", ms: 100 }],
              })
            }>
            {i18n.addDelay}
          </Button>
        </div>
        {editor.steps.some((s) => s.type === "delay") && (
          <div className="controls tight">
            {editor.steps.map((step, idx) =>
              step.type === "delay" ? (
                <label key={`delay-${idx}`}>
                  {i18n.delayMs} #{idx + 1}
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={step.ms}
                    onChange={(e) => {
                      const ms = Math.max(0, Math.min(5000, Number(e.target.value) || 0));
                      const steps = editor.steps.slice();
                      steps[idx] = { type: "delay", ms };
                      setEditor({ ...editor, steps });
                    }}
                  />
                </label>
              ) : null,
            )}
          </div>
        )}
        <div className="row">
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
          <Button
            disabled={editor.steps.length === 0}
            onClick={() => {
              actions.updateButtonSlot(editor.buttonId, editor.slot, {
                type: "macro",
                steps: editor.steps,
              });
              setEditor(null);
            }}>
            {i18n.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
