import { customMappingsOf, newCustomMappingEntry } from "@/domain/profile";
import { usePrefs, useProfileCtx } from "@/hooks";
import { Button, Muted, Panel } from "@/components/ui";
import { CustomMappingRow } from "./CustomMappingRow";
import { buttonGrid } from "../button/ButtonMappingPanel.css";
import * as styles from "./CustomButtonMappingPanel.css";

export const CustomButtonMappingPanel = () => {
  const { i18n } = usePrefs();
  const { profile, customMappings } = useProfileCtx();
  if (profile === null) {
    return null;
  }
  const entries = customMappingsOf(profile);
  return (
    <Panel>
      <div className={styles.sectionHeadRow}>
        <h2>{i18n.customButtonMapping}</h2>
        <Button
          size="tiny"
          onClick={() => void customMappings.add(newCustomMappingEntry())}
        >
          {i18n.customMappingAdd}
        </Button>
      </div>
      <Muted variant="help">{i18n.customMappingHelp}</Muted>
      {entries.length === 0 ? (
        <Muted>{i18n.customMappingEmpty}</Muted>
      ) : (
        <div className={buttonGrid}>
          <div className={styles.customMappingHead}>
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
    </Panel>
  );
};
