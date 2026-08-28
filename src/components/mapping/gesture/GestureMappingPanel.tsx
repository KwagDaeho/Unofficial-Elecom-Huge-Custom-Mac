import { gestureMappingsOf, newGestureMappingEntry } from "@/domain/profile";
import { usePrefs, useProfileCtx, useEditor } from "@/hooks";
import { Button, Muted, Panel } from "@/components/ui";
import { GestureMappingRow } from "./GestureMappingRow";
import * as styles from "./GestureMappingPanel.css";

export const GestureMappingPanel = () => {
  const { i18n } = usePrefs();
  const { profile, gestureMappings } = useProfileCtx();
  const { setEditor } = useEditor();
  if (profile === null) {
    return null;
  }
  const entries = gestureMappingsOf(profile);
  return (
    <Panel>
      <div className={styles.sectionHeadRow}>
        <h2>{i18n.gestureMapping}</h2>
        <Button
          size="tiny"
          onClick={() => {
            const entry = newGestureMappingEntry();
            void gestureMappings.add(entry);
            setEditor({ kind: "gesture_path_recorder", entryId: entry.id });
          }}
        >
          {i18n.gestureMappingAdd}
        </Button>
      </div>
      <Muted variant="help">{i18n.gestureMappingHelp}</Muted>
      {entries.length === 0 ? (
        <Muted>{i18n.gestureMappingEmpty}</Muted>
      ) : (
        <div className={styles.gestureMappingGrid}>
          <div className={styles.gestureMappingHead}>
            <span>{i18n.gestureHoldKey}</span>
            <span className={styles.colGap} aria-hidden="true" />
            <span>{i18n.gestureShape}</span>
            <span className={styles.colGap} aria-hidden="true" />
            <span>{i18n.gestureAction}</span>
            <span className={styles.colGap} aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          {entries.map((entry) => (
            <GestureMappingRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </Panel>
  );
};
