import { DeviceStatus } from "./DeviceStatus";
import { LaunchSettings } from "./LaunchSettings";
import { PermissionPanel } from "./PermissionPanel";
import { ProbePanel } from "./ProbePanel";
import type { DeviceInfo, LastReport, Profile } from "../../types";
import type { Dict, Lang } from "../../i18n";

export function InfoTab({
  connected,
  connectedLabel,
  report,
  lang,
  i18n,
  profile,
  trusted,
  autostartOn,
  onEnabledChange,
  onGrant,
  onAutostartChange,
  onStartMinimizedChange,
}: {
  connected: DeviceInfo | null;
  connectedLabel: string;
  report: LastReport | null;
  lang: Lang;
  i18n: Dict;
  profile: Profile;
  trusted: boolean;
  autostartOn: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onGrant: () => void | Promise<void>;
  onAutostartChange: (on: boolean) => void | Promise<void>;
  onStartMinimizedChange: (on: boolean) => void;
}) {
  return (
    <>
      <DeviceStatus
        connected={connected}
        connectedLabel={connectedLabel}
        i18n={i18n}
        enabled={profile.enabled}
        onEnabledChange={onEnabledChange}
      />

      {!trusted && <PermissionPanel i18n={i18n} onGrant={onGrant} />}

      <LaunchSettings
        i18n={i18n}
        autostartOn={autostartOn}
        startMinimized={!!profile.startMinimized}
        onAutostartChange={onAutostartChange}
        onStartMinimizedChange={onStartMinimizedChange}
      />

      <ProbePanel report={report} lang={lang} i18n={i18n} />
    </>
  );
}
