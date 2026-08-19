import { PermissionPanel } from "@/components/info";
import { useSession } from "@/hooks";
import {
  BallScrollPanel,
  ButtonMappingPanel,
  CustomButtonMappingPanel,
  PointerScrollPanel,
} from "@/components/mapping";
export const CustomTab = () => {
  const { trusted } = useSession();
  return (
    <>
      {!trusted && <PermissionPanel />}
      <ButtonMappingPanel />
      <PointerScrollPanel />
      <CustomButtonMappingPanel />
      <BallScrollPanel />
    </>
  );
};
