type PhaseListener = (phase: "start" | "end") => void;

const phaseListeners = new Set<PhaseListener>();

let ready: Promise<void> | null = null;
let unlistenPhase: (() => void) | null = null;

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

/** Test-only reset */
export const resetGestureCanvasChannelForTests = (): void => {
  unlistenPhase?.();
  unlistenPhase = null;
  ready = null;
  phaseListeners.clear();
};
