import { BindingRow } from "./BindingRow";
import { asBinding } from "@/domain/profile";
import { comboEditorStateFromEntry } from "@/domain/editors";
import { customMappingTriggerLabel } from "@/i18n/customMapping";
import { usePrefs, useProfileCtx, useEditor } from "@/hooks";
import { Button } from "@/components/ui";
import type { CustomMappingEntry } from "@/types";
interface CustomMappingRowProps {
  entry: CustomMappingEntry;
}
export const CustomMappingRow = (props: CustomMappingRowProps) => {
  const { lang, i18n } = usePrefs();
  const { customMappings } = useProfileCtx();
  const { catalogSelection, setEditor } = useEditor();
  const entry = props.entry;
  const binding = asBinding(entry);
  const triggerLabel = customMappingTriggerLabel(
    entry,
    lang,
    i18n.customMappingSetTrigger,
  );
  return (
    <div className="custom-mapping-row">
      <div className="combo-trigger">
        <Button
          size="tiny"
          onClick={() => setEditor(comboEditorStateFromEntry(entry))}
        >
          {triggerLabel}
        </Button>
      </div>
      <BindingRow
        target={{ kind: "custom", id: entry.id }}
        binding={binding}
        label={null}
        hideLabel
        onFlags={(patch) => customMappings.updateFlags(entry.id, patch)}
        onPick={(slot, value) =>
          catalogSelection.selectCustom(entry.id, slot, value)
        }
      />
      <div className="custom-mapping-remove">
        <Button
          variant="ghost"
          size="tiny"
          onClick={() => void customMappings.remove(entry.id)}
        >
          {i18n.remove}
        </Button>
      </div>
    </div>
  );
};
