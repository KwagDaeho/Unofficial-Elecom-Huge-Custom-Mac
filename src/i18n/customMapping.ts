import { formatComboActivator } from "./activators";
import { comboIsValid } from "@/domain/profile/customMapping";
import type { CustomMappingEntry, Lang } from "@/types";
export const customMappingTriggerLabel = (
  entry: CustomMappingEntry,
  lang: Lang,
  unsetLabel: string,
): string => {
  if (!comboIsValid(entry.activator)) {
    return unsetLabel;
  }
  return formatComboActivator(entry.activator, lang);
};
