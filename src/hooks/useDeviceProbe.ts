import { useCallback, useEffect, useState } from "react";
import {
  CONNECTED_POLL_MS,
  REPORT_POLL_MS,
} from "../constants/polling";
import * as tauri from "../services/tauri";
import type { DeviceInfo, LastReport } from "../types";

function sameReport(
  previousReport: LastReport | null,
  nextReport: LastReport | null,
): boolean {
  if (previousReport === null || nextReport === null) {
    return previousReport === nextReport;
  }
  return (
    previousReport.tsMs === nextReport.tsMs &&
    previousReport.hex === nextReport.hex &&
    previousReport.dx === nextReport.dx &&
    previousReport.dy === nextReport.dy &&
    previousReport.wheel === nextReport.wheel &&
    previousReport.pan === nextReport.pan &&
    previousReport.buttons.join() === nextReport.buttons.join()
  );
}

export function useDeviceProbe() {
  const [connected, setConnected] = useState<DeviceInfo | null>(null);
  const [report, setReport] = useState<LastReport | null>(null);

  const refresh = useCallback(async () => {
    const [deviceInfo, lastReport] = await Promise.all([
      tauri.getDeviceInfo(),
      tauri.getLastReport(),
    ]);
    setConnected(deviceInfo);
    setReport(lastReport);
  }, []);

  useEffect(() => {
    void refresh();
    const reportIntervalId = window.setInterval(() => {
      void tauri.getLastReport().then((nextReport) => {
        setReport((previousReport) =>
          sameReport(previousReport, nextReport) ? previousReport : nextReport,
        );
      });
    }, REPORT_POLL_MS);
    const connectedIntervalId = window.setInterval(() => {
      void tauri.getDeviceInfo().then(setConnected);
    }, CONNECTED_POLL_MS);
    return () => {
      window.clearInterval(reportIntervalId);
      window.clearInterval(connectedIntervalId);
    };
  }, [refresh]);

  return {
    connected,
    report,
    refresh,
    isConnected: connected !== null,
  };
}
