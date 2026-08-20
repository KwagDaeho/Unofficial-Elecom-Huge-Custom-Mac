import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CANVAS_RECORDER_HEIGHT,
  CANVAS_RECORDER_WIDTH,
} from "@/constants/gestureCanvas";
import { MIN_RAW_PATH_LENGTH } from "@/constants/gesture";
import {
  normalizeGesturePreview,
  normalizeGestureTemplate,
  pathBendSignature,
  rawPathLength,
  significantCornerCount,
  subscribeGestureCanvasUiChange,
  type GestureDrawPhase,
} from "@/domain/gesture";
import { useGestureCanvasRecorder } from "@/hooks/gesture";
import type { GesturePoint } from "@/types";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { cx } from "@/utils/cx";
import { Button, Modal, Muted, Row } from "@/components/ui";
import type { GesturePathRecorderState } from "@/types";

import * as styles from "./GesturePathEditor.css";

interface GesturePathEditorProps {
  editor: GesturePathRecorderState;
}

export const GesturePathEditor = (props: GesturePathEditorProps) => {
  const { i18n } = usePrefs();
  const { gestureMappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<GesturePoint[]>([]);
  const stopRef = useRef<() => void>(() => {});

  const [drawPhase, setDrawPhase] = useState<GestureDrawPhase>("idle");
  const [points, setPoints] = useState<GesturePoint[]>([]);

  useEffect(() => {
    return subscribeGestureCanvasUiChange(({ phase, points: nextPoints }) => {
      pointsRef.current = nextPoints;
      setDrawPhase(phase);
      setPoints(nextPoints);
    });
  }, []);

  const {
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseEnter,
    onCanvasMouseLeave,
    onCanvasMouseUp,
    stop,
    clear,
  } = useGestureCanvasRecorder(canvasRef, i18n.gestureShapeHint);

  const isDrawing = drawPhase === "drawing";
  const strokeLocked = drawPhase === "done" && points.length > 0;
  const pathOk = rawPathLength(points) >= MIN_RAW_PATH_LENGTH;
  const showRedraw = !isDrawing && points.length > 0;

  const statusText = useMemo(() => {
    if (isDrawing) {
      return i18n.gestureShapeRecording;
    }
    if (!pathOk || points.length < 2) {
      return i18n.gestureShapeTooShort;
    }
    return i18n.gestureShapePreview.replace("{score}", "…");
  }, [i18n, isDrawing, pathOk, points.length]);

  stopRef.current = stop;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopRef.current();
        setEditor(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setEditor]);

  const resetCanvas = useCallback(() => {
    clear();
  }, [clear]);

  const closeEditor = useCallback(() => {
    resetCanvas();
    setEditor(null);
  }, [resetCanvas, setEditor]);

  const saveTemplate = useCallback(() => {
    const committed = pointsRef.current;
    if (rawPathLength(committed) < MIN_RAW_PATH_LENGTH || drawPhase === "drawing") {
      return;
    }
    gestureMappings.updateTemplate(
      props.editor.entryId,
      normalizeGestureTemplate(committed),
      rawPathLength(committed),
      normalizeGesturePreview(committed),
      significantCornerCount(committed),
      pathBendSignature(committed),
    );
    setEditor(null);
  }, [drawPhase, gestureMappings, props.editor.entryId, setEditor]);

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
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseEnter={onCanvasMouseEnter}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseLeave}
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
