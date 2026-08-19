import type { KeyboardEventHandler, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";

type Props = {
  title: string;
  hint: string;
  preview: ReactNode;
  error?: ReactNode;
  onCancel: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  saveLabel: string;
  cancelLabel: string;
  onKeyDown?: KeyboardEventHandler;
};

export function KeyChordModal({
  title,
  hint,
  preview,
  error,
  onCancel,
  onSave,
  saveDisabled,
  saveLabel,
  cancelLabel,
  onKeyDown,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}>
        <h2>{title}</h2>
        <p className="muted">{hint}</p>
        <div className="chord-preview">{preview}</div>
        {error ? <p className="chord-error">{error}</p> : null}
        <div className="row">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {onSave ? (
            <Button disabled={saveDisabled} onClick={onSave}>
              {saveLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
