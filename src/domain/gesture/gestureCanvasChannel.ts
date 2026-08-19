type PhaseListener = (phase: "start" | "end") => void;
type DeltaListener = (dx: number, dy: number) => void;

const phaseListeners = new Set<PhaseListener>();
const deltaListeners = new Set<DeltaListener>();

let ready: Promise<void> | null = null;
let unlistenPhase: (() => void) | null = null;
let unlistenDelta: (() => void) | null = null;

export const ensureGestureCanvasChannel = (): Promise<void> => {
  if (ready !== null) {
    return ready;
  }
  ready = import("@tauri-apps/api/event").then(async ({ listen }) => {
    unlistenPhase = await listen<{ phase: string }>(
      "gesture-canvas-phase",
      (event) => {
        const phase = event.payload.phase;
        if (phase !== "start" && phase !== "end") {
          return;
        }
        for (const listener of phaseListeners) {
          listener(phase);
        }
      },
    );
    unlistenDelta = await listen<{ dx: number; dy: number }>(
      "gesture-canvas-delta",
      (event) => {
        const { dx, dy } = event.payload;
        if (dx === 0 && dy === 0) {
          return;
        }
        for (const listener of deltaListeners) {
          listener(dx, dy);
        }
      },
    );
  });
  return ready;
};

export const subscribeGestureCanvasPhase = (
  listener: PhaseListener,
): (() => void) => {
  phaseListeners.add(listener);
  void ensureGestureCanvasChannel();
  return () => {
    phaseListeners.delete(listener);
  };
};

export const subscribeGestureCanvasDelta = (
  listener: DeltaListener,
): (() => void) => {
  deltaListeners.add(listener);
  void ensureGestureCanvasChannel();
  return () => {
    deltaListeners.delete(listener);
  };
};

/** Test-only reset */
export const resetGestureCanvasChannelForTests = (): void => {
  unlistenPhase?.();
  unlistenDelta?.();
  unlistenPhase = null;
  unlistenDelta = null;
  ready = null;
  phaseListeners.clear();
  deltaListeners.clear();
};
