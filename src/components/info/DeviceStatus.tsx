import { Panel, panelStyles } from "@/components/ui/Panel";
import { Muted } from "@/components/ui/Muted";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useSession } from "@/hooks/session";
import { connectedLabel } from "../../utils/format";
import { Toggle } from "../ui/Toggle";
import { cx } from "@/utils/cx";

import * as styles from "./DeviceStatus.css";

export const DeviceStatus = () => {
  const { i18n } = usePrefs();
  const { profile, lifecycle } = useProfileCtx();
  const { connected } = useSession();
  if (profile === null) {
    return null;
  }
  const statusLabel = connectedLabel(connected, i18n);
  const isConnected = connected !== null;
  const loadedProfile = profile;
  const handleRemappingChange = (enabled: boolean) => {
    void lifecycle.persist({ ...loadedProfile, enabled });
  };
  return (
    <>
      <Panel variant="row">
        <div className={panelStyles.statusRow}>
          <span className={cx(styles.dot, isConnected && styles.dotOn)} />
          <strong>{isConnected ? i18n.connected : i18n.waiting}</strong>
          <Muted as="span" className={styles.statusDetail}>
            {statusLabel}
          </Muted>
        </div>
      </Panel>

      <Panel variant="row">
        <Toggle
          variant="inline"
          checked={loadedProfile.enabled}
          onChange={handleRemappingChange}
          description={i18n.remappingDesc}
        >
          {i18n.remappingOn}
        </Toggle>
      </Panel>
    </>
  );
};
