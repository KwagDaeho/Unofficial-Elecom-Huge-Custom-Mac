import { useEffect, useState } from "react";
import {
  ballScrollOf,
  formatActivator,
} from "../../domain/profile/activator";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import type { Activator, BallScrollSlot } from "../../types";

export function BallScrollPanel() {
  const { lang, i18n } = usePrefs();
  const { profile, actions } = useProfileCtx();
  const { setEditor } = useSession();
  const [latchOn, setLatchOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unlisten = import("@tauri-apps/api/event").then(({ listen }) =>
      listen<{ active: boolean; latch: boolean }>("ball-scroll-active", (ev) => {
        if (!cancelled) setLatchOn(ev.payload.latch);
      }),
    );
    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn());
    };
  }, []);

  if (!profile) return null;

  const ball = ballScrollOf(profile.ballScroll);

  function openCapture(slot: BallScrollSlot) {
    setEditor({ kind: "ball_scroll_activator", slot, rejected: null });
  }

  function onEnable(slot: BallScrollSlot, enabled: boolean) {
    const activator: Activator | null =
      slot === "toggle" ? ball.toggleActivator : ball.holdActivator;
    if (enabled && !activator) {
      openCapture(slot);
      return;
    }
    if (slot === "toggle") {
      actions.updateBallScroll({ toggleEnabled: enabled });
    } else {
      actions.updateBallScroll({ holdEnabled: enabled });
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.ballScroll}</h2>
        {latchOn ? <em className="ball-scroll-badge">{i18n.ballScrollOn}</em> : null}
      </div>
      <div className="controls">
        <div className="ball-scroll-row">
          <span>{i18n.ballScrollToggle}</span>
          <Toggle
            variant="flag"
            checked={ball.toggleEnabled}
            onChange={(on) => onEnable("toggle", on)}
          />
          <div className="ball-scroll-key">
            <Button size="tiny" onClick={() => openCapture("toggle")}>
              {ball.toggleActivator
                ? formatActivator(ball.toggleActivator, lang)
                : i18n.ballScrollKey}
            </Button>
            {ball.toggleActivator ? (
              <Button
                variant="ghost"
                size="tiny"
                onClick={() =>
                  actions.updateBallScroll({
                    toggleActivator: null,
                    toggleEnabled: false,
                  })
                }>
                {i18n.clear}
              </Button>
            ) : null}
          </div>
          <p className="muted ball-scroll-help">{i18n.ballScrollToggleHelp}</p>
        </div>
        <div className="ball-scroll-row">
          <span>{i18n.ballScrollHold}</span>
          <Toggle
            variant="flag"
            checked={ball.holdEnabled}
            onChange={(on) => onEnable("hold", on)}
          />
          <div className="ball-scroll-key">
            <Button size="tiny" onClick={() => openCapture("hold")}>
              {ball.holdActivator
                ? formatActivator(ball.holdActivator, lang)
                : i18n.ballScrollKey}
            </Button>
            {ball.holdActivator ? (
              <Button
                variant="ghost"
                size="tiny"
                onClick={() =>
                  actions.updateBallScroll({
                    holdActivator: null,
                    holdEnabled: false,
                  })
                }>
                {i18n.clear}
              </Button>
            ) : null}
          </div>
          <p className="muted ball-scroll-help">{i18n.ballScrollHoldHelp}</p>
        </div>
        <label>
          {i18n.ballScrollSpeed} {(ball.speed ?? 1).toFixed(2)}×
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.05}
            value={ball.speed ?? 1}
            onChange={(e) =>
              actions.updateBallScroll({ speed: Number(e.target.value) })
            }
          />
        </label>
        <Toggle
          checked={!!ball.invertVertical}
          onChange={(invertVertical) =>
            actions.updateBallScroll({ invertVertical })
          }>
          {i18n.ballScrollInvertVertical}
        </Toggle>
        <Toggle
          checked={!!ball.invertHorizontal}
          onChange={(invertHorizontal) =>
            actions.updateBallScroll({ invertHorizontal })
          }>
          {i18n.ballScrollInvertHorizontal}
        </Toggle>
      </div>
    </section>
  );
}
