import { filterOpenAppEditorApps } from "@/domain/apps";
import { usePrefs } from "@/hooks/prefs";
import { useProfileCtx } from "@/hooks/profile";
import { useEditor } from "@/hooks/editor";
import { Button, Modal, Muted, Row, SrOnly } from "@/components/ui";
import { OpenAppPickerContent } from "./OpenAppPickerContent";
import type { InstalledAppWithIcon, OpenAppEditorState } from "@/types";

import * as styles from "./OpenAppEditor.css";

interface OpenAppEditorProps {
  editor: OpenAppEditorState;
}

export const OpenAppEditor = (props: OpenAppEditorProps) => {
  const { i18n } = usePrefs();
  const { mappings } = useProfileCtx();
  const { setEditor } = useEditor();
  const editor = props.editor;
  const filteredApps = filterOpenAppEditorApps(editor);

  const handleSave = () => {
    if (editor.selected === null) {
      return;
    }
    mappings.updateSlot(editor.target, editor.slot, {
      type: "open_app",
      bundle_id: editor.selected.bundleId,
      name: editor.selected.name,
    });
    setEditor(null);
  };

  const handleSelect = (app: InstalledAppWithIcon) => {
    setEditor({
      ...editor,
      selected: { name: app.name, bundleId: app.bundleId },
    });
  };

  return (
    <Modal wide>
      <h2>{i18n.openAppTitle}</h2>
      <Muted variant="modal">{i18n.openAppHint}</Muted>
      <label className={styles.search}>
        <SrOnly>{i18n.openAppSearch}</SrOnly>
        <input
          type="search"
          autoFocus
          placeholder={i18n.openAppSearch}
          value={editor.query}
          onChange={(event) =>
            setEditor({ ...editor, query: event.target.value })
          }
        />
      </label>
      <OpenAppPickerContent
        editor={editor}
        apps={filteredApps}
        loadingLabel={i18n.openAppLoading}
        errorLabel={i18n.openAppError}
        emptyLabel={i18n.openAppEmpty}
        onSelect={handleSelect}
      />
      <Row>
        <Button variant="ghost" onClick={() => setEditor(null)}>
          {i18n.cancel}
        </Button>
        <Button disabled={editor.selected === null} onClick={handleSave}>
          {i18n.save}
        </Button>
      </Row>
    </Modal>
  );
};
