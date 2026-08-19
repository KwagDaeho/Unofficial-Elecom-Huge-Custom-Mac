import type { ReactNode } from "react";
import { ActionSelect } from "./ActionSelect";
import { resolveBindingButtonId } from "@/domain/mapping";
import {
  isTiltButton,
  tiltForcesAutoClick,
  bindingAutoClickEnabled,
  bindingLongPressEnabled,
} from "@/domain/profile";
import { usePrefs } from "@/hooks";
import { Toggle } from "@/components/ui";
import type { ButtonBinding, ButtonId, MappingTarget } from "@/types";
interface BindingRowProps {
  target: MappingTarget;
  binding: ButtonBinding;
  label: ReactNode;
  hideLabel?: boolean;
  onFlags: (
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) => void;
  onPick: (slot: "click" | "long_press", value: string) => void;
  buttonId?: ButtonId;
}
export const BindingRow = (props: BindingRowProps) => {
  const { i18n } = usePrefs();
  const resolvedButtonId = resolveBindingButtonId(props.target, props.buttonId);
  const isTilt =
    resolvedButtonId !== undefined && isTiltButton(resolvedButtonId);
  const forceAutoClickOn =
    resolvedButtonId !== undefined &&
    tiltForcesAutoClick(resolvedButtonId, props.binding.click);
  const autoClickOn = isTilt
    ? forceAutoClickOn
    : bindingAutoClickEnabled(props.binding);
  const longPressOn = forceAutoClickOn
    ? false
    : bindingLongPressEnabled(props.binding);
  const hideLabel = props.hideLabel === true;
  return (
    <>
      {!hideLabel ? <span className="btn-name">{props.label}</span> : null}
      <Toggle
        variant="flag"
        title={i18n.longPressEnable}
        checked={longPressOn}
        disabled={autoClickOn || forceAutoClickOn}
        onChange={(longPressEnabled) => props.onFlags({ longPressEnabled })}
      />
      <Toggle
        variant="flag"
        title={i18n.autoClickEnable}
        checked={autoClickOn}
        disabled={isTilt || longPressOn}
        onChange={(autoClick) => props.onFlags({ autoClick })}
      />
      <ActionSelect
        action={props.binding.click}
        onPick={(value) => props.onPick("click", value)}
      />
      <ActionSelect
        action={props.binding.longPress}
        disabled={!longPressOn}
        onPick={(value) => props.onPick("long_press", value)}
      />
    </>
  );
};
