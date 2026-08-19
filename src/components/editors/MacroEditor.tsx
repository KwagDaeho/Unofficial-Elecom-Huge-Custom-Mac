import { formatMacroStepLabel } from "@/i18n/macro";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { Button } from "../ui/Button";
import { MacroDelayControls } from "./MacroDelayControls";
import type { MacroEditorState, MacroStep } from "@/types";

interface MacroEditorProps {
  editor: MacroEditorState;
}

export function MacroEditor(props: MacroEditorProps) {
  const { lang, i18n } = usePrefs();
  const { mappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const editor = props.editor;

  function updateSteps(steps: MacroStep[]) {
    setEditor({ ...editor, steps });
  }

  function handleSave() {
    mappings.updateSlot(editor.target, editor.slot, {
      type: "macro",
      steps: editor.steps,
    });
    setEditor(null);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <h2>{i18n.macroTitle}</h2>
        <p className="muted">{i18n.macroHint}</p>
        <ul className="macro-steps">
          {editor.steps.map((step, stepIndex) => (
            <li key={`${stepIndex}-${step.type}`}>
              <span>{formatMacroStepLabel(step, lang)}</span>
              <Button
                variant="ghost"
                size="tiny"
                onClick={() =>
                  updateSteps(editor.steps.filter((_, index) => index !== stepIndex))
                }>
                {i18n.removeStep}
              </Button>
            </li>
          ))}
        </ul>
        {editor.capturing ? (
          <p className="chord-preview">{i18n.customKeyWaiting}</p>
        ) : null}
        <div className="row wrap">
          <Button
            variant="ghost"
            onClick={() => setEditor({ ...editor, capturing: true })}>
            {i18n.addKeystroke}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              updateSteps([...editor.steps, { type: "delay", ms: 100 }])
            }>
            {i18n.addDelay}
          </Button>
        </div>
        <MacroDelayControls
          editor={editor}
          delayLabel={i18n.delayMs}
          onStepsChange={updateSteps}
        />
        <div className="row">
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
          <Button
            disabled={editor.steps.length === 0}
            onClick={handleSave}>
            {i18n.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
