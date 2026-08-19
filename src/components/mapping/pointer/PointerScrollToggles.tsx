import {
  invertHorizontalScrollEnabled,
  invertVerticalScrollEnabled,
} from "@/domain/profile";
import { usePrefs } from "@/hooks/prefs";
import { Toggle } from "@/components/ui";
import type { Profile } from "@/types";
interface PointerScrollTogglesProps {
  pointer: Profile["pointer"];
  onAcceleration: (value: boolean) => void;
  onInvertVertical: (value: boolean) => void;
  onInvertHorizontal: (value: boolean) => void;
}
export const PointerScrollToggles = (props: PointerScrollTogglesProps) => {
  const { i18n } = usePrefs();
  const { pointer } = props;
  return (
    <>
      <Toggle checked={pointer.acceleration} onChange={props.onAcceleration}>
        {i18n.acceleration}
      </Toggle>
      <Toggle
        checked={invertVerticalScrollEnabled(pointer)}
        onChange={props.onInvertVertical}
      >
        {i18n.invertVertical}
      </Toggle>
      <Toggle
        checked={invertHorizontalScrollEnabled(pointer)}
        onChange={props.onInvertHorizontal}
      >
        {i18n.invertHorizontal}
      </Toggle>
    </>
  );
};
