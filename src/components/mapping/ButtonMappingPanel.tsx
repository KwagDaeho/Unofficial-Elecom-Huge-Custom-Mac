import { ActionSelect } from "./ActionSelect";
import { buttonLabel } from "../../i18n";
import { asBinding, longPressMs } from "../../domain/profile/binding";
import { isTiltButton, tiltForcesAutoClick } from "../../domain/profile/tilt";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { Toggle } from "../ui/Toggle";

export function ButtonMappingPanel() {
  const { lang, i18n } = usePrefs();
  const { profile, catalog, actions } = useProfileCtx();
  const { selectCatalogValue } = useSession();

  if (!profile) return null;

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.buttonMapping}</h2>
      </div>
      <div className="controls tight map-tools">
        <label>
          {i18n.longPressTime} ({longPressMs(profile)} ms)
          <input
            type="range"
            min={150}
            max={2000}
            step={50}
            value={longPressMs(profile)}
            onChange={(e) =>
              void actions.persist({
                ...profile,
                longPressMs: Number(e.target.value),
              })
            }
          />
        </label>
      </div>
      <div className="button-grid">
        <div className="button-head">
          <span />
          <span>{i18n.longPressEnable}</span>
          <span>{i18n.autoClickEnable}</span>
          <span>{i18n.clickAction}</span>
          <span>{i18n.longPressAction}</span>
        </div>
        {catalog.map((btn) => {
          const binding = asBinding(profile.buttons[btn.id]);
          const tiltBtn = isTiltButton(btn.id);
          const forceAcOn = tiltForcesAutoClick(btn.id, binding.click);
          // Tilt: AC locked ON for L-R scroll / default, locked OFF otherwise.
          const autoOn = tiltBtn ? forceAcOn : !!binding.autoClick;
          const lpOn = forceAcOn ? false : !!binding.longPressEnabled;
          return (
            <div key={btn.id} className="button-card">
              <span className="btn-name" title={buttonLabel(btn.id, lang)}>
                {buttonLabel(btn.id, lang)}
                {btn.hiddenFromMacos && <em>{i18n.rawHid}</em>}
              </span>
              <Toggle
                variant="flag"
                title={i18n.longPressEnable}
                checked={lpOn}
                disabled={autoOn || forceAcOn}
                onChange={(longPressEnabled) =>
                  actions.updateButtonFlags(btn.id, { longPressEnabled })
                }
              />
              <Toggle
                variant="flag"
                title={i18n.autoClickEnable}
                checked={autoOn}
                disabled={tiltBtn || lpOn}
                onChange={(autoClick) =>
                  actions.updateButtonFlags(btn.id, { autoClick })
                }
              />
              <ActionSelect
                action={binding.click}
                onPick={(value) => selectCatalogValue(btn.id, "click", value)}
              />
              <ActionSelect
                action={binding.longPress}
                disabled={!lpOn}
                onPick={(value) =>
                  selectCatalogValue(btn.id, "long_press", value)
                }
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
