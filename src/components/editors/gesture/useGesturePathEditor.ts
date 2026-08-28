import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MIN_RAW_PATH_LENGTH } from "@/constants/gesture";
import {
  matchGestureScore,
  normalizeGesturePreview,
  normalizeGestureTemplate,
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

  const { stop, clear, ...canvasHandlers } = useGestureCanvasRecorder(
    canvasRef,
    i18n.gestureShapeHint,
  );

  const isDrawing = drawPhase === "drawing";
  const strokeLocked = drawPhase === "done" && points.length > 0;
  const pathOk = rawPathLength(points) >= MIN_RAW_PATH_LENGTH;
  const normalizedTemplate = useMemo(
    () => normalizeGestureTemplate(points),
    [points],
  );
  const selfScore = useMemo(() => {
    if (!pathOk || normalizedTemplate.length < 2) {
      return null;
    }
    return matchGestureScore(points, normalizedTemplate);
  }, [normalizedTemplate, pathOk, points]);

  const statusText = useMemo(() => {
    if (isDrawing) {
      return i18n.gestureShapeRecording;
    }
    if (!pathOk || points.length < 2) {
      return i18n.gestureShapeTooShort;
    }
    if (selfScore === null) {
      return i18n.gestureShapeRecorded;
    }
    return `${i18n.gestureShapeRecorded} · ${selfScore.toFixed(2)}`;
  }, [i18n, isDrawing, pathOk, points.length, selfScore]);

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
    const template = normalizeGestureTemplate(committed);
    gestureMappings.updateTemplate(
      options.entryId,
      template,
      rawPathLength(committed),
      normalizeGesturePreview(committed),
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
