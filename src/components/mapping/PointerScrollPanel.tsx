import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { PointerSpeedControls } from "./PointerSpeedControls";
import { PointerScrollToggles } from "./PointerScrollToggles";
import { ScrollSpeedControls } from "./ScrollSpeedControls";

export function PointerScrollPanel() {
  const { i18n } = usePrefs();
  const { profile, pointer } = useProfileCtx();

  if (profile === null) {
    return null;
  }

  const profilePointer = profile.pointer;

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.pointerScroll}</h2>
      </div>
      <div className="controls">
        <PointerSpeedControls
          pointer={profilePointer}
          onSpeedX={(value) => pointer.update("speedX", value)}
          onSpeedY={(value) => pointer.update("speedY", value)}
        />
        <ScrollSpeedControls
          pointer={profilePointer}
          onScrollVertical={(value) =>
            pointer.update("scrollSpeedVertical", value)
          }
          onScrollHorizontal={(value) =>
            pointer.update("scrollSpeedHorizontal", value)
          }
        />
        <PointerScrollToggles
          pointer={profilePointer}
          onAcceleration={(value) => pointer.update("acceleration", value)}
          onInvertVertical={(value) =>
            pointer.update("invertVerticalScroll", value)
          }
          onInvertHorizontal={(value) =>
            pointer.update("invertHorizontalScroll", value)
          }
        />
      </div>
    </section>
  );
}
