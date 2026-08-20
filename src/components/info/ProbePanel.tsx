import { Panel } from "@/components/ui/Panel";
import { SectionHead } from "@/components/ui/SectionHead";
import { buttonLabel } from "../../i18n";
import { usePrefs } from "@/hooks/prefs";
import { useSession } from "@/hooks/session";

import * as styles from "./ProbePanel.css";

export const ProbePanel = () => {
  const { lang, i18n } = usePrefs();
  const { report } = useSession();
  return (
    <Panel>
      <SectionHead title={i18n.probe} />
      <pre className={styles.probe}>
        {report
          ? report.ignored
            ? `${report.hex}\n${i18n.probeIgnored}`
            : `${report.hex}\ndx=${report.dx} dy=${report.dy} wheel=${report.wheel} pan=${report.pan}\n[${
                report.buttons.length
                  ? report.buttons.map((id) => buttonLabel(id, lang)).join(", ")
                  : i18n.probeNone
              }]`
          : i18n.probeEmpty}
      </pre>
    </Panel>
  );
};
