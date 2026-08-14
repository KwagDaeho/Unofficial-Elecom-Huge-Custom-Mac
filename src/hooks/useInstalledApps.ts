import { useCallback, useState } from "react";
import * as tauri from "../services/tauri";
import type { InstalledApp } from "../services/tauri";

export type InstalledAppWithIcon = InstalledApp & { icon?: string };

const ICON_WORKERS = 6;

async function fillIcons(
  apps: InstalledApp[],
  setApps: (updater: (prev: InstalledAppWithIcon[]) => InstalledAppWithIcon[]) => void,
) {
  const queue = apps.map((a) => a.path);
  const workers = Array.from({ length: ICON_WORKERS }, async () => {
    while (queue.length > 0) {
      const path = queue.shift();
      if (!path) break;
      try {
        const icon = await tauri.getAppIcon(path);
        if (!icon) continue;
        setApps((prev) =>
          prev.map((a) => (a.path === path ? { ...a, icon } : a)),
        );
      } catch {
        /* ignore missing icons */
      }
    }
  });
  await Promise.all(workers);
}

/**
 * List installed apps for the OpenApp editor (with background icon fill).
 */
export function useInstalledApps() {
  const [apps, setApps] = useState<InstalledAppWithIcon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listed = await tauri.listInstalledApps();
      setApps(listed);
      setLoading(false);
      void fillIcons(listed, setApps);
    } catch (e) {
      setLoading(false);
      setError(String(e));
    }
  }, []);

  const reset = useCallback(() => {
    setApps([]);
    setLoading(false);
    setError(null);
  }, []);

  return {
    apps,
    loading,
    error,
    load,
    reset,
  };
}
