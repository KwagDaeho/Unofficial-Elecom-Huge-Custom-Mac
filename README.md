# Unofficial Elecom Huge Custom (Mac)

[![Download for macOS](https://img.shields.io/badge/Download-macOS%20DMG%20(v1.0.0)-0A7EA4?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/download/v1.0.0/Unofficial-Elecom-Huge-Custom-Mac-1.0.0-aarch64.dmg)
[![All releases](https://img.shields.io/badge/Releases-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)

> **Unofficial.** This is not ELECOM software and is not affiliated with ELECOM Co., Ltd.  
> Individual project for personal use / community sharing.

Source code in this repository matches the tagged release so you can audit it before installing.

---

## Download & install (macOS)

**Apple Silicon (M1 / M2 / M3 / M4), macOS 12+.**

1. Click **Download macOS DMG** above (or open [Releases](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)).
2. Open the `.dmg` and drag **Elecom Huge Custom** into **Applications** (응용 프로그램).
3. Eject the disk image.

This build is **not notarized by Apple** yet, so the first launch is blocked on purpose by macOS. Follow one of the methods below.

### First open — when macOS says it “will not open” / 「열지 않음」

You may see a dialog like:

> “‘Elecom Huge Custom’을(를) 열지 않음”  
> Apple cannot verify … malware …

Buttons are often only **Move to Trash (휴지통으로 이동)** and **Done (완료)** — there is **no Open button** on that sheet. That is normal. Do **not** move it to Trash.

#### Method A (recommended on recent macOS: Sonoma / Sequoia)

1. Click **Done (완료)** (leave the app in Applications).
2. Open **System Settings (시스템 설정)** → **Privacy & Security (개인정보 보호 및 보안)**.
3. Scroll down. You should see a message that **Elecom Huge Custom** was blocked.
4. Click **Open Anyway (확인 없이 열기)**.
5. Confirm again with **Open (열기)** if asked.

#### Method B (Finder)

1. Open **Finder** → **Applications (응용 프로그램)**.
2. Find **Elecom Huge Custom**.
3. **Right‑click (or Control‑click)** the app → choose **Open (열기)**.  
   (Do not double‑click only — that often only shows the block dialog.)
4. In the next warning, click **Open (열기)**.

#### Method C (Terminal — if A/B still fail)

```bash
xattr -cr "/Applications/Elecom Huge Custom.app"
open "/Applications/Elecom Huge Custom.app"
```

### After the app opens — required permissions

The remapper needs macOS permissions to inject mouse/keyboard actions:

1. When prompted, allow **Accessibility (손쉬운 사용)**.
2. If asked, also allow **Input Monitoring (입력 모니터링)**.
3. You can review them later under  
   **System Settings → Privacy & Security → Accessibility**  
   (and **Input Monitoring**).

If remaps do nothing, open those panes and ensure **Elecom Huge Custom** is enabled, then quit and relaunch the app (menu bar icon).

---

## What this app does

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
- Notarized builds (no Gatekeeper friction) may come in a later release if Apple Developer signing is set up.

## License

MIT — see [LICENSE](./LICENSE).
