import { createContext, useContext, useEffect, useState } from "react";
import { useDeviceProbe } from "@/hooks/useDeviceProbe";
import { usePermissions } from "@/hooks/usePermissions";
import { useProfileCtx } from "@/hooks/profile";
import * as tauri from "@/services/tauri";
import type { SessionContextValue } from "@/types";

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}

export function useSessionState(): SessionContextValue {
  const { lifecycle } = useProfileCtx();
  const { connected, report } = useDeviceProbe();
  const { trusted, grantAccess } = usePermissions();
  const [autostartEnabled, setAutostartEnabledState] = useState(false);

  useEffect(() => {
    void tauri.autostartIsEnabled().then(setAutostartEnabledState);
  }, []);

  async function setAutostartEnabled(on: boolean) {
    try {
      setAutostartEnabledState(await tauri.autostartSet(on));
    } catch (error) {
      lifecycle.setBootError(String(error));
    }
  }

  return {
    connected,
    report,
    trusted,
    grantAccess,
    autostart: {
      enabled: autostartEnabled,
      setEnabled: setAutostartEnabled,
    },
  };
}
