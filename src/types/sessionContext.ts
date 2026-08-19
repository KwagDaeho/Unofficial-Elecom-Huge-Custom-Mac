import type { DeviceInfo, LastReport } from "./device";

export type SessionAutostart = {
  enabled: boolean;
  setEnabled: (on: boolean) => Promise<void>;
};

export type SessionContextValue = {
  connected: DeviceInfo | null;
  report: LastReport | null;
  trusted: boolean;
  grantAccess: () => Promise<void>;
  autostart: SessionAutostart;
};
