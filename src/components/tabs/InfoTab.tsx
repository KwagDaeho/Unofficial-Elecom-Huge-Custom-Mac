import {
  DeviceStatus,
  LaunchSettings,
  PermissionPanel,
  ProbePanel,
} from "@/components/info";
import { useSession } from "@/hooks";
export const InfoTab = () => {
  const { trusted } = useSession();
  return (
    <>
      <DeviceStatus />
      {!trusted && <PermissionPanel />}
      <LaunchSettings />
      <ProbePanel />
    </>
  );
};
