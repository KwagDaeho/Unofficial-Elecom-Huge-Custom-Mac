import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Thumb = { top: number; height: number };

/** Floating scrollbar over #root — does not take layout width. */
export function OverlayScrollbar() {
  const dragRef = useRef<{
    startY: number;
    startScroll: number;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const [thumb, setThumb] = useState<Thumb>({ top: 0, height: 40 });

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    const sync = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      const overflow = scrollHeight > clientHeight + 1;
      setVisible(overflow);
      if (!overflow) return;
      const ratio = clientHeight / scrollHeight;
      const height = Math.max(36, Math.round(clientHeight * ratio));
      const maxTop = Math.max(0, clientHeight - height);
      const range = scrollHeight - clientHeight;
      const top = range <= 0 ? 0 : Math.round((scrollTop / range) * maxTop);
      setThumb({ top, height });
    };

    sync();
    root.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(root);
    const first = root.firstElementChild;
    if (first) ro.observe(first);

    return () => {
      root.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const root = document.getElementById("root");
      if (!drag || !root) return;
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

  if (!visible) return null;

  return createPortal(
    <div
      className="overlay-scrollbar"
      aria-hidden
      onPointerDown={(event) => {
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
          const root = document.getElementById("root");
          if (!root) return;
          dragRef.current = {
            startY: event.clientY,
            startScroll: root.scrollTop,
          };
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        }}
      />
    </div>,
    document.body,
  );
}
