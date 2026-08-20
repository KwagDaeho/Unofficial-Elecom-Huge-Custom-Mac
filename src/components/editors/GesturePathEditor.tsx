import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MIN_RAW_PATH_LENGTH,
  normalizeGesturePreview,
  normalizeGestureTemplate,
  pathBendSignature,
  rawPathLength,
  significantCornerCount,
} from "@/domain/gesture";
import { gcLog } from "@/domain/gesture/gestureCanvasDebug";
import {
  subscribeGestureCanvasUiChange,
  type GestureDrawPhase,
} from "@/domain/gesture/gestureCanvasUiEvent";
import {
  applyGesturePathUi,
  type GesturePathUiLabels,
  type GesturePathUiRefs,
} from "@/domain/gesture/gesturePathUi";
import { useGestureCanvasRecorder } from "@/hooks/gesture/useGestureCanvasRecorder";
import type { GesturePoint } from "@/types";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { Button } from "../ui/Button";
import type { GesturePathRecorderState } from "@/types";

interface GesturePathEditorProps {
  editor: GesturePathRecorderState;
}

export const GesturePathEditor = (props: GesturePathEditorProps) => {
  const { i18n } = usePrefs();
  const { gestureMappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const redrawRowRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<GesturePoint[]>([]);
  const stopRef = useRef<() => void>(() => {});

  const [drawPhase, setDrawPhase] = useState<GestureDrawPhase>("idle");
  const [points, setPoints] = useState<GesturePoint[]>([]);

  const uiLabels = useMemo<GesturePathUiLabels>(
    () => ({
      recording: i18n.gestureShapeRecording,
      tooShort: i18n.gestureShapeTooShort,
      preview: i18n.gestureShapePreview,
    }),
    [i18n],
  );

  const uiLabelsRef = useRef(uiLabels);
  uiLabelsRef.current = uiLabels;

  const uiRefs = useCallback((): GesturePathUiRefs => {
    return {
      status: statusRef.current,
      redrawRow: redrawRowRef.current,
      saveButton: saveButtonRef.current,
      canvas: canvasRef.current,
      modal: modalRef.current,
    };
  }, []);

  useEffect(() => {
    return subscribeGestureCanvasUiChange(({ phase, points: nextPoints }) => {
      pointsRef.current = nextPoints;
      applyGesturePathUi(uiRefs(), phase, nextPoints, uiLabelsRef.current);
      setDrawPhase(phase);
      setPoints(nextPoints);
      gcLog("state:react", {
        drawPhase: phase,
        pointCount: nextPoints.length,
        isDrawing: phase === "drawing",
        strokeLocked: phase === "done" && nextPoints.length > 0,
        statusDomPhase: statusRef.current?.dataset.phase ?? null,
        statusDomText: statusRef.current?.textContent?.slice(0, 40) ?? null,
      });
    });
  }, [uiRefs]);

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

  const pathOk = rawPathLength(points) >= MIN_RAW_PATH_LENGTH;
  const showRedraw = !isDrawing && points.length > 0;

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
    <div className="modal-backdrop modal-backdrop-plain" role="presentation">
      <div
        ref={modalRef}
        className={`modal modal-wide gesture-path-modal${drawPhase === "done" ? " gesture-path-done" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <h2>{i18n.gestureShapeTitle}</h2>
        <p className="muted">{i18n.gestureShapeHint}</p>
        <canvas
          ref={canvasRef}
          className={`gesture-record-canvas${strokeLocked ? " locked" : ""}`}
          width={320}
          height={220}
          aria-disabled={strokeLocked}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseEnter={onCanvasMouseEnter}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseLeave}
        />
        <p
          ref={statusRef}
          className="muted gesture-record-status"
          data-phase={drawPhase}
        >
          {i18n.gestureShapeTooShort}
        </p>
        <div
          ref={redrawRowRef}
          className={`row gesture-redraw-row${showRedraw ? " visible" : ""}`}
          aria-hidden={!showRedraw}
        >
          <Button variant="ghost" onClick={resetCanvas} tabIndex={showRedraw ? 0 : -1}>
            {i18n.gestureShapeRedraw}
          </Button>
        </div>
        <div className="row">
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
          <Button
            ref={saveButtonRef}
            disabled={!pathOk || isDrawing}
            onClick={saveTemplate}
          >
            {i18n.save}
          </Button>
        </div>
      </div>
    </div>
  );
};
