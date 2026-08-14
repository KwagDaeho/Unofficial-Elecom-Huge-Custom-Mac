import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ACTION_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CUSTOM_KEY_SENTINEL,
  ENTRY_LABELS,
  MACRO_SENTINEL,
  OPEN_APP_SENTINEL,
  buttonLabel,
  describeAction,
  findCatalogEntry,
  formatKeyChord,
  type ActionCategoryId,
} from "./actions";
import {
  actionKey,
  asBinding,
  formatSpeedPair,
  longPressMs,
  normalizeTiltPanStreamFlags,
  POINTER_REF_DPI,
  pointerSpeedX,
  pointerSpeedY,
  SCROLL_BASE_HORIZONTAL_PX,
  SCROLL_BASE_VERTICAL_PX,
  scrollSpeedHorizontal,
  scrollSpeedVertical,
  tiltForcesAutoClick,
  type Action,
  type ButtonBinding,
  type ButtonId,
  type ButtonMeta,
  type DeviceInfo,
  type LastReport,
  type MacroStep,
  type Profile,
} from "./types";
import { CONTACT_EMAIL, CONTACT_URL, t, type Lang } from "./i18n";
import { OverlayScrollbar } from "./OverlayScrollbar";
import "./App.css";

type PermissionStatus = {
  accessibility: boolean;
  inputMonitoring: boolean;
  postEvent: boolean;
  ready: boolean;
};

type ActionSlot = "click" | "long_press";

type EditorMode =
  | {
      kind: "custom_key";
      buttonId: ButtonId;
      slot: ActionSlot;
      draft: string[];
    }
  | {
      kind: "macro";
      buttonId: ButtonId;
      slot: ActionSlot;
      steps: MacroStep[];
      capturing: boolean;
    }
  | {
      kind: "open_app";
      buttonId: ButtonId;
      slot: ActionSlot;
      query: string;
      selected: { name: string; bundleId: string } | null;
      apps: { name: string; bundleId: string; path: string; icon?: string }[];
      loading: boolean;
      error: string | null;
    };

type TabId = "info" | "custom";
type Theme = "light" | "dark";

async function autostartIsEnabled(): Promise<boolean> {
  try {
    const mod = await import("@tauri-apps/plugin-autostart");
    return await mod.isEnabled();
  } catch {
    return false;
  }
}

async function autostartSet(on: boolean): Promise<boolean> {
  const mod = await import("@tauri-apps/plugin-autostart");
  if (on) await mod.enable();
  else await mod.disable();
  return await mod.isEnabled();
}

function hexPid(id: number) {
  return `0x${id.toString(16).toUpperCase().padStart(4, "0")}`;
}

function loadLang(): Lang {
  const saved = localStorage.getItem("elecom-huge-lang");
  return saved === "en" ? "en" : "ko";
}

