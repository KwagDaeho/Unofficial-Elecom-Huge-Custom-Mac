import { customMappingsOf, newCustomMappingEntry } from "@/domain/profile";
import { usePrefs, useProfileCtx } from "@/hooks";
import { Button } from "@/components/ui";
import { CustomMappingRow } from "./CustomMappingRow";

export function CustomButtonMappingPanel() {
  const { i18n } = usePrefs();
  const { profile, customMappings } = useProfileCtx();

  if (profile === null) {
    return null;
  }

  const entries = customMappingsOf(profile);

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.customButtonMapping}</h2>
        <Button
          size="tiny"
          onClick={() => void customMappings.add(newCustomMappingEntry())}>
          {i18n.customMappingAdd}
        </Button>
      </div>
      <p className="muted custom-mapping-help">{i18n.customMappingHelp}</p>
      {entries.length === 0 ? (
        <p className="muted">{i18n.customMappingEmpty}</p>
      ) : (
        <div className="button-grid custom-mapping-grid">
          <div className="button-head">
            <span>{i18n.customMappingTrigger}</span>
            <span>{i18n.longPressEnable}</span>
            <span>{i18n.autoClickEnable}</span>
            <span>{i18n.clickAction}</span>
            <span>{i18n.longPressAction}</span>
            <span />
          </div>
          {entries.map((entry) => (
            <CustomMappingRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}
