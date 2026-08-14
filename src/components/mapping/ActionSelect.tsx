import {
  ACTION_CATALOG,
  ENTRY_LABELS,
  describeAction,
  findCatalogEntry,
} from "../../domain/actions";
import {
  CUSTOM_KEY_SENTINEL,
  MACRO_SENTINEL,
  OPEN_APP_SENTINEL,
} from "../../constants/sentinels";
import { actionKey } from "../../domain/profile/actionKey";
import type { Action, ActionCategoryId } from "../../types";
import type { Lang } from "../../i18n";

export function selectValueForAction(action: Action): string {
  const entry = findCatalogEntry(action);
  if (entry) return actionKey(entry.action);
  return actionKey(action);
}

export function ActionSelect({
  action,
  lang,
  groups,
  onPick,
  disabled = false,
}: {
  action: Action;
  lang: Lang;
  groups: {
    id: ActionCategoryId;
    label: string;
    entries: typeof ACTION_CATALOG;
  }[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const matched = findCatalogEntry(action);
  const value = selectValueForAction(action);
  return (
    <select value={value} disabled={disabled} onChange={(e) => onPick(e.target.value)}>
      {!matched && <option value={actionKey(action)}>{describeAction(action, lang)}</option>}
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.entries.map((entry) => {
            if (entry.special === "custom_key") {
              return (
                <option key={entry.id} value={CUSTOM_KEY_SENTINEL}>
                  {ENTRY_LABELS[lang].custom_key}
                </option>
              );
            }
            if (entry.special === "macro") {
              return (
                <option key={entry.id} value={MACRO_SENTINEL}>
                  {ENTRY_LABELS[lang].macro}
                </option>
              );
            }
            if (entry.special === "open_app") {
              return (
                <option key={entry.id} value={OPEN_APP_SENTINEL}>
                  {ENTRY_LABELS[lang].open_app_pick}
                </option>
              );
            }
            return (
              <option key={entry.id} value={actionKey(entry.action)}>
                {ENTRY_LABELS[lang][entry.id] ?? entry.id}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}
