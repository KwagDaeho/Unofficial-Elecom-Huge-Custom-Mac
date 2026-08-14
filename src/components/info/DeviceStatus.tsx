import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { connectedLabel } from "../../utils/format";
import { Toggle } from "../ui/Toggle";

export function DeviceStatus() {
  const { i18n } = usePrefs();
  const { profile, actions } = useProfileCtx();
  const { connected } = useSession();

  if (!profile) return null;

  const label = connectedLabel(connected, i18n);

  return (
    <>
      <section className="panel panel-row">
        <div className="status-row">
          <span className={`dot ${connected ? "on" : "off"}`} />
          <strong>{connected ? i18n.connected : i18n.waiting}</strong>
          <span className="muted status-detail">{label}</span>
        </div>
      </section>

      <section className="panel panel-row">
        <Toggle
          variant="inline"
          checked={profile.enabled}
          onChange={(enabled) => void actions.persist({ ...profile, enabled })}
          description={i18n.remappingDesc}>
          {i18n.remappingOn}
        </Toggle>
      </section>
    </>
  );
}
