import { useEffect, useRef, useState } from "react";

import { clampMacroDelayMs } from "@/domain/editors";
import { Button, Modal, Row } from "@/components/ui";

import * as styles from "./MacroDelayPrompt.css";

interface MacroDelayPromptProps {
  title: string;
  delayLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  initialMs: number;
  onConfirm: (ms: number) => void;
  onCancel: () => void;
}

export const MacroDelayPrompt = (props: MacroDelayPromptProps) => {
  const [ms, setMs] = useState(String(props.initialMs));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    props.onConfirm(clampMacroDelayMs(Number(ms) || 0));
  };

  return (
    <Modal
      nested
      compact
      onBackdropClick={props.onCancel}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
        if (event.key === "Escape") {
          props.onCancel();
        }
      }}
    >
      <h2 id="macro-delay-prompt-title">{props.title}</h2>
      <label className={styles.delayField}>
        {props.delayLabel}
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={5000}
          inputMode="numeric"
          value={ms}
          onChange={(event) => setMs(event.target.value)}
        />
      </label>
      <Row>
        <Button variant="ghost" onClick={props.onCancel}>
          {props.cancelLabel}
        </Button>
        <Button onClick={submit}>{props.confirmLabel}</Button>
      </Row>
    </Modal>
  );
};
