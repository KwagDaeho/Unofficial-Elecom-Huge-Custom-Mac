import {
  SCROLL_BASE_HORIZONTAL_PX,
  SCROLL_BASE_VERTICAL_PX,
} from "@/constants/pointer";
import { scrollSpeedHorizontal, scrollSpeedVertical } from "@/domain/profile";
import { formatSpeedPair } from "@/utils/format";
import { usePrefs } from "@/hooks/prefs";
import { SpeedRangeControl } from "./SpeedRangeControl";
import type { Profile } from "@/types";
interface ScrollSpeedControlsProps {
  pointer: Profile["pointer"];
  onScrollVertical: (value: number) => void;
  onScrollHorizontal: (value: number) => void;
}
export const ScrollSpeedControls = (props: ScrollSpeedControlsProps) => {
  const { i18n } = usePrefs();
  const { pointer } = props;
  return (
    <>
      <SpeedRangeControl
        label={i18n.scrollSpeedVertical}
        display={formatSpeedPair(
          scrollSpeedVertical(pointer),
          SCROLL_BASE_VERTICAL_PX,
        )}
        min={0.1}
        max={5}
        step={0.05}
        value={scrollSpeedVertical(pointer)}
        onChange={props.onScrollVertical}
      />
      <SpeedRangeControl
        label={i18n.scrollSpeedHorizontal}
        display={formatSpeedPair(
          scrollSpeedHorizontal(pointer),
          SCROLL_BASE_HORIZONTAL_PX,
        )}
        min={0.1}
        max={5}
        step={0.05}
        value={scrollSpeedHorizontal(pointer)}
        onChange={props.onScrollHorizontal}
      />
    </>
  );
};
