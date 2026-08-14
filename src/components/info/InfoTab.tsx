import { DeviceStatus } from "./DeviceStatus";
import { LaunchSettings } from "./LaunchSettings";
import { PermissionPanel } from "./PermissionPanel";
import { ProbePanel } from "./ProbePanel";
import { useSession } from "../../context/session";

export function InfoTab() {
  const { trusted } = useSession();

  return (
    <>
      <DeviceStatus />
      {!trusted && <PermissionPanel />}
      <LaunchSettings />
      <ProbePanel />
    </>
  );
}
