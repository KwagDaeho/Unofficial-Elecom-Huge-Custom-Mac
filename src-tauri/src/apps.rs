//! List installed macOS applications for the open-app picker.

use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    pub bundle_id: String,
    pub path: String,
}

pub fn list_installed_apps() -> Result<Vec<InstalledApp>, String> {
    let mut out: Vec<InstalledApp> = Vec::new();
    let mut seen = HashSet::<String>::new();

    let mut roots = vec![
        PathBuf::from("/Applications"),
        PathBuf::from("/System/Applications"),
    ];
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Applications"));
    }

    for root in roots {
        scan_apps_dir(&root, 0, &mut out, &mut seen);
    }

    out.sort_by(|a, b| {
        a.name
            .to_ascii_lowercase()
            .cmp(&b.name.to_ascii_lowercase())
            .then_with(|| a.bundle_id.cmp(&b.bundle_id))
    });
    Ok(out)
}

/// PNG data-URL for a `.app` bundle icon (64×64).
pub fn app_icon_data_url(app_path: &str) -> Option<String> {
    let path = PathBuf::from(app_path);
    if !path.is_dir() {
        return None;
    }
    let png = icon_png_bytes(&path)?;
    Some(format!("data:image/png;base64,{}", encode_base64(&png)))
}

fn scan_apps_dir(
    dir: &Path,
    depth: u8,
    out: &mut Vec<InstalledApp>,
    seen: &mut HashSet<String>,
) {
    // /Applications and one nested folder (e.g. Utilities) is enough.
    if depth > 1 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let is_app = path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("app"));
        if is_app {
            if let Some(app) = read_app_bundle(&path) {
                if seen.insert(app.bundle_id.clone()) {
                    out.push(app);
                }
            }
            continue;
        }
        if path.is_dir() {
            scan_apps_dir(&path, depth + 1, out, seen);
        }
    }
}

fn read_app_bundle(app_path: &Path) -> Option<InstalledApp> {
    let value = read_info_plist(app_path)?;
    let bundle_id = value
        .get("CFBundleIdentifier")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())?
        .to_string();
    let name = value
        .get("CFBundleDisplayName")
        .or_else(|| value.get("CFBundleName"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| {
            app_path
                .file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.to_string())
        })?;

    Some(InstalledApp {
        name,
        bundle_id,
        path: app_path.to_string_lossy().to_string(),
    })
}

fn read_info_plist(app_path: &Path) -> Option<serde_json::Value> {
    let plist = app_path.join("Contents/Info.plist");
    if !plist.is_file() {
        return None;
    }
    let output = Command::new("plutil")
        .args(["-convert", "json", "-o", "-", "--"])
        .arg(&plist)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    serde_json::from_slice(&output.stdout).ok()
}

fn icon_png_bytes(app_path: &Path) -> Option<Vec<u8>> {
    let icns = resolve_icns_path(app_path)?;
    sips_icns_to_png(&icns)
}

fn resolve_icns_path(app_path: &Path) -> Option<PathBuf> {
    let resources = app_path.join("Contents/Resources");
    if let Some(value) = read_info_plist(app_path) {
        if let Some(icon_key) = value
            .get("CFBundleIconFile")
            .or_else(|| value.get("CFBundleIconName"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
        {
            let mut path = resources.join(icon_key);
            if path.extension().is_none() {
                path.set_extension("icns");
            }
            if path.is_file() {
                return Some(path);
            }
        }
    }
    // Fallback: first .icns in Resources.
    let Ok(entries) = fs::read_dir(&resources) else {
        return None;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("icns"))
        {
            return Some(path);
        }
    }
    None
}

fn sips_icns_to_png(icns: &Path) -> Option<Vec<u8>> {
    let out = std::env::temp_dir().join(format!(
        "elecom-huge-icon-{}.png",
        simple_hash(&icns.to_string_lossy())
    ));
    let status = Command::new("sips")
        .args(["-z", "64", "64", "-s", "format", "png"])
        .arg(icns)
        .arg("--out")
        .arg(&out)
        .status()
        .ok()?;
    if !status.success() {
        return None;
    }
    let bytes = fs::read(&out).ok()?;
    let _ = fs::remove_file(&out);
    if bytes.is_empty() {
        None
    } else {
        Some(bytes)
    }
}

fn simple_hash(s: &str) -> u64 {
    let mut h = 0xcbf29ce484222325u64;
    for b in s.bytes() {
        h ^= u64::from(b);
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn encode_base64(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let a = chunk[0] as u32;
        let b = chunk.get(1).copied().unwrap_or(0) as u32;
        let c = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (a << 16) | (b << 8) | c;
        out.push(TABLE[((triple >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}
