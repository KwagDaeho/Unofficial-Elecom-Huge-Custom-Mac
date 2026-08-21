import {
  CANVAS_RECORDER_HEIGHT,
  CANVAS_RECORDER_WIDTH,
} from "@/constants/gestureCanvas";
import { usePrefs } from "@/hooks/prefs";
import { cx } from "@/utils/cx";
import { Button, Modal, Muted, Row } from "@/components/ui";
import type { GesturePathRecorderState } from "@/types";

import { useGesturePathEditor } from "./useGesturePathEditor";
import * as styles from "./GesturePathEditor.css";

interface GesturePathEditorProps {
  editor: GesturePathRecorderState;
}

export const GesturePathEditor = (props: GesturePathEditorProps) => {
  const { i18n } = usePrefs();
  const {
    canvasRef,
    canvasHandlers,
    drawPhase,
    isDrawing,
    strokeLocked,
    pathOk,
    hasStroke,
    statusText,
    resetCanvas,
    closeEditor,
    saveTemplate,
  } = useGesturePathEditor({ entryId: props.editor.entryId });

  const showRedraw = !isDrawing && hasStroke;

  return (
    <Modal
      plainBackdrop
      wide
      className={cx(
        styles.pathModal,
        drawPhase === "done" && styles.pathDone,
      )}
    >
      <h2>{i18n.gestureShapeTitle}</h2>
      <Muted variant="modal">{i18n.gestureShapeHint}</Muted>
      <canvas
        ref={canvasRef}
        className={cx(styles.canvas, strokeLocked && styles.canvasLocked)}
        width={CANVAS_RECORDER_WIDTH}
        height={CANVAS_RECORDER_HEIGHT}
        aria-disabled={strokeLocked}
        onMouseDown={canvasHandlers.onCanvasMouseDown}
        onMouseMove={canvasHandlers.onCanvasMouseMove}
        onMouseEnter={canvasHandlers.onCanvasMouseEnter}
        onMouseUp={canvasHandlers.onCanvasMouseUp}
        onMouseLeave={canvasHandlers.onCanvasMouseLeave}
      />
      <Muted variant="modal" className={styles.recordStatus}>
        {statusText}
      </Muted>
      <Row
        className={cx(styles.redrawRow, showRedraw && styles.redrawRowVisible)}
        aria-hidden={!showRedraw}
      >
        <Button variant="ghost" onClick={resetCanvas} tabIndex={showRedraw ? 0 : -1}>
          {i18n.gestureShapeRedraw}
        </Button>
      </Row>
      <Row>
        <Button
          variant="ghost"
          onPointerDown={(event) => {
            event.stopPropagation();
            closeEditor();
          }}
          onClick={closeEditor}
        >
          {i18n.cancel}
        </Button>
        <Button disabled={!pathOk || isDrawing} onClick={saveTemplate}>
          {i18n.save}
        </Button>
      </Row>
    </Modal>
  );
};
