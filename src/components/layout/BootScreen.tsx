import { Muted } from "@/components/ui/Muted";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";

import { shell } from "./AppShell.css";
import * as probeStyles from "../info/ProbePanel.css";

export const BootScreen = () => {
  const { i18n } = usePrefs();
  const { bootError } = useProfileCtx();
  return (
    <main className={shell}>
      <Muted>{bootError ? i18n.failedUi : i18n.loading}</Muted>
      {bootError && <pre className={probeStyles.probe}>{bootError}</pre>}
    </main>
  );
};
