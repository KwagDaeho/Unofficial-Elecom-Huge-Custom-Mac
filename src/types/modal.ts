import type { KeyboardEventHandler } from "react";

export type ModalCopy = {
  title: string;
  hint: string;
  saveLabel: string;
  cancelLabel: string;
};

export type ModalActionHandlers = {
  onCancel: () => void;
  onSave?: () => void;
  onKeyDown?: KeyboardEventHandler;
};
