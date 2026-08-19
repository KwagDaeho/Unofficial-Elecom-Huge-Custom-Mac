import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useSession } from "@/hooks/session";
import { connectedLabel } from "../../utils/format";
import { Toggle } from "../ui/Toggle";

export function DeviceStatus() {
  const { i18n } = usePrefs();
  const { profile, lifecycle } = useProfileCtx();
  const { connected } = useSession();

  if (profile === null) {
    return null;
  }

  const statusLabel = connectedLabel(connected, i18n);
  const isConnected = connected !== null;

  const loadedProfile = profile;

  function handleRemappingChange(enabled: boolean) {
    void lifecycle.persist({ ...loadedProfile, enabled });
  }

  return (
    <>
      <section className="panel panel-row">
        <div className="status-row">
          <span className={`dot ${isConnected ? "on" : "off"}`} />
          <strong>{isConnected ? i18n.connected : i18n.waiting}</strong>
          <span className="muted status-detail">{statusLabel}</span>
        </div>
      </section>

      <section className="panel panel-row">
        <Toggle
          variant="inline"
          checked={loadedProfile.enabled}
          onChange={handleRemappingChange}
          description={i18n.remappingDesc}>
          {i18n.remappingOn}
        </Toggle>
      </section>
    </>
  );
}
