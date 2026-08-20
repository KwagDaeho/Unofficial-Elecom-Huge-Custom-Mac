import { asBinding, gestureHoldLabel, gesturePreviewPoints } from "@/domain/profile";
import { formatActivator } from "@/i18n";
import { usePrefs, useProfileCtx, useEditor } from "@/hooks";
import { Button } from "@/components/ui";
import { ActionSelect } from "../button/ActionSelect";
import { GestureTemplateThumbnail } from "./GestureTemplateThumbnail";
import type { GestureMappingEntry } from "@/types";
import * as styles from "./GestureMappingRow.css";
import { colGap } from "./GestureMappingPanel.css";

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
  const openRecorder = () =>
    setEditor({ kind: "gesture_path_recorder", entryId: entry.id });

  return (
    <div className={styles.row}>
      <div className={styles.comboTrigger}>
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
      <span className={colGap} aria-hidden="true" />
      <GestureTemplateThumbnail
        template={gesturePreviewPoints(entry)}
        emptyLabel={i18n.gestureShapeSet}
        previewLabel={i18n.gestureShapePreviewHint}
      />
      <span className={colGap} aria-hidden="true" />
      <ActionSelect
        action={binding.click}
        onPick={(value) => catalogSelection.selectGesture(entry.id, "click", value)}
      />
      <span className={colGap} aria-hidden="true" />
      <div className={styles.actions}>
        <Button variant="ghost" size="tiny" onClick={openRecorder}>
          {i18n.editStep}
        </Button>
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
