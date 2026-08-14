import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";

export function BootScreen() {
  const { i18n } = usePrefs();
  const { bootError } = useProfileCtx();
  return (
    <main className="shell">
      <p className="muted">{bootError ? i18n.failedUi : i18n.loading}</p>
      {bootError && <pre className="probe">{bootError}</pre>}
    </main>
  );
}
