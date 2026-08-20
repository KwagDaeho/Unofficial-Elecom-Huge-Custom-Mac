import { useState } from "react";
import { EditorHost } from "@/components/editors";
import { ContactFooter } from "@/components/info";
import { AppHeader, BootScreen, OverlayScrollbar } from "@/components/layout";
import { CustomTab, InfoTab } from "@/components/tabs";
import { usePrefs, useProfileCtx } from "@/hooks";
import type { TabId } from "@/types";
import { cx } from "@/utils/cx";

import * as styles from "./AppShell.css";

export const AppShell = () => {
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
      <main className={styles.shell}>
        <AppHeader />

        <nav className={styles.tabs} aria-label="Sections">
          <button
            type="button"
            className={cx(styles.tab, tab === "info" && styles.tabActive)}
            onClick={() => setTab("info")}
          >
            {i18n.tabInfo}
          </button>
          <button
            type="button"
            className={cx(styles.tab, tab === "custom" && styles.tabActive)}
            onClick={() => setTab("custom")}
          >
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
};
