import { clampMacroDelayMs } from "@/domain/editors/macro";
import type { MacroEditorState, MacroStep } from "@/types";
interface MacroDelayControlsProps {
  editor: MacroEditorState;
  delayLabel: string;
  onStepsChange: (steps: MacroStep[]) => void;
}
export const MacroDelayControls = (props: MacroDelayControlsProps) => {
  const delaySteps = props.editor.steps
    .map((step, index) => ({ step, index }))
    .filter((entry) => entry.step.type === "delay");
  if (delaySteps.length === 0) {
    return null;
  }
  return (
    <div className="controls tight">
      {delaySteps.map(({ step, index }) =>
        step.type === "delay" ? (
          <label key={`delay-${index}`}>
            {props.delayLabel} #{index + 1}
            <input
              type="number"
              min={0}
              max={5000}
              value={step.ms}
              onChange={(event) => {
                const nextSteps = props.editor.steps.slice();
                nextSteps[index] = {
                  type: "delay",
                  ms: clampMacroDelayMs(Number(event.target.value) || 0),
                };
                props.onStepsChange(nextSteps);
              }}
            />
          </label>
        ) : null,
      )}
    </div>
  );
};
