import { useState } from "react";
import { AppHeader } from "./AppHeader";
import { BootScreen } from "./BootScreen";
import { OverlayScrollbar } from "./OverlayScrollbar";
import { EditorHost } from "../editors/EditorHost";
import { ContactFooter } from "../info/ContactFooter";
import { InfoTab } from "../info/InfoTab";
import { ButtonMappingPanel } from "../mapping/ButtonMappingPanel";
import { PointerScrollPanel } from "../mapping/PointerScrollPanel";
import { CustomButtonMappingPanel } from "../mapping/CustomButtonMappingPanel";
import { BallScrollPanel } from "../mapping/BallScrollPanel";
import { usePrefs } from "../../context/prefs";
import { useProfileCtx } from "../../context/profile";
import type { TabId } from "../../types";

export function AppShell() {
  const { i18n } = usePrefs();
  const { profile } = useProfileCtx();
  const [tab, setTab] = useState<TabId>("info");

  if (!profile) {
    return (
      <>
        <OverlayScrollbar />
        <BootScreen />
      </>
    );
  }

  return (
    <>
      <OverlayScrollbar />
      <main className="shell">
        <AppHeader />

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

        {tab === "info" && <InfoTab />}

        {tab === "custom" && (
          <>
            <ButtonMappingPanel />
            <PointerScrollPanel />
            <CustomButtonMappingPanel />
            <BallScrollPanel />
          </>
        )}

        <ContactFooter />
        <EditorHost />
      </main>
    </>
  );
}
