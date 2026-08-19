import type { ButtonId, MappingTarget } from "@/types";

export function resolveBindingButtonId(
  target: MappingTarget,
  buttonId: ButtonId | undefined,
): ButtonId | undefined {
  if (buttonId !== undefined) {
    return buttonId;
  }
  if (target.kind === "button") {
    return target.id;
  }
  return undefined;
}
