import type { DeviceInfo } from "../../types";
import type { Dict } from "../../i18n";

export function DeviceStatus({
  connected,
  connectedLabel,
  i18n,
  enabled,
  onEnabledChange,
}: {
  connected: DeviceInfo | null;
  connectedLabel: string;
  i18n: Dict;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <>
      <section className="panel panel-row">
        <div className="status-row">
          <span className={`dot ${connected ? "on" : "off"}`} />
          <strong>{connected ? i18n.connected : i18n.waiting}</strong>
          <span className="muted status-detail">{connectedLabel}</span>
        </div>
      </section>

      <section className="panel panel-row">
        <label className="toggle toggle-inline">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          <span className="toggle-title">{i18n.remappingOn}</span>
          <span className="toggle-desc">{i18n.remappingDesc}</span>
        </label>
      </section>
    </>
  );
}
