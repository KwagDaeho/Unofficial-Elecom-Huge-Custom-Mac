import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  MIN_RAW_PATH_LENGTH,
  matchGestureScore,
  normalizeGestureTemplate,
  rawPathLength,
} from "@/domain/gesture";
import {
  CANVAS_RECORDER_HEIGHT,
  CANVAS_RECORDER_WIDTH,
} from "@/domain/gesture/canvasRecorder";
import { useGestureCanvasRecorder } from "@/hooks/gesture/useGestureCanvasRecorder";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { Button } from "../ui/Button";
import type { GesturePoint, GesturePathRecorderState } from "@/types";

interface GesturePathEditorProps {
  editor: GesturePathRecorderState;
}

const CANVAS_BG = "#ffffff";
const CANVAS_STROKE = "#c07bc4";
const CANVAS_GUIDE = "#6b6270";

const drawPath = (
  context: CanvasRenderingContext2D,
  points: GesturePoint[],
  stroke: string,
) => {
  if (points.length < 2) {
    return;
  }
  context.strokeStyle = stroke;
  context.lineWidth = 2.5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.stroke();
};

export const GesturePathEditor = (props: GesturePathEditorProps) => {
  const { i18n } = usePrefs();
  const { gestureMappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    recording,
    points,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerEnd,
    stop,
    clear,
  } = useGestureCanvasRecorder(canvasRef);

  const paint = useCallback(
    (nextPoints: GesturePoint[]) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.clearRect(0, 0, CANVAS_RECORDER_WIDTH, CANVAS_RECORDER_HEIGHT);
      context.fillStyle = CANVAS_BG;
      context.fillRect(0, 0, CANVAS_RECORDER_WIDTH, CANVAS_RECORDER_HEIGHT);
      if (nextPoints.length === 0) {
        context.fillStyle = CANVAS_GUIDE;
        context.font = "13px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
          i18n.gestureShapeHint,
          CANVAS_RECORDER_WIDTH / 2,
          CANVAS_RECORDER_HEIGHT / 2,
          CANVAS_RECORDER_WIDTH - 24,
        );
        return;
      }
      if (nextPoints.length === 1) {
        context.fillStyle = CANVAS_STROKE;
        context.beginPath();
        context.arc(nextPoints[0].x, nextPoints[0].y, 3, 0, Math.PI * 2);
        context.fill();
      }
      drawPath(context, nextPoints, CANVAS_STROKE);
    },
    [i18n.gestureShapeHint],
  );

  useEffect(() => {
    paint(points);
  }, [paint, points]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stop();
        setEditor(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setEditor, stop]);

  const pathOk = rawPathLength(points) >= MIN_RAW_PATH_LENGTH;
  const previewScore = useMemo(() => {
    if (recording || !pathOk || points.length < 2) {
      return 0;
    }
    return matchGestureScore(points, normalizeGestureTemplate(points));
  }, [recording, pathOk, points]);
  const showRedraw = !recording && points.length > 0;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <h2>{i18n.gestureShapeTitle}</h2>
        <p className="muted">{i18n.gestureShapeHint}</p>
        <canvas
          ref={canvasRef}
          className="gesture-record-canvas"
          width={CANVAS_RECORDER_WIDTH}
          height={CANVAS_RECORDER_HEIGHT}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerEnd}
          onPointerCancel={onCanvasPointerEnd}
          onPointerLeave={(event) => {
            if (event.buttons === 0 && recording) {
              stop();
            }
          }}
        />
        <p className="muted gesture-record-status">
          {recording
            ? i18n.gestureShapeRecording
            : pathOk
              ? i18n.gestureShapePreview.replace(
                  "{score}",
                  Math.round(previewScore * 100).toString(),
                )
              : i18n.gestureShapeTooShort}
        </p>
        {showRedraw ? (
          <div className="row">
            <Button variant="ghost" onClick={clear}>
              {i18n.gestureShapeRedraw}
            </Button>
          </div>
        ) : null}
        <div className="row">
          <Button
            variant="ghost"
            onPointerDown={(event) => {
              event.stopPropagation();
              clear();
              setEditor(null);
            }}
            onClick={() => {
              clear();
              setEditor(null);
            }}
          >
            {i18n.cancel}
          </Button>
          <Button
            disabled={!pathOk || recording}
            onClick={() => {
              if (!pathOk || recording) {
                return;
              }
              gestureMappings.updateTemplate(
                props.editor.entryId,
                normalizeGestureTemplate(points),
              );
              setEditor(null);
            }}
          >
            {i18n.save}
          </Button>
        </div>
      </div>
    </div>
  );
};
