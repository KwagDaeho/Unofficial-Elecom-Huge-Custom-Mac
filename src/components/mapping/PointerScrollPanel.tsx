import {
  POINTER_REF_DPI,
  SCROLL_BASE_HORIZONTAL_PX,
  SCROLL_BASE_VERTICAL_PX,
} from "../../constants/pointer";
import {
  pointerSpeedX,
  pointerSpeedY,
  scrollSpeedHorizontal,
  scrollSpeedVertical,
} from "../../domain/profile/pointerSpeeds";
import { formatSpeedPair } from "../../utils/format";
import type { Profile } from "../../types";
import type { Dict } from "../../i18n";

export function PointerScrollPanel({
  profile,
  i18n,
  onUpdatePointer,
}: {
  profile: Profile;
  i18n: Dict;
  onUpdatePointer: <K extends keyof Profile["pointer"]>(
    key: K,
    value: Profile["pointer"][K],
  ) => void;
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.pointerScroll}</h2>
      </div>
      <div className="controls">
        <label>
          {i18n.speedX} {formatSpeedPair(pointerSpeedX(profile.pointer), POINTER_REF_DPI)}
          <input
            type="range"
            min={1}
            max={5}
            step={0.05}
            value={pointerSpeedX(profile.pointer)}
            onChange={(e) => onUpdatePointer("speedX", Number(e.target.value))}
          />
        </label>
        <label>
          {i18n.speedY} {formatSpeedPair(pointerSpeedY(profile.pointer), POINTER_REF_DPI)}
          <input
            type="range"
            min={1}
            max={5}
            step={0.05}
            value={pointerSpeedY(profile.pointer)}
            onChange={(e) => onUpdatePointer("speedY", Number(e.target.value))}
          />
        </label>
        <label>
          {i18n.scrollSpeedVertical}{" "}
          {formatSpeedPair(scrollSpeedVertical(profile.pointer), SCROLL_BASE_VERTICAL_PX)}
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.05}
            value={scrollSpeedVertical(profile.pointer)}
            onChange={(e) => onUpdatePointer("scrollSpeedVertical", Number(e.target.value))}
          />
        </label>
        <label>
          {i18n.scrollSpeedHorizontal}{" "}
          {formatSpeedPair(scrollSpeedHorizontal(profile.pointer), SCROLL_BASE_HORIZONTAL_PX)}
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.05}
            value={scrollSpeedHorizontal(profile.pointer)}
            onChange={(e) => onUpdatePointer("scrollSpeedHorizontal", Number(e.target.value))}
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={profile.pointer.acceleration}
            onChange={(e) => onUpdatePointer("acceleration", e.target.checked)}
          />
          {i18n.acceleration}
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={profile.pointer.invertVerticalScroll ?? false}
            onChange={(e) => onUpdatePointer("invertVerticalScroll", e.target.checked)}
          />
          {i18n.invertVertical}
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={profile.pointer.invertHorizontalScroll ?? false}
            onChange={(e) => onUpdatePointer("invertHorizontalScroll", e.target.checked)}
          />
          {i18n.invertHorizontal}
        </label>
      </div>
    </section>
  );
}
