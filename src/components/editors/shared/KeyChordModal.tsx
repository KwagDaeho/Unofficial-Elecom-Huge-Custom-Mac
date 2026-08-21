import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import {
  Button,
  ChordError,
  ChordPreview,
  Modal,
  Muted,
  Row,
} from "@/components/ui";
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
    dialogRef.current?.focus();
  }, []);

  const showSaveButton = props.handlers.onSave !== undefined;

  return (
    <Modal ref={dialogRef} tabIndex={-1} onKeyDown={props.handlers.onKeyDown}>
      <h2>{props.copy.title}</h2>
      <Muted variant="modal">{props.copy.hint}</Muted>
      <ChordPreview>{props.preview}</ChordPreview>
      {props.error ? <ChordError>{props.error}</ChordError> : null}
      <Row>
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
      </Row>
    </Modal>
  );
};
