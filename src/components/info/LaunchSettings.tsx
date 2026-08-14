import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { Toggle } from "../ui/Toggle";

export function LaunchSettings() {
  const { i18n } = usePrefs();
  const { profile, actions } = useProfileCtx();
  const { autostartOn, setAutostartOn } = useSession();

  if (!profile) return null;

  return (
    <section className="panel panel-row panel-row-split">
      <Toggle checked={autostartOn} onChange={(on) => void setAutostartOn(on)}>
        {i18n.launchAtLogin}
      </Toggle>
      <Toggle
        checked={!!profile.startMinimized}
        onChange={(startMinimized) =>
          void actions.persist({ ...profile, startMinimized })
        }>
        {i18n.startMinimized}
      </Toggle>
    </section>
  );
}