function loadTheme(): Theme {
  const saved = localStorage.getItem("elecom-huge-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function selectValueForAction(action: Action): string {
  const entry = findCatalogEntry(action);
  if (entry) return actionKey(entry.action);
  return actionKey(action);
}

function ActionSelect({
  action,
  lang,
  groups,
  onPick,
  disabled = false,
}: {
  action: Action;
  lang: Lang;
  groups: {
    id: ActionCategoryId;
    label: string;
    entries: typeof ACTION_CATALOG;
  }[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const matched = findCatalogEntry(action);
  const value = selectValueForAction(action);
  return (
    <select value={value} disabled={disabled} onChange={(e) => onPick(e.target.value)}>
      {!matched && <option value={actionKey(action)}>{describeAction(action, lang)}</option>}
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.entries.map((entry) => {
            if (entry.special === "custom_key") {
              return (
                <option key={entry.id} value={CUSTOM_KEY_SENTINEL}>
                  {ENTRY_LABELS[lang].custom_key}
                </option>
              );
            }
            if (entry.special === "macro") {
              return (
                <option key={entry.id} value={MACRO_SENTINEL}>
                  {ENTRY_LABELS[lang].macro}
                </option>
              );
            }
            if (entry.special === "open_app") {
              return (
                <option key={entry.id} value={OPEN_APP_SENTINEL}>
                  {ENTRY_LABELS[lang].open_app_pick}
                </option>
              );
            }
            return (
              <option key={entry.id} value={actionKey(entry.action)}>
                {ENTRY_LABELS[lang][entry.id] ?? entry.id}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [tab, setTab] = useState<TabId>("info");
  const i18n = t(lang);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<ButtonMeta[]>([]);
  const [connected, setConnected] = useState<DeviceInfo | null>(null);
  const [report, setReport] = useState<LastReport | null>(null);
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  const [autostartOn, setAutostartOn] = useState(false);
  const [bootError, setBootError] = useState<string>("");
  const [editor, setEditor] = useState<EditorMode | null>(null);

  const trusted = perms?.ready ?? false;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    try {
      const [p, buttons, conn, perm, auto, last] = await Promise.all([
        invoke<Profile>("get_profile"),
        invoke<ButtonMeta[]>("button_catalog"),
        invoke<DeviceInfo | null>("get_connected"),
        invoke<PermissionStatus>("permission_status"),
        autostartIsEnabled(),
        invoke<LastReport | null>("get_last_report"),
      ]);
      setProfile(p);
      setCatalog(buttons);
      setConnected(conn);
      setPerms(perm);
      setAutostartOn(auto);
      setReport(last);
      setBootError("");
      const normalized = normalizeTiltPanStreamFlags(p);
      if (normalized !== p) {
        void invoke("save_profile", { profile: normalized })
          .then(() => setProfile(normalized))
          .catch((e) => setBootError(String(e)));
      }
    } catch (e) {
      setBootError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const probe = window.setInterval(() => {
      void invoke<LastReport | null>("get_last_report").then((next) => {
        setReport((prev) => {
          if (
            prev?.tsMs === next?.tsMs &&
            prev?.hex === next?.hex &&
            prev?.dx === next?.dx &&
            prev?.dy === next?.dy &&
            prev?.wheel === next?.wheel &&
            prev?.pan === next?.pan &&
            prev?.buttons.join() === next?.buttons.join()
          ) {
            return prev;
          }
          return next;
        });
      });
    }, 50);
    const slow = window.setInterval(() => {
      void invoke<DeviceInfo | null>("get_connected").then(setConnected);
      void invoke<PermissionStatus>("permission_status").then(setPerms);
    }, 1000);
    return () => {
      window.clearInterval(probe);
      window.clearInterval(slow);
    };
  }, [refresh]);

  useEffect(() => {
    const nativeCapture = !!editor && (editor.kind === "custom_key" || (editor.kind === "macro" && editor.capturing));

    void invoke("set_key_capture", { active: nativeCapture });

    if (!nativeCapture || !editor) {
      return () => {
        void invoke("set_key_capture", { active: false });
      };
    }

    let cancelled = false;
    const unlistenPromise = import("@tauri-apps/api/event").then(({ listen }) =>
      listen<{ keys: string[]; escape: boolean }>("key-capture", (ev) => {
        if (cancelled) return;
        const { keys, escape } = ev.payload;

        if (editor.kind === "custom_key") {
          if (escape) {
            setEditor(null);
            return;
          }
          const hasMain = keys.some((k) => !["Control", "Option", "Shift", "Meta"].includes(k));
          if (hasMain) setEditor({ ...editor, draft: keys });
          return;
        }

        if (editor.kind === "macro" && editor.capturing) {
          if (escape) {
            setEditor({ ...editor, capturing: false });
            return;
          }
          const hasMain = keys.some((k) => !["Control", "Option", "Shift", "Meta"].includes(k));
          if (!hasMain) return;
          setEditor({
            ...editor,
            capturing: false,
            steps: [...editor.steps, { type: "key_stroke", keys }],
          });
        }
      }),
    );

    const blockBrowser = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      (e as KeyboardEvent).stopImmediatePropagation?.();
    };
    const blockOpts: AddEventListenerOptions = { capture: true };
    window.addEventListener("keydown", blockBrowser, blockOpts);
    window.addEventListener("keyup", blockBrowser, blockOpts);
    window.addEventListener("keypress", blockBrowser, blockOpts);

    return () => {
      cancelled = true;
      void invoke("set_key_capture", { active: false });
      void unlistenPromise.then((un) => un());
      window.removeEventListener("keydown", blockBrowser, blockOpts);
      window.removeEventListener("keyup", blockBrowser, blockOpts);
      window.removeEventListener("keypress", blockBrowser, blockOpts);
    };
  }, [editor]);

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

  function switchLang(next: Lang) {
    setLang(next);
    localStorage.setItem("elecom-huge-lang", next);
  }

  function switchTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem("elecom-huge-theme", next);
    applyTheme(next);
  }

  async function persist(next: Profile) {
    try {
      await invoke("save_profile", { profile: next });
      setProfile(next);
    } catch (e) {
      setBootError(String(e));
    }
  }

  function updateButtonSlot(id: ButtonId, slot: ActionSlot, action: Action) {
    if (!profile) return;
    const current = asBinding(profile.buttons[id]);
    let next: ButtonBinding =
      slot === "click"
        ? { ...current, click: action }
        : { ...current, longPress: action };
    if (slot === "click" && tiltForcesAutoClick(id, action)) {
      // Pan-stream tilt is always continuous — mirror that in the AC toggle.
      next = { ...next, autoClick: true, longPressEnabled: false };
    }
    void persist({
      ...profile,
      buttons: { ...profile.buttons, [id]: next },
    });
  }

  function updateButtonFlags(
    id: ButtonId,
    patch: Partial<Pick<ButtonBinding, "longPressEnabled" | "autoClick">>,
  ) {
    if (!profile) return;
    const current = asBinding(profile.buttons[id]);
    if (tiltForcesAutoClick(id, current.click)) {
      // Locked on while OS-default / L-R scroll is bound to tilt.
      return;
    }
    let longPressEnabled = patch.longPressEnabled ?? !!current.longPressEnabled;
    let autoClick = patch.autoClick ?? !!current.autoClick;
    if (patch.longPressEnabled === true) autoClick = false;
    if (patch.autoClick === true) longPressEnabled = false;
    void persist({
      ...profile,
      buttons: {
        ...profile.buttons,
        [id]: { ...current, longPressEnabled, autoClick },
      },
    });
  }

  function onActionSelect(buttonId: ButtonId, slot: ActionSlot, value: string) {
    if (value === CUSTOM_KEY_SENTINEL) {
      setEditor({ kind: "custom_key", buttonId, slot, draft: [] });
      return;
    }
    if (value === MACRO_SENTINEL) {
      const existing = asBinding(profile?.buttons[buttonId]);
      const current = slot === "click" ? existing.click : existing.longPress;
      const steps = current.type === "macro" ? current.steps : ([] as MacroStep[]);
      setEditor({ kind: "macro", buttonId, slot, steps, capturing: false });
      return;
    }
    if (value === OPEN_APP_SENTINEL) {
      const existing = asBinding(profile?.buttons[buttonId]);
      const current = slot === "click" ? existing.click : existing.longPress;
      const selected =
        current.type === "open_app" && current.bundle_id
          ? { name: current.name ?? current.bundle_id, bundleId: current.bundle_id }
          : null;
      setEditor({
        kind: "open_app",
        buttonId,
        slot,
        query: "",
        selected,
        apps: [],
        loading: true,
        error: null,
      });
      void invoke<{ name: string; bundleId: string; path: string }[]>("list_installed_apps")
        .then((apps) => {
          setEditor((prev) =>
            prev?.kind === "open_app"
              ? { ...prev, apps, loading: false, error: null }
              : prev,
          );
          // Fill icons in the background (capped concurrency).
          const queue = apps.map((a) => a.path);
          const workers = Array.from({ length: 6 }, async () => {
            while (queue.length > 0) {
              const path = queue.shift();
              if (!path) break;
              try {
                const icon = await invoke<string | null>("get_app_icon", { path });
                if (!icon) continue;
                setEditor((prev) => {
                  if (prev?.kind !== "open_app") return prev;
                  return {
                    ...prev,
                    apps: prev.apps.map((a) => (a.path === path ? { ...a, icon } : a)),
                  };
                });
              } catch {
                /* ignore missing icons */
              }
            }
          });
          void Promise.all(workers);
        })
        .catch((e) => {
          setEditor((prev) =>
            prev?.kind === "open_app"
              ? { ...prev, loading: false, error: String(e) }
              : prev,
          );
        });
      return;
    }
    try {
      updateButtonSlot(buttonId, slot, JSON.parse(value) as Action);
    } catch {
      updateButtonSlot(buttonId, slot, {
        type: slot === "click" ? "default" : "disabled",
      });
    }
  }

  function updatePointer<K extends keyof Profile["pointer"]>(key: K, value: Profile["pointer"][K]) {
    if (!profile) return;
    void persist({
      ...profile,
      pointer: { ...profile.pointer, [key]: value },
    });
  }

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
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">ELECOM</p>
          <div className="toolbar">
            <div className="theme-toggle" role="group" aria-label="Theme">
              <button
                type="button"
                className={theme === "light" ? "theme on" : "theme"}
                aria-label={i18n.themeLight}
                title={i18n.themeLight}
                onClick={() => switchTheme("light")}>
                <SunIcon />
              </button>
              <button
                type="button"
                className={theme === "dark" ? "theme on" : "theme"}
                aria-label={i18n.themeDark}
                title={i18n.themeDark}
                onClick={() => switchTheme("dark")}>
                <MoonIcon />
              </button>
            </div>
            <div className="lang-switch" role="group" aria-label="Language">
              <button type="button" className={lang === "ko" ? "lang on" : "lang"} onClick={() => switchLang("ko")}>
                KR
              </button>
              <button type="button" className={lang === "en" ? "lang on" : "lang"} onClick={() => switchLang("en")}>
                EN
              </button>
            </div>
          </div>
        </div>
        <h1>HUGE</h1>
        <p className="disclaimer">{i18n.disclaimer}</p>
      </header>

      <nav className="tabs" aria-label="Sections">
        <button type="button" className={tab === "info" ? "tab on" : "tab"} onClick={() => setTab("info")}>
          {i18n.tabInfo}
        </button>
        <button type="button" className={tab === "custom" ? "tab on" : "tab"} onClick={() => setTab("custom")}>
          {i18n.tabCustom}
        </button>
      </nav>

      {tab === "info" && (
        <>
          <section className="panel panel-row">
            <div className="status-row">
              <span className={`dot ${connected ? "on" : "off"}`} />
              <strong>{connected ? i18n.connected : i18n.waiting}</strong>
              <span className="muted status-detail">{connectedLabel}</span>
            </div>
          </section>

          <section className="panel panel-row">
            <label className="toggle toggle-inline">
              <input
                type="checkbox"
                checked={profile.enabled}
                onChange={(e) => void persist({ ...profile, enabled: e.target.checked })}
              />
              <span className="toggle-title">{i18n.remappingOn}</span>
              <span className="toggle-desc">{i18n.remappingDesc}</span>
            </label>
          </section>

          {!trusted && (
            <section className="panel warn">
              <h2>{i18n.accessibilityTitle}</h2>
              <p>{i18n.accessibilityBody}</p>
              <ul className="perm-list">
                <li>
                  {i18n.accessibility}: {perms?.accessibility || perms?.postEvent ? "ON" : "OFF"}
                </li>
                <li>
                  {i18n.inputMonitoring}: {perms?.inputMonitoring ? "ON" : "OFF"}
                </li>
              </ul>
              <div className="row">
                <button
                  type="button"
                  onClick={async () => {
                    // Prompt only — do not also open Settings (that stacked alert + pane).
                    await invoke<boolean>("request_accessibility");
                    setPerms(await invoke<PermissionStatus>("permission_status"));
                  }}>
                  {i18n.grantAccess}
                </button>
                <button type="button" className="ghost" onClick={() => void invoke("open_accessibility_settings")}>
                  {i18n.openSettings}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void invoke("open_privacy_security_settings")}>
                  {i18n.openPrivacySecurity}
                </button>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="ghost"
                  onClick={async () => {
                    await invoke("reset_tcc_permissions");
                    await invoke("open_accessibility_settings");
                    setPerms(await invoke<PermissionStatus>("permission_status"));
                  }}>
                  {i18n.resetPermissions}
                </button>
              </div>
            </section>
          )}

          <section className="panel panel-row panel-row-split">
            <label className="toggle">
              <input
                type="checkbox"
                checked={autostartOn}
                onChange={async (e) => {
                  try {
                    setAutostartOn(await autostartSet(e.target.checked));
                  } catch (err) {
                    setBootError(String(err));
                  }
                }}
              />
              {i18n.launchAtLogin}
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={!!profile.startMinimized}
                onChange={(e) =>
                  void persist({
                    ...profile,
                    startMinimized: e.target.checked,
                  })
                }
              />
              {i18n.startMinimized}
            </label>
          </section>

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
        </>
      )}

      {tab === "custom" && (
        <>
          <section className="panel">
            <div className="section-head">
              <h2>{i18n.buttons}</h2>
            </div>
            <div className="controls tight map-tools">
              <label>
                {i18n.longPressTime} ({longPressMs(profile)} ms)
                <input
                  type="range"
                  min={150}
                  max={2000}
                  step={50}
                  value={longPressMs(profile)}
                  onChange={(e) =>
                    void persist({
                      ...profile,
                      longPressMs: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="button-grid">
              <div className="button-head">
                <span />
                <span>{i18n.longPressEnable}</span>
                <span>{i18n.autoClickEnable}</span>
                <span>{i18n.clickAction}</span>
                <span>{i18n.longPressAction}</span>
              </div>
              {catalog.map((btn) => {
                const binding = asBinding(profile.buttons[btn.id]);
                const forceAc = tiltForcesAutoClick(btn.id, binding.click);
                const autoOn = forceAc || !!binding.autoClick;
                const lpOn = forceAc ? false : !!binding.longPressEnabled;
                return (
                  <div key={btn.id} className="button-card">
                    <span className="btn-name" title={buttonLabel(btn.id, lang)}>
                      {buttonLabel(btn.id, lang)}
                      {btn.hiddenFromMacos && <em>{i18n.rawHid}</em>}
                    </span>
                    <label className="toggle flag-toggle" title={i18n.longPressEnable}>
                      <input
                        type="checkbox"
                        checked={lpOn}
                        disabled={autoOn || forceAc}
                        onChange={(e) =>
                          updateButtonFlags(btn.id, {
                            longPressEnabled: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <label className="toggle flag-toggle" title={i18n.autoClickEnable}>
                      <input
                        type="checkbox"
                        checked={autoOn}
                        disabled={lpOn || forceAc}
                        onChange={(e) =>
                          updateButtonFlags(btn.id, {
                            autoClick: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <ActionSelect
                      action={binding.click}
                      lang={lang}
                      groups={groupedCatalog}
                      onPick={(value) => onActionSelect(btn.id, "click", value)}
                    />
                    <ActionSelect
                      action={binding.longPress}
                      lang={lang}
                      groups={groupedCatalog}
                      disabled={!lpOn}
                      onPick={(value) =>
                        onActionSelect(btn.id, "long_press", value)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>{i18n.pointerScroll}</h2>
            </div>
            <div className="controls">
              <label>
                {i18n.speedX} {formatSpeedPair(pointerSpeedX(profile.pointer), POINTER_REF_DPI)}
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.05}
                  value={pointerSpeedX(profile.pointer)}
                  onChange={(e) => updatePointer("speedX", Number(e.target.value))}
                />
              </label>
              <label>
                {i18n.speedY} {formatSpeedPair(pointerSpeedY(profile.pointer), POINTER_REF_DPI)}
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.05}
                  value={pointerSpeedY(profile.pointer)}
                  onChange={(e) => updatePointer("speedY", Number(e.target.value))}
                />
              </label>
              <label>
                {i18n.scrollSpeedVertical}{" "}
                {formatSpeedPair(scrollSpeedVertical(profile.pointer), SCROLL_BASE_VERTICAL_PX)}
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.05}
                  value={scrollSpeedVertical(profile.pointer)}
                  onChange={(e) => updatePointer("scrollSpeedVertical", Number(e.target.value))}
                />
              </label>
              <label>
                {i18n.scrollSpeedHorizontal}{" "}
                {formatSpeedPair(scrollSpeedHorizontal(profile.pointer), SCROLL_BASE_HORIZONTAL_PX)}
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.05}
                  value={scrollSpeedHorizontal(profile.pointer)}
                  onChange={(e) => updatePointer("scrollSpeedHorizontal", Number(e.target.value))}
                />
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={profile.pointer.acceleration}
                  onChange={(e) => updatePointer("acceleration", e.target.checked)}
                />
                {i18n.acceleration}
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={profile.pointer.invertVerticalScroll ?? false}
                  onChange={(e) => updatePointer("invertVerticalScroll", e.target.checked)}
                />
                {i18n.invertVertical}
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={profile.pointer.invertHorizontalScroll ?? false}
                  onChange={(e) => updatePointer("invertHorizontalScroll", e.target.checked)}
                />
                {i18n.invertHorizontal}
              </label>
            </div>
          </section>
        </>
      )}

      <footer className="footer">
        <p className="credit">
          <span className="credit-by">{i18n.creditBy}</span> {i18n.credit}
        </p>
        <p className="muted">{i18n.version}</p>
        <div className="contact-block">
          <strong>{i18n.contactLabel}</strong>
          <p>
            {i18n.kakaoLabel}{" "}
            <a
              href={CONTACT_URL}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.preventDefault();
                void import("@tauri-apps/plugin-opener").then((m) => m.openUrl(CONTACT_URL));
              }}>
              open.kakao.com/me/Theo_Kwag
            </a>
          </p>
          <p>
            {i18n.emailLabel}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              onClick={(e) => {
                e.preventDefault();
                void import("@tauri-apps/plugin-opener").then((m) => m.openUrl(`mailto:${CONTACT_EMAIL}`));
              }}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </footer>

      {editor?.kind === "custom_key" && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>{i18n.customKeyTitle}</h2>
            <p className="muted">{i18n.customKeyHint}</p>
            <div className="chord-preview">
              {editor.draft.length > 0 ? formatKeyChord(editor.draft, lang) : i18n.customKeyWaiting}
            </div>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setEditor({ ...editor, draft: [] })}>
                {i18n.clear}
              </button>
              <button type="button" className="ghost" onClick={() => setEditor(null)}>
                {i18n.cancel}
              </button>
              <button
                type="button"
                disabled={editor.draft.length === 0}
                onClick={() => {
                  updateButtonSlot(editor.buttonId, editor.slot, {
                    type: "key_stroke",
                    keys: editor.draft,
                  });
                  setEditor(null);
                }}>
                {i18n.save}
              </button>
            </div>
          </div>
      </div>
      )}

      {editor?.kind === "macro" && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal-wide" role="dialog" aria-modal="true">
            <h2>{i18n.macroTitle}</h2>
            <p className="muted">{i18n.macroHint}</p>
            <ul className="macro-steps">
              {editor.steps.map((step, idx) => (
                <li key={`${idx}-${step.type}`}>
                  <span>
                    {step.type === "key_stroke"
                      ? formatKeyChord(step.keys, lang)
                      : step.type === "delay"
                        ? `${step.ms} ms`
                        : step.button}
                  </span>
                  <button
                    type="button"
                    className="ghost tiny-btn"
                    onClick={() =>
                      setEditor({
                        ...editor,
                        steps: editor.steps.filter((_, i) => i !== idx),
                      })
                    }>
                    {i18n.removeStep}
                  </button>
                </li>
              ))}
            </ul>
            {editor.capturing && <p className="chord-preview">{i18n.customKeyWaiting}</p>}
            <div className="row wrap">
              <button type="button" className="ghost" onClick={() => setEditor({ ...editor, capturing: true })}>
                {i18n.addKeystroke}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setEditor({
                    ...editor,
                    steps: [...editor.steps, { type: "delay", ms: 100 }],
                  })
                }>
                {i18n.addDelay}
              </button>
            </div>
            {editor.steps.some((s) => s.type === "delay") && (
              <div className="controls tight">
                {editor.steps.map((step, idx) =>
                  step.type === "delay" ? (
                    <label key={`delay-${idx}`}>
                      {i18n.delayMs} #{idx + 1}
                      <input
                        type="number"
                        min={0}
                        max={5000}
                        value={step.ms}
                        onChange={(e) => {
                          const ms = Math.max(0, Math.min(5000, Number(e.target.value) || 0));
                          const steps = editor.steps.slice();
                          steps[idx] = { type: "delay", ms };
                          setEditor({ ...editor, steps });
                        }}
                      />
                    </label>
                  ) : null,
                )}
              </div>
            )}
            <div className="row">
              <button type="button" className="ghost" onClick={() => setEditor(null)}>
                {i18n.cancel}
              </button>
              <button
                type="button"
                disabled={editor.steps.length === 0}
                onClick={() => {
                  updateButtonSlot(editor.buttonId, editor.slot, {
                    type: "macro",
                    steps: editor.steps,
                  });
                  setEditor(null);
                }}>
                {i18n.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {editor?.kind === "open_app" && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal-wide" role="dialog" aria-modal="true">
            <h2>{i18n.openAppTitle}</h2>
            <p className="muted">{i18n.openAppHint}</p>
            <label className="app-search">
              <span className="sr-only">{i18n.openAppSearch}</span>
        <input
                type="search"
                autoFocus
                placeholder={i18n.openAppSearch}
                value={editor.query}
                onChange={(e) => setEditor({ ...editor, query: e.target.value })}
              />
            </label>
            {editor.loading ? (
              <p className="muted">{i18n.openAppLoading}</p>
            ) : editor.error ? (
              <p className="muted">{i18n.openAppError}</p>
            ) : (
              <ul className="app-list" role="listbox">
                {editor.apps
                  .filter((app) => {
                    const q = editor.query.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      app.name.toLowerCase().includes(q) ||
                      app.bundleId.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 80)
                  .map((app) => {
                    const on = editor.selected?.bundleId === app.bundleId;
                    return (
                      <li key={app.bundleId}>
                        <button
                          type="button"
                          className={on ? "app-row on" : "app-row"}
                          role="option"
                          aria-selected={on}
                          onClick={() =>
                            setEditor({
                              ...editor,
                              selected: { name: app.name, bundleId: app.bundleId },
                            })
                          }>
                          {app.icon ? (
                            <img className="app-icon" src={app.icon} alt="" />
                          ) : (
                            <span className="app-icon app-icon-fallback" aria-hidden />
                          )}
                          <span className="app-meta">
                            <strong>{app.name}</strong>
                            <span>{app.bundleId}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                {!editor.loading &&
                  editor.apps.filter((app) => {
                    const q = editor.query.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      app.name.toLowerCase().includes(q) ||
                      app.bundleId.toLowerCase().includes(q)
                    );
                  }).length === 0 && <li className="muted">{i18n.openAppEmpty}</li>}
              </ul>
            )}
            <div className="row">
              <button type="button" className="ghost" onClick={() => setEditor(null)}>
                {i18n.cancel}
              </button>
              <button
                type="button"
                disabled={!editor.selected}
                onClick={() => {
                  if (!editor.selected) return;
                  updateButtonSlot(editor.buttonId, editor.slot, {
                    type: "open_app",
                    bundle_id: editor.selected.bundleId,
                    name: editor.selected.name,
                  });
                  setEditor(null);
                }}>
                {i18n.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
