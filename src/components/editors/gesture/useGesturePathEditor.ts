import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MIN_GESTURE_SEGMENTS, MIN_RAW_PATH_LENGTH } from "@/constants/gesture";
import {
  extractGestureVector,
  formatGestureVector,
  rawPathLength,
  subscribeGestureCanvasUiChange,
  type GestureDrawPhase,
} from "@/domain/gesture";
import { useGestureCanvasRecorder } from "@/hooks/gesture";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import type { GesturePoint } from "@/types";

interface UseGesturePathEditorOptions {
  entryId: string;
}

export const useGesturePathEditor = (options: UseGesturePathEditorOptions) => {
  const { lang, i18n } = usePrefs();
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

  const { stop, clear, ...canvasHandlers } = useGestureCanvasRecorder(
    canvasRef,
    i18n.gestureShapeHint,
  );

  const isDrawing = drawPhase === "drawing";
  const strokeLocked = drawPhase === "done" && points.length > 0;
  const vector = useMemo(() => extractGestureVector(points), [points]);
  const pathOk =
    rawPathLength(points) >= MIN_RAW_PATH_LENGTH &&
    vector.directions.length >= MIN_GESTURE_SEGMENTS;

  const statusText = useMemo(() => {
    if (isDrawing) {
      return i18n.gestureShapeRecording;
    }
    if (!pathOk || points.length < 2) {
      return i18n.gestureShapeTooShort;
    }
    return formatGestureVector(
      vector.directions,
      vector.segmentLengths,
      lang,
    );
  }, [i18n, isDrawing, lang, pathOk, points.length, vector]);

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
    const nextVector = extractGestureVector(committed);
    if (
      rawPathLength(committed) < MIN_RAW_PATH_LENGTH ||
      drawPhase === "drawing" ||
      nextVector.directions.length < MIN_GESTURE_SEGMENTS
    ) {
      return;
    }
    gestureMappings.updateTemplate(
      options.entryId,
      nextVector.directions,
      nextVector.segmentLengths,
      nextVector.totalLength,
    );
    setEditor(null);
  }, [drawPhase, gestureMappings, options.entryId, setEditor]);

  return {
    canvasRef,
    canvasHandlers,
    drawPhase,
    isDrawing,
    strokeLocked,
    pathOk,
    hasStroke: points.length > 0,
    statusText,
    resetCanvas,
    closeEditor,
    saveTemplate,
  };
};
