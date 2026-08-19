import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Thumb = {
  top: number;
  height: number;
};

const SCROLLBAR_GONE_MS = 1120;
const SCROLLBAR_FADE_START_MS = 480;
const SCROLLBAR_FADE_MS = SCROLLBAR_GONE_MS - SCROLLBAR_FADE_START_MS;

interface OverlayScrollAreaProps {
  children: ReactNode;
  className?: string;
  /** Re-sync when scroll content changes (e.g. list length). */
  contentKey?: string;
  style?: CSSProperties;
}

export const OverlayScrollArea = (props: OverlayScrollAreaProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
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
    const viewport = viewportRef.current;
    if (!viewport) return;

    const sync = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const hasOverflow = scrollHeight > clientHeight + 1;
      setOverflow(hasOverflow);
      if (!hasOverflow) {
        setRevealed(false);
        clearHideTimer();
        return;
      }
      const ratio = clientHeight / scrollHeight;
      const height = Math.max(24, Math.round(clientHeight * ratio));
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
    viewport.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(viewport);
    for (const child of viewport.children) {
      ro.observe(child);
    }

    return () => {
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sync);
      ro.disconnect();
      clearHideTimer();
    };
  }, []);

  useEffect(() => {
    setRevealed(false);
    clearHideTimer();
    requestAnimationFrame(() => syncRef.current());
    const retry = window.setTimeout(() => syncRef.current(), 0);
    return () => window.clearTimeout(retry);
  }, [props.contentKey]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const viewport = viewportRef.current;
      if (!drag || !viewport) return;
      reveal();
      const range = viewport.scrollHeight - viewport.clientHeight;
      const maxTop = Math.max(0, viewport.clientHeight - thumb.height);
      if (range <= 0 || maxTop <= 0) return;
      const delta = event.clientY - drag.startY;
      const next = drag.startScroll + (delta / maxTop) * range;
      viewport.scrollTop = Math.min(range, Math.max(0, next));
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

  const shown = revealed || hovering;

  return (
    <div className="overlay-scroll-area">
      <div
        ref={viewportRef}
        className={["overlay-scroll-area-viewport", props.className]
          .filter(Boolean)
          .join(" ")}
        style={props.style}
      >
        {props.children}
      </div>
      {overflow ? (
        <div
          className={
            shown
              ? "overlay-scrollbar overlay-scrollbar-embedded on"
              : "overlay-scrollbar overlay-scrollbar-embedded"
          }
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
            const viewport = viewportRef.current;
            if (!viewport || event.target !== event.currentTarget) return;
            const trackRect = event.currentTarget.getBoundingClientRect();
            const y = event.clientY - trackRect.top;
            const range = viewport.scrollHeight - viewport.clientHeight;
            const maxTop = Math.max(0, viewport.clientHeight - thumb.height);
            if (range <= 0 || maxTop <= 0) return;
            const top = Math.min(maxTop, Math.max(0, y - thumb.height / 2));
            viewport.scrollTop = (top / maxTop) * range;
          }}
        >
          <div
            className="overlay-scrollbar-thumb"
            style={{ top: thumb.top, height: thumb.height }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              reveal();
              const viewport = viewportRef.current;
              if (!viewport) return;
              dragRef.current = {
                startY: event.clientY,
                startScroll: viewport.scrollTop,
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
        </div>
      ) : null}
    </div>
  );
};
