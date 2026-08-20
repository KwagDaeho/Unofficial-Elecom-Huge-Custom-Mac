import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  appendCanvasPoint,
  clientToCanvasPoint,
  paintGestureCanvas,
} from "@/domain/gesture/gestureCanvasPaint";
import { gcLog } from "@/domain/gesture/gestureCanvasDebug";
import {
  emitGestureCanvasUiChange,
  type GestureDrawPhase,
} from "@/domain/gesture/gestureCanvasUiEvent";
import {
  canvasRecorderInitial,
  canvasRecorderReduce,
  type CanvasRecorderState,
} from "@/domain/gesture/canvasRecorder";
import {
  ensureGestureCanvasChannel,
  subscribeGestureCanvasPhase,
} from "@/domain/gesture/gestureCanvasChannel";
import { clearGestureCanvasStroke, setGestureCanvasDrawing } from "@/services/tauri";
import type { GesturePoint } from "@/types";

export type { GestureDrawPhase } from "@/domain/gesture/gestureCanvasUiEvent";

const isClientInsideCanvas = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): boolean =>
  clientToCanvasPoint(clientX, clientY, canvas, false) !== null;

/** Leave the Tauri event stack before touching React or canvas. */
const scheduleAfterTauriEvent = (fn: () => void): void => {
  setTimeout(() => {
    requestAnimationFrame(fn);
  }, 0);
};

