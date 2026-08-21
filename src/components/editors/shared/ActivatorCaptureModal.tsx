import type { ReactNode } from "react";

import { Button, ChordPreview, Modal, Muted, Row } from "@/components/ui";

interface ActivatorCaptureModalProps {
  title: ReactNode;
  hint: string;
  statusMessage: string;
  cancelLabel: string;
  onCancel: () => void;
}

export const ActivatorCaptureModal = (props: ActivatorCaptureModalProps) => {
  return (
    <Modal>
      <h2>{props.title}</h2>
      <Muted variant="modal">{props.hint}</Muted>
      <ChordPreview>{props.statusMessage}</ChordPreview>
      <Row>
        <Button variant="ghost" onClick={props.onCancel}>
          {props.cancelLabel}
        </Button>
      </Row>
    </Modal>
  );
};
