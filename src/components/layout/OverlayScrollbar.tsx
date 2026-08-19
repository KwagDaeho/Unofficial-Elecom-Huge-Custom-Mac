import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
type Thumb = {
  top: number;
  height: number;
};
/** Fully hidden this long after the last scroll (unchanged). */
const SCROLLBAR_GONE_MS = 1120;
/** Start opacity fade sooner than before (was 900ms). */
const SCROLLBAR_FADE_START_MS = 480;
const SCROLLBAR_FADE_MS = SCROLLBAR_GONE_MS - SCROLLBAR_FADE_START_MS;
interface OverlayScrollbarProps {
  /** Re-sync when main content changes (e.g. tab switch). */
  contentKey?: string;
}
export const OverlayScrollbar = (props: OverlayScrollbarProps) => {
  const dragRef = useRef<{
    startY: number;
    startScroll: number;
  } | null>(null);
  const syncRef = useRef<() => void>(() => {});
  const hideTimerRef = useRef<number | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [thumb, setThumb] = useState<Thumb>({ top: 0, height: 40 });
  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setRevealed(false);
      hideTimerRef.current = null;
    }, SCROLLBAR_FADE_START_MS);
  };
  const reveal = () => {
    setRevealed(true);
    scheduleHide();
  };
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const sync = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      const hasOverflow = scrollHeight > clientHeight + 1;
      setOverflow(hasOverflow);
      if (!hasOverflow) {
        setRevealed(false);
        clearHideTimer();
        return;
      }
      const ratio = clientHeight / scrollHeight;
      const height = Math.max(36, Math.round(clientHeight * ratio));
      const maxTop = Math.max(0, clientHeight - height);
      const range = scrollHeight - clientHeight;
      const top = range <= 0 ? 0 : Math.round((scrollTop / range) * maxTop);
      setThumb({ top, height });
    };
    syncRef.current = sync;
    const onScroll = () => {
      reveal();
      sync();
    };
    sync();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(root);
    const shell = root.querySelector("main.shell");
    if (shell) ro.observe(shell);
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sync);
      ro.disconnect();
      clearHideTimer();
    };
  }, []);
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.scrollTop = 0;
    }
    setRevealed(false);
    clearHideTimer();
    requestAnimationFrame(() => syncRef.current());
    const retry = window.setTimeout(() => syncRef.current(), 0);
    return () => window.clearTimeout(retry);
  }, [props.contentKey]);
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const root = document.getElementById("root");
      if (!drag || !root) return;
      reveal();
      const range = root.scrollHeight - root.clientHeight;
      const maxTop = Math.max(0, root.clientHeight - thumb.height);
      if (range <= 0 || maxTop <= 0) return;
      const delta = event.clientY - drag.startY;
      const next = drag.startScroll + (delta / maxTop) * range;
      root.scrollTop = Math.min(range, Math.max(0, next));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [thumb.height]);
  if (!overflow) return null;
  const shown = revealed || hovering;
  return createPortal(
    <div
      className={shown ? "overlay-scrollbar on" : "overlay-scrollbar"}
      style={
        {
          "--overlay-scrollbar-fade-out": `${SCROLLBAR_FADE_MS}ms`,
        } as CSSProperties
      }
      aria-hidden
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onPointerDown={(event) => {
        reveal();
        const root = document.getElementById("root");
        if (!root || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const range = root.scrollHeight - root.clientHeight;
        const maxTop = Math.max(0, root.clientHeight - thumb.height);
        if (range <= 0 || maxTop <= 0) return;
        const top = Math.min(maxTop, Math.max(0, y - thumb.height / 2));
        root.scrollTop = (top / maxTop) * range;
      }}
    >
      <div
        className="overlay-scrollbar-thumb"
        style={{ top: thumb.top, height: thumb.height }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          reveal();
          const root = document.getElementById("root");
          if (!root) return;
          dragRef.current = {
            startY: event.clientY,
            startScroll: root.scrollTop,
          };
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            typeof target.setPointerCapture === "function"
          ) {
            target.setPointerCapture(event.pointerId);
          }
        }}
      />
    </div>,
    document.body,
  );
};
