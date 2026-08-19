import { Button } from "../ui/Button";

interface MacroKeyPromptProps {
  title: string;
  hint: string;
  waitingLabel: string;
  cancelLabel: string;
  onCancel: () => void;
}

export const MacroKeyPrompt = (props: MacroKeyPromptProps) => {
  return (
    <div
      className="editor-nested-backdrop"
      role="presentation"
      onClick={props.onCancel}
    >
      <div
        className="modal macro-key-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="macro-key-prompt-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            props.onCancel();
          }
        }}
      >
        <h2 id="macro-key-prompt-title">{props.title}</h2>
        <p className="muted">{props.hint}</p>
        <div className="chord-preview">{props.waitingLabel}</div>
        <div className="row">
          <Button variant="ghost" onClick={props.onCancel}>
            {props.cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
