import type { Dispatch, SetStateAction } from "react";
import { formatKeyChord } from "../../domain/actions";
import type { Action, ActionSlot, ButtonId, EditorMode } from "../../types";
import type { Dict, Lang } from "../../i18n";

type MacroEditorState = Extract<EditorMode, { kind: "macro" }>;

export function MacroEditor({
  editor,
  lang,
  i18n,
  setEditor,
  onSave,
}: {
  editor: MacroEditorState;
  lang: Lang;
  i18n: Dict;
  setEditor: Dispatch<SetStateAction<EditorMode | null>>;
  onSave: (buttonId: ButtonId, slot: ActionSlot, action: Action) => void;
}) {
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
              <button
                type="button"
                className="ghost tiny-btn"
                onClick={() =>
                  setEditor({
                    ...editor,
                    steps: editor.steps.filter((_, i) => i !== idx),
                  })
                }>
                {i18n.removeStep}
              </button>
            </li>
          ))}
        </ul>
        {editor.capturing && <p className="chord-preview">{i18n.customKeyWaiting}</p>}
        <div className="row wrap">
          <button type="button" className="ghost" onClick={() => setEditor({ ...editor, capturing: true })}>
            {i18n.addKeystroke}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setEditor({
                ...editor,
                steps: [...editor.steps, { type: "delay", ms: 100 }],
              })
            }>
            {i18n.addDelay}
          </button>
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
          <button type="button" className="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </button>
          <button
            type="button"
            disabled={editor.steps.length === 0}
            onClick={() => {
              onSave(editor.buttonId, editor.slot, {
                type: "macro",
                steps: editor.steps,
              });
              setEditor(null);
            }}>
            {i18n.save}
          </button>
        </div>
      </div>
    </div>
  );
}
