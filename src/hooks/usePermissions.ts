import { useCallback, useEffect, useRef, useState } from "react";
import { PERMISSION_POLL_MS } from "../constants/polling";
import * as tauri from "../services/tauri";
import type { PermissionStatus } from "../types";
export const usePermissions = () => {
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus | null>(null);
  const sawUntrusted = useRef(false);
  const restartScheduled = useRef(false);
  const trusted = permissionStatus !== null && permissionStatus.ready;
  const refresh = useCallback(async () => {
    setPermissionStatus(await tauri.getPermissionStatus());
  }, []);
  useEffect(() => {
    if (permissionStatus === null) {
      return;
    }
    if (!permissionStatus.ready) {
      sawUntrusted.current = true;
      return;
    }
    if (sawUntrusted.current && !restartScheduled.current) {
      restartScheduled.current = true;
      void tauri.relaunchApp();
    }
  }, [permissionStatus]);
  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => {
      void tauri.getPermissionStatus().then(setPermissionStatus);
    }, PERMISSION_POLL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);
  const grantAccess = useCallback(async () => {
    await tauri.resetTccPermissions();
    await tauri.requestPermission("accessibility");
    setPermissionStatus(await tauri.getPermissionStatus());
  }, []);
  return {
    permissionStatus,
    trusted,
    refresh,
    grantAccess,
    openAccessibilitySettings: tauri.openAccessibilitySettings,
    openInputMonitoringSettings: tauri.openInputMonitoringSettings,
  };
};
