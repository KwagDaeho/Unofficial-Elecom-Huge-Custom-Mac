import { longPressMs, withLongPressMs } from "@/domain/profile";
import { usePrefs, useProfileCtx } from "@/hooks";
import { ButtonMappingCard } from "./ButtonMappingCard";
export const ButtonMappingPanel = () => {
  const { i18n } = usePrefs();
  const { profile, catalog, lifecycle } = useProfileCtx();
  if (profile === null) {
    return null;
  }
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
            onChange={(event) =>
              void lifecycle.persist(
                withLongPressMs(profile, Number(event.target.value)),
              )
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
        {catalog.map((buttonMeta) => (
          <ButtonMappingCard
            key={buttonMeta.id}
            buttonMeta={buttonMeta}
            profile={profile}
          />
        ))}
      </div>
    </section>
  );
};
