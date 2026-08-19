import type { ChangeEvent } from "react";
import { findCatalogEntry } from "@/domain/actions/compare";
import { catalogValueForAction, actionKey } from "@/domain/profile";
import { describeAction, entryLabel, groupCatalog } from "@/i18n";
import {
  CUSTOM_KEY_SENTINEL,
  MACRO_SENTINEL,
  OPEN_APP_SENTINEL,
} from "@/constants/sentinels";
import { usePrefs } from "@/hooks";
import type { Action } from "@/types";

interface ActionSelectProps {
  action: Action;
  onPick: (value: string) => void;
  disabled?: boolean;
}

export function ActionSelect(props: ActionSelectProps) {
  const { lang } = usePrefs();
  const groups = groupCatalog(lang);
  const matched = findCatalogEntry(props.action);
  const value = catalogValueForAction(props.action);
  const disabled = props.disabled === true;

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    if (disabled) {
      return;
    }
    props.onPick(event.target.value);
  }

  return (
    <select value={value} disabled={disabled} onChange={handleChange}>
      {matched === undefined ? (
        <option value={actionKey(props.action)}>
          {describeAction(props.action, lang)}
        </option>
      ) : null}
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.entries.map((entry) => {
            if (entry.special === "custom_key") {
              return (
                <option key={entry.id} value={CUSTOM_KEY_SENTINEL}>
                  {entryLabel("custom_key", lang)}
                </option>
              );
            }
            if (entry.special === "macro") {
              return (
                <option key={entry.id} value={MACRO_SENTINEL}>
                  {entryLabel("macro", lang)}
                </option>
              );
            }
            if (entry.special === "open_app") {
              return (
                <option key={entry.id} value={OPEN_APP_SENTINEL}>
                  {entryLabel("open_app_pick", lang)}
                </option>
              );
            }
            return (
              <option key={entry.id} value={actionKey(entry.action)}>
                {entryLabel(entry.id, lang)}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}
