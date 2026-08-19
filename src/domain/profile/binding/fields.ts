import type { ButtonBinding } from "@/types";
export const bindingLongPressEnabled = (binding: ButtonBinding): boolean => {
  return binding.longPressEnabled === true;
};
export const bindingAutoClickEnabled = (binding: ButtonBinding): boolean => {
  return binding.autoClick === true;
};
export const resolveBindingFlags = (
  current: ButtonBinding,
  patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
): Pick<ButtonBinding, "longPressEnabled" | "autoClick"> => {
  let longPressEnabled = bindingLongPressEnabled(current);
  let autoClick = bindingAutoClickEnabled(current);
  if (patch.longPressEnabled !== undefined) {
    longPressEnabled = patch.longPressEnabled;
  }
  if (patch.autoClick !== undefined) {
    autoClick = patch.autoClick;
  }
  if (longPressEnabled) {
    autoClick = false;
  }
  if (autoClick) {
    longPressEnabled = false;
  }
  return { longPressEnabled, autoClick };
};
