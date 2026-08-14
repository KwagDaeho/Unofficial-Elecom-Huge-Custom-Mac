import { useEffect, useMemo, useState } from "react";
import {
  ACTION_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "../domain/actions";
import { AppHeader } from "../components/layout/AppHeader";
import { OverlayScrollbar } from "../components/layout/OverlayScrollbar";
import { CustomKeyEditor } from "../components/editors/CustomKeyEditor";
import { MacroEditor } from "../components/editors/MacroEditor";
import { OpenAppEditor } from "../components/editors/OpenAppEditor";
import { ContactFooter } from "../components/info/ContactFooter";
import { InfoTab } from "../components/info/InfoTab";
import { ButtonMappingPanel } from "../components/mapping/ButtonMappingPanel";
import { PointerScrollPanel } from "../components/mapping/PointerScrollPanel";
import { useDeviceProbe } from "../hooks/useDeviceProbe";
import { useKeyCapture } from "../hooks/useKeyCapture";
import { useLang } from "../hooks/useLang";
import { usePermissions } from "../hooks/usePermissions";
import { useProfile } from "../hooks/useProfile";
import { useTheme } from "../hooks/useTheme";
import { t } from "../i18n";
import * as tauri from "../services/tauri";
import { hexPid } from "../utils/format";
import { openActionEditor } from "./openActionEditor";
import type { ActionCategoryId, EditorMode, TabId } from "../types";

export default function App() {
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const {
    profile,
    catalog,
    bootError,
    setBootError,
    persist,
    updateButtonSlot,
    updateButtonFlags,
    updatePointer,
  } = useProfile();
  const { connected, report } = useDeviceProbe();
  const { trusted, grantAccess } = usePermissions();
  const [tab, setTab] = useState<TabId>("info");
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [autostartOn, setAutostartOn] = useState(false);
  const i18n = t(lang);

  useKeyCapture(editor, setEditor);

  useEffect(() => {
    void tauri.autostartIsEnabled().then(setAutostartOn);
  }, []);

  const connectedLabel = useMemo(() => {
    if (!connected) return i18n.notConnected;
    return `${connected.productName} (${hexPid(connected.vendorId)}:${hexPid(connected.productId)})`;
  }, [connected, i18n.notConnected]);

  const groupedCatalog = useMemo(() => {
    const map = new Map<ActionCategoryId, typeof ACTION_CATALOG>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const entry of ACTION_CATALOG) {
      map.get(entry.category)?.push(entry);
    }
    return CATEGORY_ORDER.map((cat) => ({
      id: cat,
      label: CATEGORY_LABELS[lang][cat],
      entries: map.get(cat) ?? [],
    }));
  }, [lang]);

  if (!profile) {
    return (
      <>
        <OverlayScrollbar />
        <main className="shell">
          <p className="muted">{bootError ? i18n.failedUi : i18n.loading}</p>
          {bootError && <pre className="probe">{bootError}</pre>}
        </main>
      </>
    );
  }

  return (
    <>
      <OverlayScrollbar />
      <main className="shell">
        <AppHeader
          lang={lang}
          theme={theme}
          i18n={i18n}
          onLang={setLang}
          onTheme={setTheme}
        />

        <nav className="tabs" aria-label="Sections">
          <button
            type="button"
            className={tab === "info" ? "tab on" : "tab"}
            onClick={() => setTab("info")}>
            {i18n.tabInfo}
          </button>
          <button
            type="button"
            className={tab === "custom" ? "tab on" : "tab"}
            onClick={() => setTab("custom")}>
            {i18n.tabCustom}
          </button>
        </nav>

        {tab === "info" && (
          <InfoTab
            connected={connected}
            connectedLabel={connectedLabel}
            report={report}
            lang={lang}
            i18n={i18n}
            profile={profile}
            trusted={trusted}
            autostartOn={autostartOn}
            onEnabledChange={(enabled) => void persist({ ...profile, enabled })}
            onGrant={grantAccess}
            onAutostartChange={async (on) => {
              try {
                setAutostartOn(await tauri.autostartSet(on));
              } catch (err) {
                setBootError(String(err));
              }
            }}
            onStartMinimizedChange={(startMinimized) =>
              void persist({ ...profile, startMinimized })
            }
          />
        )}

        {tab === "custom" && (
          <>
            <ButtonMappingPanel
              catalog={catalog}
              profile={profile}
              lang={lang}
              i18n={i18n}
              groupedCatalog={groupedCatalog}
              onPersist={(next) => void persist(next)}
              onActionSelect={(buttonId, slot, value) =>
                openActionEditor(buttonId, slot, value, profile, setEditor, updateButtonSlot)
              }
              onUpdateFlags={updateButtonFlags}
            />
            <PointerScrollPanel
              profile={profile}
              i18n={i18n}
              onUpdatePointer={updatePointer}
            />
          </>
        )}

        <ContactFooter i18n={i18n} />

        {editor?.kind === "custom_key" && (
          <CustomKeyEditor
            editor={editor}
            lang={lang}
            i18n={i18n}
            setEditor={setEditor}
            onSave={updateButtonSlot}
          />
        )}

        {editor?.kind === "macro" && (
          <MacroEditor
            editor={editor}
            lang={lang}
            i18n={i18n}
            setEditor={setEditor}
            onSave={updateButtonSlot}
          />
        )}

        {editor?.kind === "open_app" && (
          <OpenAppEditor
            editor={editor}
            i18n={i18n}
            setEditor={setEditor}
            onSave={updateButtonSlot}
          />
        )}
      </main>
    </>
  );
}
