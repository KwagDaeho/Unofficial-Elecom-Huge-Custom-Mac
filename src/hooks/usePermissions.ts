import { useCallback, useEffect, useRef, useState } from "react";
import { PERMISSION_POLL_MS } from "../constants/polling";
import * as tauri from "../services/tauri";
import type { PermissionStatus } from "../types";

export function usePermissions() {
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  const sawUntrusted = useRef(false);
  const restartScheduled = useRef(false);

  const trusted = perms?.ready ?? false;

  const refresh = useCallback(async () => {
    setPerms(await tauri.getPermissionStatus());
  }, []);

  // Accessibility / Input Monitoring only fully apply after a process restart.
  useEffect(() => {
    if (!perms) return;
    if (!perms.ready) {
      sawUntrusted.current = true;
      return;
    }
    if (sawUntrusted.current && !restartScheduled.current) {
      restartScheduled.current = true;
      void tauri.relaunchApp();
    }
  }, [perms]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void tauri.getPermissionStatus().then(setPerms);
    }, PERMISSION_POLL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [refresh]);

  const grantAccess = useCallback(async () => {
    // Reset stale TCC (common after ad-hoc updates), then prompt.
    await tauri.resetTccPermissions();
    await tauri.requestPermission("accessibility");
    setPerms(await tauri.getPermissionStatus());
  }, []);

  return {
    perms,
    trusted,
    refresh,
    grantAccess,
    openAccessibilitySettings: tauri.openAccessibilitySettings,
    openInputMonitoringSettings: tauri.openInputMonitoringSettings,
  };
}
