import { useCallback, useEffect, useState } from "react";
import {
  CONNECTED_POLL_MS,
  REPORT_POLL_MS,
} from "../constants/polling";
import * as tauri from "../services/tauri";
import type { DeviceInfo, LastReport } from "../types";

function sameReport(
  prevReport: LastReport | null,
  nextReport: LastReport | null,
): boolean {
  return (
    prevReport?.tsMs === nextReport?.tsMs &&
    prevReport?.hex === nextReport?.hex &&
    prevReport?.dx === nextReport?.dx &&
    prevReport?.dy === nextReport?.dy &&
    prevReport?.wheel === nextReport?.wheel &&
    prevReport?.pan === nextReport?.pan &&
    prevReport?.buttons.join() === nextReport?.buttons.join()
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
      void tauri.getLastReport().then((nextReport) => {
        setReport((prevReport) =>
          sameReport(prevReport, nextReport) ? prevReport : nextReport,
        );
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
