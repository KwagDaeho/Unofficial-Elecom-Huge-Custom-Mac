import type { ReactNode } from "react";
import { ActionSelect } from "./ActionSelect";
import { isTiltButton, tiltForcesAutoClick } from "../../domain/profile/tilt";
import { usePrefs } from "../../context/prefs";
import { Toggle } from "../ui/Toggle";
import type { ButtonBinding, ButtonId, MappingTarget } from "../../types";

type Props = {
  target: MappingTarget;
  binding: ButtonBinding;
  label: ReactNode;
  hideLabel?: boolean;
  onFlags: (
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => void;
  onPick: (slot: "click" | "long_press", value: string) => void;
  buttonId?: ButtonId;
};

export function BindingRow({
  target,
  binding,
  label,
  onFlags,
  onPick,
  buttonId,
  hideLabel,
}: Props) {
  const { i18n } = usePrefs();
  const id = buttonId ?? (target.kind === "button" ? target.id : undefined);
  const tiltBtn = id ? isTiltButton(id) : false;
  const forceAcOn = id ? tiltForcesAutoClick(id, binding.click) : false;
  const autoOn = tiltBtn ? forceAcOn : !!binding.autoClick;
  const lpOn = forceAcOn ? false : !!binding.longPressEnabled;

  return (
    <>
      {!hideLabel ? <span className="btn-name">{label}</span> : null}
      <Toggle
        variant="flag"
        title={i18n.longPressEnable}
        checked={lpOn}
        disabled={autoOn || forceAcOn}
        onChange={(longPressEnabled) => onFlags({ longPressEnabled })}
      />
      <Toggle
        variant="flag"
        title={i18n.autoClickEnable}
        checked={autoOn}
        disabled={tiltBtn || lpOn}
        onChange={(autoClick) => onFlags({ autoClick })}
      />
      <ActionSelect
        action={binding.click}
        onPick={(value) => onPick("click", value)}
      />
      <ActionSelect
        action={binding.longPress}
        disabled={!lpOn}
        onPick={(value) => onPick("long_press", value)}
      />
    </>
  );
}
