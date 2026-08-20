/**
 * Sole FE boundary for Tauri `invoke` calls.
 * Command strings / payloads match `src-tauri` + current App.tsx usage.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  ButtonMeta,
  CaptureSession,
  DeviceInfo,
  InstalledApp,
  LastReport,
  PermissionStatus,
  Profile,
} from "@/types";
export const getProfile = async (): Promise<Profile> => {
  return invoke<Profile>("get_profile");
};
export const saveProfile = async (profile: Profile): Promise<void> => {
  await invoke("save_profile", { profile });
};
export const getDeviceInfo = async (): Promise<DeviceInfo | null> => {
  return invoke<DeviceInfo | null>("get_connected");
};
export const getConnected = async (): Promise<DeviceInfo | null> => {
  return getDeviceInfo();
};
export const isDeviceConnected = async (): Promise<boolean> => {
  return (await getDeviceInfo()) != null;
};
export const getLastReport = async (): Promise<LastReport | null> => {
  return invoke<LastReport | null>("get_last_report");
};
export const getPermissionStatus = async (): Promise<PermissionStatus> => {
  return invoke<PermissionStatus>("permission_status");
};
export const requestPermission = async (
  kind: "accessibility" | "input_monitoring",
): Promise<boolean> => {
  void kind;
  return invoke<boolean>("request_accessibility");
};
export const openAccessibilitySettings = async (): Promise<void> => {
  await invoke("open_accessibility_settings");
};
export const openInputMonitoringSettings = async (): Promise<void> => {
  await invoke("open_privacy_security_settings");
};
export const relaunchApp = async (): Promise<void> => {
  await invoke("relaunch_app");
};
export const listInstalledApps = async (): Promise<InstalledApp[]> => {
  return invoke<InstalledApp[]>("list_installed_apps");
};
export const openPath = async (path: string): Promise<void> => {
  const mod = await import("@tauri-apps/plugin-opener");
  await mod.openPath(path);
};
export const openUrl = async (url: string): Promise<void> => {
  const mod = await import("@tauri-apps/plugin-opener");
  await mod.openUrl(url);
};
export const buttonCatalog = async (): Promise<ButtonMeta[]> => {
  return invoke<ButtonMeta[]>("button_catalog");
};
export const CAPTURE_SESSION_OFF: CaptureSession = {
  keyCapture: false,
  comboTrigger: false,
  activatorCapture: false,
  uiModal: false,
  gestureRecord: false,
};
export const applyCaptureSession = async (
  session: CaptureSession,
): Promise<void> => {
  await invoke("apply_capture_session", { session });
};
export const setKeyCapture = async (active: boolean): Promise<void> => {
  await invoke("set_key_capture", { active });
};
export const setActivatorCapture = async (active: boolean): Promise<void> => {
  await invoke("set_activator_capture", { active });
};
export const setComboActivatorCapture = async (
  active: boolean,
): Promise<void> => {
  await invoke("set_combo_activator_capture", { active });
};
export const setComboTriggerCapture = async (
  active: boolean,
): Promise<void> => {
  await invoke("set_combo_trigger_capture", { active });
};
export const setUiModal = async (active: boolean): Promise<void> => {
  await invoke("set_ui_modal", { active });
};
export const setGestureCanvasDrawing = async (
  active: boolean,
): Promise<void> => {
  await invoke("set_gesture_canvas_drawing", { active });
};
export const clearGestureCanvasStroke = async (): Promise<void> => {
  await invoke("clear_gesture_canvas_stroke");
};
export const getAppIcon = async (path: string): Promise<string | null> => {
  return invoke<string | null>("get_app_icon", { path });
};
export const resetTccPermissions = async (): Promise<void> => {
  await invoke("reset_tcc_permissions");
};
export const autostartIsEnabled = async (): Promise<boolean> => {
  try {
    const mod = await import("@tauri-apps/plugin-autostart");
    return await mod.isEnabled();
  } catch {
    return false;
  }
};
export const autostartSet = async (on: boolean): Promise<boolean> => {
  const mod = await import("@tauri-apps/plugin-autostart");
  if (on) await mod.enable();
  else await mod.disable();
  return await mod.isEnabled();
};
