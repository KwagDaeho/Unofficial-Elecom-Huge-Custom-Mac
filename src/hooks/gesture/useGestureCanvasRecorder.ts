import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  CANVAS_RECORDER_HEIGHT,
  CANVAS_RECORDER_WIDTH,
  canvasRecorderInitial,
  canvasRecorderIsRecording,
  canvasRecorderReduce,
  clientToCanvasPoint,
  type CanvasRecorderState,
} from "@/domain/gesture/canvasRecorder";
import {
  ensureGestureCanvasChannel,
  subscribeGestureCanvasDelta,
  subscribeGestureCanvasPhase,
} from "@/domain/gesture/gestureCanvasChannel";
import { setGestureCanvasDrawing } from "@/services/tauri";
import type { GesturePoint } from "@/types";

const canvasCenter = (): GesturePoint => ({
  x: CANVAS_RECORDER_WIDTH / 2,
  y: CANVAS_RECORDER_HEIGHT / 2,
});

export const useGestureCanvasRecorder = (canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
  const [state, dispatch] = useReducer(
    canvasRecorderReduce,
    undefined,
    canvasRecorderInitial,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastClientRef = useRef<{ x: number; y: number } | null>(null);
  const channelReadyRef = useRef(false);

  const recording = canvasRecorderIsRecording(state);

  const stop = useCallback(() => {
    dispatch({ type: "stop" });
    void setGestureCanvasDrawing(false);
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "clear" });
    void setGestureCanvasDrawing(false);
  }, []);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const ballStartPoint = useCallback((): GesturePoint => {
    const canvas = canvasRef.current;
    const last = lastClientRef.current;
    if (canvas && last) {
      const mapped = clientToCanvasPoint(
        last.x,
        last.y,
        canvas.getBoundingClientRect(),
        true,
      );
      if (mapped) {
        return mapped;
      }
    }
    return canvasCenter();
  }, [canvasRef]);

  const ballStartPointRef = useRef(ballStartPoint);
  ballStartPointRef.current = ballStartPoint;

  const appendPointerPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      lastClientRef.current = { x: clientX, y: clientY };
      const point = clientToCanvasPoint(
        clientX,
        clientY,
        canvas.getBoundingClientRect(),
        true,
      );
      if (point) {
        dispatch({ type: "move_pointer", point });
      }
    },
    [canvasRef],
  );

  const onCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0 && event.button !== -1) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      if (stateRef.current.mode === "ball") {
        dispatch({ type: "stop" });
      }

      lastClientRef.current = { x: event.clientX, y: event.clientY };
      const start = clientToCanvasPoint(
        event.clientX,
        event.clientY,
        canvas.getBoundingClientRect(),
        true,
      );
      if (!start) {
        return;
      }

      void setGestureCanvasDrawing(true);
      dispatch({
        type: "start_pointer",
        point: start,
        pointerId: event.pointerId,
      });
    },
    [canvasRef],
  );

  const onCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const current = stateRef.current;
      if (current.mode !== "pointer") {
        return;
      }
      if (event.buttons === 0) {
        stopRef.current();
        return;
      }
      if (current.pointerId !== null && event.pointerId !== current.pointerId) {
        return;
      }
      appendPointerPoint(event.clientX, event.clientY);
    },
    [appendPointerPoint],
  );

  const onCanvasPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0 && event.button !== -1) {
        return;
      }
      if (stateRef.current.mode === "pointer") {
        stopRef.current();
      }
    },
    [],
  );

  useEffect(() => {
    void ensureGestureCanvasChannel().then(() => {
      channelReadyRef.current = true;
    });
  }, []);

  useEffect(() => {
    const trackCursor = (event: PointerEvent) => {
      lastClientRef.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      const current = stateRef.current;
      if (current.mode !== "pointer") {
        return;
      }
      if (event.buttons === 0) {
        stopRef.current();
        return;
      }
      if (current.pointerId !== null && event.pointerId !== current.pointerId) {
        return;
      }
      appendPointerPoint(event.clientX, event.clientY);
    };

    const endPointer = () => {
      if (stateRef.current.mode === "pointer") {
        stopRef.current();
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (stateRef.current.mode !== "pointer") {
        return;
      }
      if (event.button !== 0 && event.button !== -1) {
        return;
      }
      endPointer();
    };

    window.addEventListener("pointermove", trackCursor, { passive: true });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("mouseup", endPointer);
    return () => {
      window.removeEventListener("pointermove", trackCursor);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("mouseup", endPointer);
    };
  }, [appendPointerPoint]);

  useEffect(() => {
    const unsubPhase = subscribeGestureCanvasPhase((phase) => {
      if (phase === "start") {
        const current = stateRef.current;
        if (current.mode === "pointer" || current.mode === "ball") {
          return;
        }
        void setGestureCanvasDrawing(false);
        dispatch({
          type: "start_ball",
          point: ballStartPointRef.current(),
        });
        return;
      }
      stopRef.current();
    });
    const unsubDelta = subscribeGestureCanvasDelta((dx, dy) => {
      if (stateRef.current.mode !== "ball") {
        return;
      }
      dispatch({ type: "ball_delta", dx, dy });
    });
    return () => {
      unsubPhase();
      unsubDelta();
    };
  }, []);

  useEffect(
    () => () => {
      dispatch({ type: "stop" });
      void setGestureCanvasDrawing(false);
    },
    [],
  );

  return {
    state: state as CanvasRecorderState,
    recording,
    points: state.points,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerEnd,
    stop,
    clear,
  };
};
