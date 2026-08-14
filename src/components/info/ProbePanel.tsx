import { buttonLabel } from "../../domain/actions";
import type { LastReport } from "../../types";
import type { Dict, Lang } from "../../i18n";

export function ProbePanel({
  report,
  lang,
  i18n,
}: {
  report: LastReport | null;
  lang: Lang;
  i18n: Dict;
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{i18n.probe}</h2>
      </div>
      <pre className="probe">
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
    </section>
  );
}
