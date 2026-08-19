/**
 * Sole FE boundary for Tauri `invoke` calls.
 * Command strings / payloads match `src-tauri` + current App.tsx usage.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  ButtonMeta,
  DeviceInfo,
  InstalledApp,
  LastReport,
  PermissionStatus,
  Profile,
} from "../types";

export async function getProfile(): Promise<Profile> {
  return invoke<Profile>("get_profile");
}

export async function saveProfile(profile: Profile): Promise<void> {
  await invoke("save_profile", { profile });
}

/** Backend command: `get_connected`. */
export async function getDeviceInfo(): Promise<DeviceInfo | null> {
  return invoke<DeviceInfo | null>("get_connected");
}

export async function getConnected(): Promise<DeviceInfo | null> {
  return getDeviceInfo();
}

export async function isDeviceConnected(): Promise<boolean> {
  return (await getDeviceInfo()) != null;
}

export async function getLastReport(): Promise<LastReport | null> {
  return invoke<LastReport | null>("get_last_report");
}

/** Backend command: `permission_status`. */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  return invoke<PermissionStatus>("permission_status");
}

/**
 * Backend only exposes `request_accessibility`, which also requests
 * Input Monitoring once Accessibility looks trusted.
 */
export async function requestPermission(
  kind: "accessibility" | "input_monitoring",
): Promise<boolean> {
  void kind;
  return invoke<boolean>("request_accessibility");
}

export async function openAccessibilitySettings(): Promise<void> {
  await invoke("open_accessibility_settings");
}

/** Backend command: `open_privacy_security_settings` (closest IM settings entry). */
export async function openInputMonitoringSettings(): Promise<void> {
  await invoke("open_privacy_security_settings");
}

export async function relaunchApp(): Promise<void> {
  await invoke("relaunch_app");
}

export async function listInstalledApps(): Promise<InstalledApp[]> {
  return invoke<InstalledApp[]>("list_installed_apps");
}

/** Open a filesystem path via the opener plugin (not an invoke command). */
export async function openPath(path: string): Promise<void> {
  const mod = await import("@tauri-apps/plugin-opener");
  await mod.openPath(path);
}

export async function openUrl(url: string): Promise<void> {
  const mod = await import("@tauri-apps/plugin-opener");
  await mod.openUrl(url);
}

export async function buttonCatalog(): Promise<ButtonMeta[]> {
  return invoke<ButtonMeta[]>("button_catalog");
}

export type CaptureSession = {
  keyCapture: boolean;
  comboTrigger: boolean;
  activatorCapture: boolean;
  uiModal: boolean;
};

export const CAPTURE_SESSION_OFF: CaptureSession = {
  keyCapture: false,
  comboTrigger: false,
  activatorCapture: false,
  uiModal: false,
};

export async function applyCaptureSession(session: CaptureSession): Promise<void> {
  await invoke("apply_capture_session", { session });
}

export async function setKeyCapture(active: boolean): Promise<void> {
  await invoke("set_key_capture", { active });
}

export async function setActivatorCapture(active: boolean): Promise<void> {
  await invoke("set_activator_capture", { active });
}

export async function setComboActivatorCapture(active: boolean): Promise<void> {
  await invoke("set_combo_activator_capture", { active });
}

export async function setComboTriggerCapture(active: boolean): Promise<void> {
  await invoke("set_combo_trigger_capture", { active });
}

export async function setUiModal(active: boolean): Promise<void> {
  await invoke("set_ui_modal", { active });
}

export async function getAppIcon(path: string): Promise<string | null> {
  return invoke<string | null>("get_app_icon", { path });
}

export async function resetTccPermissions(): Promise<void> {
  await invoke("reset_tcc_permissions");
}

export async function autostartIsEnabled(): Promise<boolean> {
  try {
    const mod = await import("@tauri-apps/plugin-autostart");
    return await mod.isEnabled();
  } catch {
    return false;
  }
}

export async function autostartSet(on: boolean): Promise<boolean> {
  const mod = await import("@tauri-apps/plugin-autostart");
  if (on) await mod.enable();
  else await mod.disable();
  return await mod.isEnabled();
}
