//! macOS TCC / Accessibility permission helpers.

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub accessibility: bool,
    pub input_monitoring: bool,
    pub post_event: bool,
    pub ready: bool,
}

#[cfg(target_os = "macos")]
mod macos {
    use super::PermissionStatus;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPreflightListenEventAccess() -> bool;
        fn CGRequestListenEventAccess() -> bool;
        fn CGPreflightPostEventAccess() -> bool;
        #[allow(dead_code)]
        fn CGRequestPostEventAccess() -> bool;
    }

    pub fn permission_status() -> PermissionStatus {
        let accessibility = macos_accessibility_client::accessibility::application_is_trusted();
        let input_monitoring = unsafe { CGPreflightListenEventAccess() };
        let post_event = unsafe { CGPreflightPostEventAccess() };
        let ready = accessibility || post_event;
        PermissionStatus {
            accessibility,
            input_monitoring,
            post_event,
            ready,
        }
    }

    pub fn accessibility_granted() -> bool {
        permission_status().ready
    }

    pub fn prompt_accessibility() -> bool {
        // One system alert at a time. Accessibility prompt is the primary gate;
        // Input Monitoring is requested only if Accessibility already looks OK.
        let trusted =
            macos_accessibility_client::accessibility::application_is_trusted_with_prompt();
        if trusted {
            let _ = unsafe { CGRequestListenEventAccess() };
        }
        permission_status().ready
    }

    pub fn open_permission_settings() -> Result<(), String> {
        // Open Accessibility only — opening ListenEvent in the same click stacks panes.
        tauri_plugin_opener::open_url(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            None::<&str>,
        )
        .map_err(|e| e.to_string())
    }

    /// Privacy & Security root (where Gatekeeper “Open Anyway” appears after a block).
    pub fn open_privacy_security_settings() -> Result<(), String> {
        let urls = [
            "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension",
            "x-apple.systempreferences:com.apple.preference.security",
        ];
        for url in urls {
            if tauri_plugin_opener::open_url(url, None::<&str>).is_ok() {
                return Ok(());
            }
        }
        // Last resort: Security pref pane path
        std::process::Command::new("open")
            .arg("/System/Library/PreferencePanes/Security.prefPane")
            .status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Clear stale TCC rows for this bundle (common after ad-hoc update reinstall).
    /// Settings can still show the toggle ON while AXIsProcessTrusted is false.
    pub fn reset_tcc_permissions() -> Result<(), String> {
        for service in ["Accessibility", "ListenEvent", "PostEvent"] {
            let status = std::process::Command::new("/usr/bin/tccutil")
                .args(["reset", service, crate::constants::BUNDLE_ID])
                .status()
                .map_err(|e| e.to_string())?;
            if !status.success() {
                log::warn!("tccutil reset {service} exited with {status}");
            }
        }
        Ok(())
    }
}

#[cfg(not(target_os = "macos"))]
mod stub {
    use super::PermissionStatus;

    pub fn permission_status() -> PermissionStatus {
        PermissionStatus {
            accessibility: true,
            input_monitoring: true,
            post_event: true,
            ready: true,
        }
    }

    pub fn accessibility_granted() -> bool {
        true
    }

    pub fn prompt_accessibility() -> bool {
        true
    }

    pub fn open_permission_settings() -> Result<(), String> {
        Ok(())
    }

    pub fn open_privacy_security_settings() -> Result<(), String> {
        Ok(())
    }

    pub fn reset_tcc_permissions() -> Result<(), String> {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
pub use macos::*;
#[cfg(not(target_os = "macos"))]
pub use stub::*;
