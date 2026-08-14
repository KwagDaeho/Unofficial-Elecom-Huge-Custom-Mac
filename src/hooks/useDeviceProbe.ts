import { useCallback, useEffect, useState } from "react";
import * as tauri from "../services/tauri";
import type { DeviceInfo, LastReport } from "../types";

const REPORT_POLL_MS = 50;
const CONNECTED_POLL_MS = 1000;

function sameReport(a: LastReport | null, b: LastReport | null): boolean {
  return (
    a?.tsMs === b?.tsMs &&
    a?.hex === b?.hex &&
    a?.dx === b?.dx &&
    a?.dy === b?.dy &&
    a?.wheel === b?.wheel &&
    a?.pan === b?.pan &&
    a?.buttons.join() === b?.buttons.join()
  );
}

export function useDeviceProbe() {
  const [connected, setConnected] = useState<DeviceInfo | null>(null);
  const [report, setReport] = useState<LastReport | null>(null);

  const refresh = useCallback(async () => {
    const [conn, last] = await Promise.all([
      tauri.getDeviceInfo(),
      tauri.getLastReport(),
    ]);
    setConnected(conn);
    setReport(last);
  }, []);

  useEffect(() => {
    void refresh();
    const probe = window.setInterval(() => {
      void tauri.getLastReport().then((next) => {
        setReport((prev) => (sameReport(prev, next) ? prev : next));
      });
    }, REPORT_POLL_MS);
    const slow = window.setInterval(() => {
      void tauri.getDeviceInfo().then(setConnected);
    }, CONNECTED_POLL_MS);
    return () => {
      window.clearInterval(probe);
      window.clearInterval(slow);
    };
  }, [refresh]);

  return {
    connected,
    report,
    refresh,
    isConnected: connected != null,
  };
}
