import { asBinding, gestureHoldLabel } from "@/domain/profile";
import { formatActivator } from "@/i18n";
import { usePrefs, useProfileCtx, useEditor } from "@/hooks";
import { Button } from "@/components/ui";
import { BindingRow } from "../button/BindingRow";
import type { GestureMappingEntry } from "@/types";

interface GestureMappingRowProps {
  entry: GestureMappingEntry;
}

export const GestureMappingRow = (props: GestureMappingRowProps) => {
  const { lang, i18n } = usePrefs();
  const { gestureMappings } = useProfileCtx();
  const { catalogSelection, setEditor } = useEditor();
  const entry = props.entry;
  const binding = asBinding(entry);
  const holdLabel = gestureHoldLabel(
    entry,
    (activator) => formatActivator(activator, lang),
    i18n.gestureHoldKeySet,
  );
  const gestureLabel =
    entry.template.length > 0
      ? i18n.gestureShapeRecorded
      : i18n.gestureShapeSet;

  return (
    <div className="custom-mapping-row gesture-mapping-row">
      <div className="combo-trigger">
        <Button
          size="tiny"
          onClick={() =>
            setEditor({
              kind: "gesture_hold_activator",
              entryId: entry.id,
              rejected: null,
            })
          }
        >
          {holdLabel}
        </Button>
      </div>
      <div className="combo-trigger">
        <Button
          size="tiny"
          onClick={() =>
            setEditor({ kind: "gesture_path_recorder", entryId: entry.id })
          }
        >
          {gestureLabel}
        </Button>
      </div>
      <BindingRow
        target={{ kind: "gesture", id: entry.id }}
        binding={binding}
        label={null}
        hideLabel
        onFlags={(patch) => gestureMappings.updateFlags(entry.id, patch)}
        onPick={(slot, value) =>
          catalogSelection.selectGesture(entry.id, slot, value)
        }
      />
      <div className="custom-mapping-remove">
        <Button
          variant="ghost"
          size="tiny"
          onClick={() => void gestureMappings.remove(entry.id)}
        >
          {i18n.remove}
        </Button>
      </div>
    </div>
  );
};
