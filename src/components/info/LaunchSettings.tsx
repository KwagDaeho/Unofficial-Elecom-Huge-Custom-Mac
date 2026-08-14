import type { Dict } from "../../i18n";

export function LaunchSettings({
  i18n,
  autostartOn,
  startMinimized,
  onAutostartChange,
  onStartMinimizedChange,
}: {
  i18n: Dict;
  autostartOn: boolean;
  startMinimized: boolean;
  onAutostartChange: (on: boolean) => void | Promise<void>;
  onStartMinimizedChange: (on: boolean) => void;
}) {
  return (
    <section className="panel panel-row panel-row-split">
      <label className="toggle">
        <input
          type="checkbox"
          checked={autostartOn}
          onChange={(e) => void onAutostartChange(e.target.checked)}
        />
        {i18n.launchAtLogin}
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={startMinimized}
          onChange={(e) => onStartMinimizedChange(e.target.checked)}
        />
        {i18n.startMinimized}
      </label>
    </section>
  );
}
