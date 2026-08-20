import { Panel } from "@/components/ui/Panel";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useSession } from "@/hooks/session";
import { Toggle } from "../ui/Toggle";

export const LaunchSettings = () => {
  const { i18n } = usePrefs();
  const { profile, lifecycle } = useProfileCtx();
  const { autostart } = useSession();
  if (profile === null) {
    return null;
  }
  const loadedProfile = profile;
  const handleStartMinimizedChange = (startMinimized: boolean) => {
    void lifecycle.persist({ ...loadedProfile, startMinimized });
  };
  const handleAutostartChange = (enabled: boolean) => {
    void autostart.setEnabled(enabled);
  };
  return (
    <Panel variant="rowSplit">
      <Toggle checked={autostart.enabled} onChange={handleAutostartChange}>
        {i18n.launchAtLogin}
      </Toggle>
      <Toggle
        checked={loadedProfile.startMinimized === true}
        onChange={handleStartMinimizedChange}
      >
        {i18n.startMinimized}
      </Toggle>
    </Panel>
  );
};
