import { ActionSelect } from "./ActionSelect";
import { ACTION_CATALOG, buttonLabel } from "../../domain/actions";
import { asBinding, longPressMs } from "../../domain/profile/binding";
import { isTiltButton, tiltForcesAutoClick } from "../../domain/profile/tilt";
import type {
  ActionCategoryId,
  ActionSlot,
  ButtonBinding,
  ButtonId,
  ButtonMeta,
  Profile,
} from "../../types";
import type { Dict, Lang } from "../../i18n";

type ActionGroup = {
  id: ActionCategoryId;
  label: string;
  entries: typeof ACTION_CATALOG;
};

export function ButtonMappingPanel({
  catalog,
  profile,
  lang,
  i18n,
  groupedCatalog,
  onPersist,
  onActionSelect,
  onUpdateFlags,
}: {
  catalog: ButtonMeta[];
  profile: Profile;
  lang: Lang;
  i18n: Dict;
  groupedCatalog: ActionGroup[];
  onPersist: (next: Profile) => void;
  onActionSelect: (buttonId: ButtonId, slot: ActionSlot, value: string) => void;
  onUpdateFlags: (
    id: ButtonId,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => void;
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.buttons}</h2>
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
              onPersist({
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
              <label className="toggle flag-toggle" title={i18n.longPressEnable}>
                <input
                  type="checkbox"
                  checked={lpOn}
                  disabled={autoOn || forceAcOn}
                  onChange={(e) =>
                    onUpdateFlags(btn.id, {
                      longPressEnabled: e.target.checked,
                    })
                  }
                />
              </label>
              <label className="toggle flag-toggle" title={i18n.autoClickEnable}>
                <input
                  type="checkbox"
                  checked={autoOn}
                  disabled={tiltBtn || lpOn}
                  onChange={(e) =>
                    onUpdateFlags(btn.id, {
                      autoClick: e.target.checked,
                    })
                  }
                />
              </label>
              <ActionSelect
                action={binding.click}
                lang={lang}
                groups={groupedCatalog}
                onPick={(value) => onActionSelect(btn.id, "click", value)}
              />
              <ActionSelect
                action={binding.longPress}
                lang={lang}
                groups={groupedCatalog}
                disabled={!lpOn}
                onPick={(value) => onActionSelect(btn.id, "long_press", value)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
