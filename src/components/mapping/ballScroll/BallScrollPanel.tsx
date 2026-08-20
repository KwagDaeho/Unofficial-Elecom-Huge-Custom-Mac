import { useEffect, useState } from "react";
import { ballScrollOf, ballScrollActivatorForSlot } from "@/domain/profile";
import { usePrefs, useProfileCtx, useEditor } from "@/hooks";
import { Controls, Panel, SectionHead, Toggle } from "@/components/ui";
import { BallScrollActivatorRow } from "./BallScrollActivatorRow";
import type { BallScrollSlot } from "@/types";

export const BallScrollPanel = () => {
  const { lang, i18n } = usePrefs();
  const { profile, ballScroll } = useProfileCtx();
  const { setEditor } = useEditor();
  const [latchOn, setLatchOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const unlisten = import("@tauri-apps/api/event").then(({ listen }) =>
      listen<{
        active: boolean;
        latch: boolean;
      }>("ball-scroll-active", (event) => {
        if (!cancelled) {
          setLatchOn(event.payload.latch);
        }
      }),
    );
    return () => {
      cancelled = true;
      void unlisten.then((unsubscribe) => unsubscribe());
    };
  }, []);
  if (profile === null) {
    return null;
  }
  const ball = ballScrollOf(profile.ballScroll);
  const handleEnableChange = (slot: BallScrollSlot, enabled: boolean) => {
    const activator = ballScrollActivatorForSlot(ball, slot);
    if (enabled && activator === null) {
      setEditor({ kind: "ball_scroll_activator", slot, rejected: null });
      return;
    }
    if (slot === "toggle") {
      ballScroll.update({ toggleEnabled: enabled });
      return;
    }
    ballScroll.update({ holdEnabled: enabled });
  };
  const handleClear = (slot: BallScrollSlot) => {
    if (slot === "toggle") {
      ballScroll.update({ toggleActivator: null, toggleEnabled: false });
      return;
    }
    ballScroll.update({ holdActivator: null, holdEnabled: false });
  };
  return (
    <Panel>
      <SectionHead
        title={i18n.ballScroll}
        badge={latchOn ? i18n.ballScrollOn : undefined}
      />
      <Controls>
        <BallScrollActivatorRow
          slot="toggle"
          ball={ball}
          lang={lang}
          i18n={i18n}
          onOpenCapture={(slot) =>
            setEditor({ kind: "ball_scroll_activator", slot, rejected: null })
          }
          onEnableChange={handleEnableChange}
          onClear={handleClear}
        />
        <BallScrollActivatorRow
          slot="hold"
          ball={ball}
          lang={lang}
          i18n={i18n}
          onOpenCapture={(slot) =>
            setEditor({ kind: "ball_scroll_activator", slot, rejected: null })
          }
          onEnableChange={handleEnableChange}
          onClear={handleClear}
        />
        <label>
          {i18n.ballScrollSpeed} {ball.speed.toFixed(2)}×
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.05}
            value={ball.speed}
            onChange={(event) =>
              ballScroll.update({ speed: Number(event.target.value) })
            }
          />
        </label>
        <Toggle
          checked={ball.invertVertical}
          onChange={(invertVertical) => ballScroll.update({ invertVertical })}
        >
          {i18n.ballScrollInvertVertical}
        </Toggle>
        <Toggle
          checked={ball.invertHorizontal}
          onChange={(invertHorizontal) =>
            ballScroll.update({ invertHorizontal })
          }
        >
          {i18n.ballScrollInvertHorizontal}
        </Toggle>
      </Controls>
    </Panel>
  );
};
