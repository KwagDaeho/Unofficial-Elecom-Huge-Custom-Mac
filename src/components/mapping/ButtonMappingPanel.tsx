import { BindingRow } from "./BindingRow";
import { buttonLabel } from "../../i18n";
import { asBinding, longPressMs } from "../../domain/profile/binding";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";

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
          return (
            <div key={btn.id} className="button-card">
              <BindingRow
                target={{ kind: "button", id: btn.id }}
                binding={binding}
                buttonId={btn.id}
                label={
                  <>
                    {buttonLabel(btn.id, lang)}
                    {btn.hiddenFromMacos && <em>{i18n.rawHid}</em>}
                  </>
                }
                onFlags={(patch) => actions.updateButtonFlags(btn.id, patch)}
                onPick={(slot, value) =>
                  selectCatalogValue(btn.id, slot, value)
                }
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
