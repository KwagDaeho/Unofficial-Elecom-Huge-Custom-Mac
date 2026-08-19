import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";
import type { ModalActionHandlers, ModalCopy } from "@/types";
interface KeyChordModalProps {
  copy: ModalCopy;
  preview: ReactNode;
  error?: ReactNode;
  handlers: ModalActionHandlers;
  saveDisabled?: boolean;
}
export const KeyChordModal = (props: KeyChordModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null) {
      dialog.focus();
    }
  }, []);
  const showSaveButton = props.handlers.onSave !== undefined;
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={props.handlers.onKeyDown}
      >
        <h2>{props.copy.title}</h2>
        <p className="muted">{props.copy.hint}</p>
        <div className="chord-preview">{props.preview}</div>
        {props.error ? <p className="chord-error">{props.error}</p> : null}
        <div className="row">
          <Button variant="ghost" onClick={props.handlers.onCancel}>
            {props.copy.cancelLabel}
          </Button>
          {showSaveButton ? (
            <Button
              disabled={props.saveDisabled === true}
              onClick={props.handlers.onSave}
            >
              {props.copy.saveLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
