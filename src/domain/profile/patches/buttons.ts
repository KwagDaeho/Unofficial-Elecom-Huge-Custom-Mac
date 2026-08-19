import type {
  Action,
  ActionSlot,
  ButtonBinding,
  ButtonId,
  Profile,
} from "@/types";
import { asBinding } from "@/domain/profile";
import { resolveBindingFlags } from "@/domain/profile";
import { isTiltButton } from "@/domain/profile";
export const withButtonSlot = (
  profile: Profile,
  buttonId: ButtonId,
  slot: ActionSlot,
  action: Action,
): Profile => {
  const currentBinding = asBinding(profile.buttons[buttonId]);
  const nextBinding: ButtonBinding =
    slot === "click"
      ? { ...currentBinding, click: action }
      : { ...currentBinding, longPress: action };
  const resolvedBinding =
    slot === "click" && isTiltButton(buttonId)
      ? { ...nextBinding, autoClick: true, longPressEnabled: false }
      : nextBinding;
  return {
    ...profile,
    buttons: { ...profile.buttons, [buttonId]: resolvedBinding },
  };
};
export const withButtonFlags = (
  profile: Profile,
  buttonId: ButtonId,
  patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
): Profile => {
  const currentBinding = asBinding(profile.buttons[buttonId]);
  const flags = resolveBindingFlags(currentBinding, patch);
  return {
    ...profile,
    buttons: {
      ...profile.buttons,
      [buttonId]: { ...currentBinding, ...flags },
    },
  };
};
