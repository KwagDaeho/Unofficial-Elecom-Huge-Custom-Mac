import { gestureMappingsOf, newGestureMappingEntry } from "@/domain/profile";
import { usePrefs, useProfileCtx } from "@/hooks";
import { Button } from "@/components/ui";
import { GestureMappingRow } from "./GestureMappingRow";

export const GestureMappingPanel = () => {
  const { i18n } = usePrefs();
  const { profile, gestureMappings } = useProfileCtx();
  if (profile === null) {
    return null;
  }
  const entries = gestureMappingsOf(profile);
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.gestureMapping}</h2>
        <Button
          size="tiny"
          onClick={() => void gestureMappings.add(newGestureMappingEntry())}
        >
          {i18n.gestureMappingAdd}
        </Button>
      </div>
      <p className="muted custom-mapping-help">{i18n.gestureMappingHelp}</p>
      {entries.length === 0 ? (
        <p className="muted">{i18n.gestureMappingEmpty}</p>
      ) : (
        <div className="button-grid custom-mapping-grid gesture-mapping-grid">
          <div className="button-head">
            <span>{i18n.gestureHoldKey}</span>
            <span>{i18n.gestureShape}</span>
            <span>{i18n.gestureAction}</span>
            <span>{i18n.gestureRowActions}</span>
          </div>
          {entries.map((entry) => (
            <GestureMappingRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
};
