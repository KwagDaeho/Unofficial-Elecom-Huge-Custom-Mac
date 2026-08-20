import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  appendCanvasPoint,
  canvasRecorderInitial,
  canvasRecorderReduce,
  clientToCanvasPoint,
  emitGestureCanvasUiChange,
  ensureGestureCanvasChannel,
  paintGestureCanvas,
  subscribeGestureCanvasPhase,
  type CanvasRecorderState,
  type GestureDrawPhase,
} from "@/domain/gesture";
import { clearGestureCanvasStroke, setGestureCanvasDrawing } from "@/services/tauri";
import type { GesturePoint } from "@/types";

export type { GestureDrawPhase } from "@/domain/gesture";

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
      schedulePaint();
    },
    [schedulePaint],
  );

  const startStrokeSession = useCallback(() => {
    endStrokeSession();

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
      }

      const point = clientToCanvasPoint(
        event.clientX,
        event.clientY,
        canvas,
        strokeModeRef.current === "ball",
      );
      if (point) {
        appendLivePoint(point);
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
    (_source: string) => {
      if (!recordingRef.current) {
        return;
      }
      recordingRef.current = false;
      endStrokeSession();
      strokeModeRef.current = "idle";
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
    },
    [endStrokeSession, notifyUi, schedulePaint, syncDrawing],
  );

  commitStrokeRef.current = commitStroke;

  const stop = useCallback(
    (_source = "stop") => {
      recordingRef.current = false;
      strokeLockedRef.current = false;
      endStrokeSession();
      strokeModeRef.current = "idle";
      notifyUi("idle", []);
      queueMicrotask(() => {
        dispatch({ type: "stop" });
        syncDrawing(false);
      });
    },
    [endStrokeSession, notifyUi, syncDrawing],
  );

  const clear = useCallback(() => {
    recordingRef.current = false;
    strokeLockedRef.current = false;
    endStrokeSession();
    strokeModeRef.current = "idle";
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
        return;
      }
      if (recordingRef.current) {
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      if (!isClientInsideCanvas(canvas, clientX, clientY)) {
        return;
      }

      const start = clientToCanvasPoint(clientX, clientY, canvas, false);
      if (!start) {
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
    },
    [trackPointer],
  );

  const onCanvasMouseLeave = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      canvasHoverRef.current = false;
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
    commitStrokeRef.current("canvas:mouseup");
  }, []);

  useEffect(() => {
    void ensureGestureCanvasChannel();
  }, []);

  useEffect(() => {
    const unsubPhase = subscribeGestureCanvasPhase((phase) => {
      if (phase === "start") {
        if (
          recordingRef.current ||
          strokeLockedRef.current ||
          drawPhaseRef.current === "done" ||
          !canvasHoverRef.current
        ) {
          return;
        }
        const start = ballStartPointRef.current();
        if (!start) {
          return;
        }
        recordingRef.current = true;
        notifyUi("drawing", []);
        syncDrawing(false);
        livePointsRef.current = [start];
        strokeModeRef.current = "ball";
        queueMicrotask(() => {
          dispatch({ type: "start_ball", point: start });
        });
        startStrokeSession();
        paintLive();
        return;
      }
      commitStrokeRef.current("ball:phase-end");
    });
    return () => {
      unsubPhase();
    };
  }, [notifyUi, paintLive, startStrokeSession, syncDrawing]);

  useEffect(
    () => () => {
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