export const useGestureCanvasRecorder = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  hint?: string,
) => {
  const [state, dispatch] = useReducer(
    canvasRecorderReduce,
    undefined,
    canvasRecorderInitial,
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const drawPhaseRef = useRef<GestureDrawPhase>("idle");
  const committedPointsRef = useRef<GesturePoint[]>([]);

  const recordingRef = useRef(false);
  const strokeLockedRef = useRef(false);

  const livePointsRef = useRef<GesturePoint[]>([]);
  const ballAccumRef = useRef<GesturePoint | null>(null);
  const strokeModeRef = useRef<"idle" | "pointer" | "ball">("idle");
  const paintRafRef = useRef(0);
  const drawingSyncRef = useRef(false);
  const canvasHoverRef = useRef(false);
  const strokeSessionCleanupRef = useRef<(() => void) | null>(null);
  const hintRef = useRef(hint);
  hintRef.current = hint;

  const notifyUi = useCallback(
    (phase: GestureDrawPhase, points: GesturePoint[]) => {
      drawPhaseRef.current = phase;
      if (phase === "done") {
        committedPointsRef.current = points;
      } else if (phase === "idle") {
        committedPointsRef.current = [];
      }
      scheduleAfterTauriEvent(() => {
        gcLog("ui:notify", { phase, pointCount: points.length });
        emitGestureCanvasUiChange({ phase, points });
      });
    },
    [],
  );

  const syncDrawing = useCallback((active: boolean) => {
    if (drawingSyncRef.current === active) {
      return;
    }
    drawingSyncRef.current = active;
    gcLog("sync-drawing", { active });
    queueMicrotask(() => {
      void setGestureCanvasDrawing(active);
    });
  }, []);

  const paintLive = useCallback(() => {
    paintRafRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    paintGestureCanvas(context, livePointsRef.current, hintRef.current);
  }, [canvasRef]);

  const schedulePaint = useCallback(() => {
    if (paintRafRef.current !== 0) {
      return;
    }
    paintRafRef.current = requestAnimationFrame(paintLive);
  }, [paintLive]);

  const endStrokeSession = useCallback(() => {
    if (strokeSessionCleanupRef.current) {
      gcLog("stroke-session:end");
    }
    strokeSessionCleanupRef.current?.();
    strokeSessionCleanupRef.current = null;
  }, []);

  const commitStrokeRef = useRef<(source: string) => void>(() => {});

  const lastClientRef = useRef<{ x: number; y: number } | null>(null);

  const trackPointer = useCallback(
    (clientX: number, clientY: number) => {
      lastClientRef.current = { x: clientX, y: clientY };
      const canvas = canvasRef.current;
      canvasHoverRef.current =
        canvas !== null && isClientInsideCanvas(canvas, clientX, clientY);
    },
    [canvasRef],
  );

  const appendLivePoint = useCallback(
    (point: GesturePoint) => {
      const next = appendCanvasPoint(livePointsRef.current, point);
      if (next === livePointsRef.current) {
        return;
      }
      livePointsRef.current = next;
      gcLog("point:append", { count: next.length, last: next[next.length - 1] });
      schedulePaint();
    },
    [schedulePaint],
  );

  const startStrokeSession = useCallback(() => {
    endStrokeSession();
    gcLog("stroke-session:start", { mode: strokeModeRef.current });

    const onDocumentMove = (event: MouseEvent | PointerEvent) => {
      if (!recordingRef.current) {
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      trackPointer(event.clientX, event.clientY);

      if (strokeModeRef.current === "pointer") {
        if (event.buttons === 0) {
          commitStrokeRef.current("move:buttons-0");
          return;
        }
        if (!isClientInsideCanvas(canvas, event.clientX, event.clientY)) {
          commitStrokeRef.current("move:leave-canvas");
          return;
        }
        const point = clientToCanvasPoint(event.clientX, event.clientY, canvas, false);
        if (point) {
          appendLivePoint(point);
        }
        return;
      }

      if (strokeModeRef.current === "ball") {
        const point = clientToCanvasPoint(event.clientX, event.clientY, canvas, true);
        if (point) {
          appendLivePoint(point);
        }
      }
    };

    const onWindowMouseUp = () => {
      commitStrokeRef.current("window:capture:mouseup");
    };
    const onWindowPointerUp = () => {
      commitStrokeRef.current("window:capture:pointerup");
    };
    const onWindowPointerCancel = () => {
      commitStrokeRef.current("window:capture:pointercancel");
    };
    const onDocumentMouseUp = () => {
      commitStrokeRef.current("document:mouseup");
    };
    const onDocumentPointerUp = () => {
      commitStrokeRef.current("document:pointerup");
    };
    const onDocumentPointerCancel = () => {
      commitStrokeRef.current("document:pointercancel");
    };

    document.addEventListener("mousemove", onDocumentMove);
    document.addEventListener("pointermove", onDocumentMove);
    window.addEventListener("mouseup", onWindowMouseUp, true);
    window.addEventListener("pointerup", onWindowPointerUp, true);
    window.addEventListener("pointercancel", onWindowPointerCancel, true);
    document.addEventListener("mouseup", onDocumentMouseUp);
    document.addEventListener("pointerup", onDocumentPointerUp);
    document.addEventListener("pointercancel", onDocumentPointerCancel);

    strokeSessionCleanupRef.current = () => {
      document.removeEventListener("mousemove", onDocumentMove);
      document.removeEventListener("pointermove", onDocumentMove);
      window.removeEventListener("mouseup", onWindowMouseUp, true);
      window.removeEventListener("pointerup", onWindowPointerUp, true);
      window.removeEventListener("pointercancel", onWindowPointerCancel, true);
      document.removeEventListener("mouseup", onDocumentMouseUp);
      document.removeEventListener("pointerup", onDocumentPointerUp);
      document.removeEventListener("pointercancel", onDocumentPointerCancel);
    };
  }, [appendLivePoint, canvasRef, endStrokeSession, trackPointer]);

  const commitStroke = useCallback(
    (source: string) => {
      gcLog("commit:attempt", {
        source,
        recordingRef: recordingRef.current,
        stateRecording: stateRef.current.recording,
        liveCount: livePointsRef.current.length,
        mode: strokeModeRef.current,
      });
      if (!recordingRef.current) {
        gcLog("commit:skip-not-recording", { source });
        return;
      }
      recordingRef.current = false;
      endStrokeSession();
      strokeModeRef.current = "idle";
      ballAccumRef.current = null;
      const committed = [...livePointsRef.current];
      livePointsRef.current = committed;
      strokeLockedRef.current = committed.length > 0;
      notifyUi("done", committed);
      scheduleAfterTauriEvent(() => {
        dispatch({ type: "commit", points: committed });
        syncDrawing(false);
        void clearGestureCanvasStroke();
        schedulePaint();
      });
      gcLog("commit:done", {
        source,
        pointCount: committed.length,
        locked: strokeLockedRef.current,
        drawPhase: drawPhaseRef.current,
      });
    },
    [endStrokeSession, notifyUi, schedulePaint, syncDrawing],
  );

  commitStrokeRef.current = commitStroke;

  const stop = useCallback(
    (source = "stop") => {
      gcLog("stop", { source });
      recordingRef.current = false;
      strokeLockedRef.current = false;
      endStrokeSession();
      strokeModeRef.current = "idle";
      ballAccumRef.current = null;
      notifyUi("idle", []);
      queueMicrotask(() => {
        dispatch({ type: "stop" });
        syncDrawing(false);
      });
    },
    [endStrokeSession, notifyUi, syncDrawing],
  );

  const clear = useCallback(() => {
    gcLog("clear");
    recordingRef.current = false;
    strokeLockedRef.current = false;
    endStrokeSession();
    strokeModeRef.current = "idle";
    ballAccumRef.current = null;
    livePointsRef.current = [];
    notifyUi("idle", []);
    queueMicrotask(() => {
      dispatch({ type: "clear" });
      syncDrawing(false);
    });
    paintLive();
  }, [endStrokeSession, notifyUi, paintLive, syncDrawing]);

  const ballStartPoint = useCallback((): GesturePoint | null => {
    const canvas = canvasRef.current;
    const last = lastClientRef.current;
    if (!canvas || !last) {
      return null;
    }
    return clientToCanvasPoint(last.x, last.y, canvas, false);
  }, [canvasRef]);

  const ballStartPointRef = useRef(ballStartPoint);
  ballStartPointRef.current = ballStartPoint;

  const beginPointerStroke = useCallback(
    (clientX: number, clientY: number) => {
      if (strokeLockedRef.current || drawPhaseRef.current === "done") {
        gcLog("begin:blocked-locked");
        return;
      }
      if (recordingRef.current) {
        gcLog("begin:blocked-already-recording", { mode: strokeModeRef.current });
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      if (!isClientInsideCanvas(canvas, clientX, clientY)) {
        gcLog("begin:blocked-outside-canvas");
        return;
      }

      const start = clientToCanvasPoint(clientX, clientY, canvas, false);
      if (!start) {
        gcLog("begin:blocked-no-start-point");
        return;
      }

      trackPointer(clientX, clientY);
      recordingRef.current = true;
      notifyUi("drawing", []);
      syncDrawing(true);
      livePointsRef.current = [start];
      strokeModeRef.current = "pointer";
      queueMicrotask(() => {
        dispatch({
          type: "begin_pointer",
          point: start,
          pointerId: 1,
        });
      });

      gcLog("begin:pointer", { start, recordingRef: recordingRef.current });
      startStrokeSession();
      paintLive();
    },
    [canvasRef, notifyUi, paintLive, startStrokeSession, syncDrawing, trackPointer],
  );

  const onCanvasMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (
        event.button !== 0 ||
        strokeLockedRef.current ||
        drawPhaseRef.current === "done"
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      trackPointer(event.clientX, event.clientY);
      gcLog("event:canvas-mousedown", { x: event.clientX, y: event.clientY });
      beginPointerStroke(event.clientX, event.clientY);
    },
    [beginPointerStroke, trackPointer],
  );

  const onCanvasMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      trackPointer(event.clientX, event.clientY);
      if (strokeModeRef.current !== "pointer" || !recordingRef.current) {
        return;
      }
      if ((event.buttons & 1) === 0) {
        commitStrokeRef.current("canvas:move:buttons-0");
      }
    },
    [trackPointer],
  );

  const onCanvasMouseEnter = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      trackPointer(event.clientX, event.clientY);
      gcLog("event:canvas-mouseenter", {
        x: event.clientX,
        y: event.clientY,
      });
    },
    [trackPointer],
  );

  const onCanvasMouseLeave = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      canvasHoverRef.current = false;
      gcLog("event:canvas-mouseleave", { buttons: event.buttons });
      if (
        strokeModeRef.current === "pointer" &&
        recordingRef.current &&
        (event.buttons & 1) !== 0
      ) {
        commitStrokeRef.current("canvas:mouseleave");
      }
    },
    [],
  );

  const onCanvasMouseUp = useCallback(() => {
    gcLog("event:canvas-mouseup");
    commitStrokeRef.current("canvas:mouseup");
  }, []);

  useEffect(() => {
    void ensureGestureCanvasChannel();
  }, []);

  useEffect(() => {
    const unsubPhase = subscribeGestureCanvasPhase((phase) => {
      gcLog("ball:phase", {
        phase,
        recordingRef: recordingRef.current,
        hover: canvasHoverRef.current,
        locked: strokeLockedRef.current,
        drawPhase: drawPhaseRef.current,
        lastClient: lastClientRef.current,
      });
      if (phase === "start") {
        if (
          recordingRef.current ||
          strokeLockedRef.current ||
          drawPhaseRef.current === "done" ||
          !canvasHoverRef.current
        ) {
          gcLog("ball:start-blocked");
          return;
        }
        const start = ballStartPointRef.current();
        if (!start) {
          gcLog("ball:start-blocked-no-pointer");
          return;
        }
        recordingRef.current = true;
        notifyUi("drawing", []);
        syncDrawing(false);
        livePointsRef.current = [start];
        ballAccumRef.current = { ...start };
        strokeModeRef.current = "ball";
        queueMicrotask(() => {
          dispatch({ type: "start_ball", point: start });
        });
        gcLog("ball:start", { start });
        startStrokeSession();
        paintLive();
        return;
      }
      commitStrokeRef.current("ball:phase-end");
    });
    return () => {
      unsubPhase();
    };
  }, [appendLivePoint, notifyUi, paintLive, startStrokeSession, syncDrawing]);

  useEffect(
    () => () => {
      gcLog("cleanup:unmount");
      recordingRef.current = false;
      endStrokeSession();
      if (paintRafRef.current !== 0) {
        cancelAnimationFrame(paintRafRef.current);
      }
      queueMicrotask(() => {
        dispatch({ type: "stop" });
        syncDrawing(false);
      });
    },
    [endStrokeSession, syncDrawing],
  );

  return {
    state: state as CanvasRecorderState,
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseEnter,
    onCanvasMouseLeave,
    onCanvasMouseUp,
    stop,
    clear,
  };
};
