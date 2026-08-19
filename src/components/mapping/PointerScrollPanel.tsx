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
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { Toggle } from "../ui/Toggle";

export function PointerScrollPanel() {
  const { i18n } = usePrefs();
  const { profile, actions } = useProfileCtx();

  if (!profile) return null;

  const onUpdatePointer = actions.updatePointer;

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.pointerScroll}</h2>
      </div>
      <div className="controls">
        <label>
          {i18n.speedX}{" "}
          {formatSpeedPair(pointerSpeedX(profile.pointer), POINTER_REF_DPI)}
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
          {i18n.speedY}{" "}
          {formatSpeedPair(pointerSpeedY(profile.pointer), POINTER_REF_DPI)}
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
          {formatSpeedPair(
            scrollSpeedVertical(profile.pointer),
            SCROLL_BASE_VERTICAL_PX,
          )}
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.05}
            value={scrollSpeedVertical(profile.pointer)}
            onChange={(e) =>
              onUpdatePointer("scrollSpeedVertical", Number(e.target.value))
            }
          />
        </label>
        <label>
          {i18n.scrollSpeedHorizontal}{" "}
          {formatSpeedPair(
            scrollSpeedHorizontal(profile.pointer),
            SCROLL_BASE_HORIZONTAL_PX,
          )}
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.05}
            value={scrollSpeedHorizontal(profile.pointer)}
            onChange={(e) =>
              onUpdatePointer("scrollSpeedHorizontal", Number(e.target.value))
            }
          />
        </label>
        <Toggle
          checked={profile.pointer.acceleration}
          onChange={(acceleration) => onUpdatePointer("acceleration", acceleration)}>
          {i18n.acceleration}
        </Toggle>
        <Toggle
          checked={profile.pointer.invertVerticalScroll ?? false}
          onChange={(invertVerticalScroll) =>
            onUpdatePointer("invertVerticalScroll", invertVerticalScroll)
          }>
          {i18n.invertVertical}
        </Toggle>
        <Toggle
          checked={profile.pointer.invertHorizontalScroll ?? false}
          onChange={(invertHorizontalScroll) =>
            onUpdatePointer("invertHorizontalScroll", invertHorizontalScroll)
          }>
          {i18n.invertHorizontal}
        </Toggle>
      </div>
    </section>
  );
}
