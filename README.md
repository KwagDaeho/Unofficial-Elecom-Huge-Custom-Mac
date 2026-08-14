# Unofficial Elecom Huge Custom (Mac)

[![Download for macOS](https://img.shields.io/badge/Download-macOS%20DMG%20(v1.0.0)-0A7EA4?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/download/v1.0.0/Unofficial-Elecom-Huge-Custom-Mac-1.0.0-aarch64.dmg)
[![All releases](https://img.shields.io/badge/Releases-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)

> **Unofficial.** This is not ELECOM software and is not affiliated with ELECOM Co., Ltd.  
> Individual project for personal use / community sharing.

**Apple Silicon (M1/M2/M3/M4) macOS 12+.**  
First launch may be blocked by Gatekeeper: right‑click the app → **Open**, or allow it in **System Settings → Privacy & Security**. Then grant **Accessibility** (and Input Monitoring if asked).

Source code in this repository matches the tagged release so you can audit it before installing.

---

Custom remapper for the **ELECOM HUGE** trackball on macOS.

Replaces the official Mouse Assistant with a small always-on app:

- Raw HID readout so **Fn1–3** work on macOS (OS hides them)
- Button remaps, pointer/scroll settings (software)
- Menu bar + launch at login

## Requirements

- macOS 12+ (Apple Silicon build for v1.0.0)
- ELECOM HUGE wired (`M-HT1URBK`) or wireless (`M-HT1DRBK`)
- For building from source: Node 20+, Rust (stable)

## Develop

```bash
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri:dev
```

Grant **Accessibility** (and Input Monitoring if prompted) — needed to inject remapped actions.

## Notes

- Remaps apply while the app is running (close window → stays in menu bar).
- Hardware DPI switch on the device is independent of in-app speed.
- Huge Plus (`M-HT1MRBK`) is not in the first device allow-list.

## License

MIT — see [LICENSE](./LICENSE).
