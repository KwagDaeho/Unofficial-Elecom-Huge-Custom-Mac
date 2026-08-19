import { POINTER_REF_DPI } from "@/constants/pointer";
import { pointerSpeedX, pointerSpeedY } from "@/domain/profile";
import { formatSpeedPair } from "@/utils/format";
import { usePrefs } from "@/hooks/prefs";
import { SpeedRangeControl } from "./SpeedRangeControl";
import type { Profile } from "@/types";
interface PointerSpeedControlsProps {
  pointer: Profile["pointer"];
  onSpeedX: (value: number) => void;
  onSpeedY: (value: number) => void;
}
export const PointerSpeedControls = (props: PointerSpeedControlsProps) => {
  const { i18n } = usePrefs();
  const { pointer } = props;
  return (
    <>
      <SpeedRangeControl
        label={i18n.speedX}
        display={formatSpeedPair(pointerSpeedX(pointer), POINTER_REF_DPI)}
        min={1}
        max={5}
        step={0.05}
        value={pointerSpeedX(pointer)}
        onChange={props.onSpeedX}
      />
      <SpeedRangeControl
        label={i18n.speedY}
        display={formatSpeedPair(pointerSpeedY(pointer), POINTER_REF_DPI)}
        min={1}
        max={5}
        step={0.05}
        value={pointerSpeedY(pointer)}
        onChange={props.onSpeedY}
      />
    </>
  );
};
