import { BindingRow } from "./BindingRow";
import { asBinding } from "../../domain/profile/binding";
import {
  comboIsValid,
  customMappingsOf,
  newCustomMappingEntry,
} from "../../domain/profile/customMapping";
import { formatComboActivator } from "../../domain/profile/activator";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import { useSession } from "../../context/session";
import { Button } from "../ui/Button";

export function CustomButtonMappingPanel() {
  const { lang, i18n } = usePrefs();
  const { profile, actions } = useProfileCtx();
  const { selectCustomCatalogValue, setEditor } = useSession();

  if (!profile) return null;

  const entries = customMappingsOf(profile);

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.customButtonMapping}</h2>
        <Button
          size="tiny"
          onClick={() => void actions.addCustomMapping(newCustomMappingEntry())}>
          {i18n.customMappingAdd}
        </Button>
      </div>
      <p className="muted custom-mapping-help">{i18n.customMappingHelp}</p>
      {entries.length === 0 ? (
        <p className="muted">{i18n.customMappingEmpty}</p>
      ) : (
        <div className="button-grid custom-mapping-grid">
          <div className="button-head">
            <span>{i18n.customMappingTrigger}</span>
            <span>{i18n.longPressEnable}</span>
            <span>{i18n.autoClickEnable}</span>
            <span>{i18n.clickAction}</span>
            <span>{i18n.longPressAction}</span>
            <span />
          </div>
          {entries.map((entry) => {
            const binding = asBinding(entry);
            const valid = comboIsValid(entry.activator);
            const label = valid
              ? formatComboActivator(entry.activator, lang)
              : i18n.customMappingSetTrigger;
            return (
              <div key={entry.id} className="custom-mapping-row">
                <div className="combo-trigger">
                  <Button
                    size="tiny"
                    onClick={() =>
                      setEditor({
                        kind: "custom_combo_activator",
                        entryId: entry.id,
                        phase: "capture",
                        draftChord: [
                          ...entry.activator.modifiers,
                          ...entry.activator.keys,
                        ],
                        draftButton: valid ? entry.activator.button : null,
                        rejected: null,
                      })
                    }>
                    {label}
                  </Button>
                </div>
                <BindingRow
                  target={{ kind: "custom", id: entry.id }}
                  binding={binding}
                  label={null}
                  hideLabel
                  onFlags={(patch) => actions.updateCustomMappingFlags(entry.id, patch)}
                  onPick={(slot, value) =>
                    selectCustomCatalogValue(entry.id, slot, value)
                  }
                />
                <div className="custom-mapping-remove">
                  <Button
                    variant="ghost"
                    size="tiny"
                    onClick={() => void actions.removeCustomMapping(entry.id)}>
                    {i18n.remove}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
