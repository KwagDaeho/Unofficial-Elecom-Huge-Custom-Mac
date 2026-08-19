import { useState } from "react";
import { EditorHost } from "@/components/editors";
import { ContactFooter } from "@/components/info";
import { AppHeader, BootScreen, OverlayScrollbar } from "@/components/layout";
import { CustomTab, InfoTab } from "@/components/tabs";
import { usePrefs, useProfileCtx } from "@/hooks";
import type { TabId } from "@/types";

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
      <OverlayScrollbar contentKey={tab} />
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
        {tab === "custom" && <CustomTab />}

        <ContactFooter />
        <EditorHost />
      </main>
    </>
  );
}
