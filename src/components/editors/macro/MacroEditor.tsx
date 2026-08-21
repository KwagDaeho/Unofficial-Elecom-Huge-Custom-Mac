import { useState } from "react";

import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { Button, Modal, Muted, Row } from "@/components/ui";
import type { MacroEditorState, MacroStep } from "@/types";

import { MacroDelayPrompt } from "./MacroDelayPrompt";
import { MacroKeyPrompt } from "./MacroKeyPrompt";
import { MacroStepList } from "./MacroStepList";

interface MacroEditorProps {
  editor: MacroEditorState;
}

type DelayPrompt =
  | { mode: "add" }
  | { mode: "edit"; index: number };

export const MacroEditor = (props: MacroEditorProps) => {
  const { lang, i18n } = usePrefs();
  const { mappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const editor = props.editor;
  const [delayPrompt, setDelayPrompt] = useState<DelayPrompt | null>(null);

  const updateSteps = (steps: MacroStep[]) => {
    setEditor({ ...editor, steps });
  };

  const handleSave = () => {
    mappings.updateSlot(editor.target, editor.slot, {
      type: "macro",
      steps: editor.steps,
    });
    setEditor(null);
  };

  const openKeyPrompt = (mode: "add" | "edit", index?: number) => {
    setEditor({
      ...editor,
      keyPrompt:
        mode === "add" ? { mode: "add" } : { mode: "edit", index: index! },
    });
  };

  const handleEditStep = (index: number) => {
    const step = editor.steps[index];
    if (step?.type === "delay") {
      setDelayPrompt({ mode: "edit", index });
      return;
    }
    if (step?.type === "key_stroke") {
      openKeyPrompt("edit", index);
    }
  };

  const promptInitialMs =
    delayPrompt?.mode === "edit"
      ? (() => {
          const step = editor.steps[delayPrompt.index];
          return step?.type === "delay" ? step.ms : 100;
        })()
      : 100;

  return (
    <>
      <Modal wide>
        <h2>{i18n.macroTitle}</h2>
        <Muted variant="modal">{i18n.macroHint}</Muted>
        <MacroStepList
          steps={editor.steps}
          lang={lang}
          editLabel={i18n.editStep}
          removeLabel={i18n.removeStep}
          reorderHint={i18n.macroReorderHint}
          onStepsChange={updateSteps}
          onEditStep={handleEditStep}
        />
        <Row wrap>
          <Button variant="ghost" onClick={() => openKeyPrompt("add")}>
            {i18n.addKeystroke}
          </Button>
          <Button variant="ghost" onClick={() => setDelayPrompt({ mode: "add" })}>
            {i18n.addDelay}
          </Button>
        </Row>
        <Row>
          <Button variant="ghost" onClick={() => setEditor(null)}>
            {i18n.cancel}
          </Button>
          <Button disabled={editor.steps.length === 0} onClick={handleSave}>
            {i18n.save}
          </Button>
        </Row>
      </Modal>
      {editor.keyPrompt ? (
        <MacroKeyPrompt
          title={
            editor.keyPrompt.mode === "add"
              ? i18n.addKeystroke
              : i18n.editKeystroke
          }
          hint={i18n.customKeyHint}
          waitingLabel={i18n.customKeyWaiting}
          cancelLabel={i18n.cancel}
          onCancel={() => setEditor({ ...editor, keyPrompt: null })}
        />
      ) : null}
      {delayPrompt ? (
        <MacroDelayPrompt
          title={
            delayPrompt.mode === "add" ? i18n.addDelay : i18n.editDelay
          }
          delayLabel={i18n.delayMs}
          confirmLabel={i18n.save}
          cancelLabel={i18n.cancel}
          initialMs={promptInitialMs}
          onConfirm={(ms) => {
            if (delayPrompt.mode === "add") {
              updateSteps([...editor.steps, { type: "delay", ms }]);
            } else {
              const next = editor.steps.slice();
              next[delayPrompt.index] = { type: "delay", ms };
              updateSteps(next);
            }
            setDelayPrompt(null);
          }}
          onCancel={() => setDelayPrompt(null)}
        />
      ) : null}
    </>
  );
};
