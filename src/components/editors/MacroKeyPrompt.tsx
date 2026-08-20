import {
  Button,
  ChordPreview,
  Modal,
  Muted,
  Row,
} from "@/components/ui";

interface MacroKeyPromptProps {
  title: string;
  hint: string;
  waitingLabel: string;
  cancelLabel: string;
  onCancel: () => void;
}

export const MacroKeyPrompt = (props: MacroKeyPromptProps) => {
  return (
    <Modal
      nested
      compact
      onBackdropClick={props.onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          props.onCancel();
        }
      }}
    >
      <h2 id="macro-key-prompt-title">{props.title}</h2>
      <Muted variant="modal">{props.hint}</Muted>
      <ChordPreview>{props.waitingLabel}</ChordPreview>
      <Row>
        <Button variant="ghost" onClick={props.onCancel}>
          {props.cancelLabel}
        </Button>
      </Row>
    </Modal>
  );
};
