# Unofficial Elecom Huge Custom (Mac)

> **Unofficial.** This is not ELECOM software and is not affiliated with ELECOM Co., Ltd.  
> Individual project for personal use / community sharing.

Custom remapper for the **ELECOM HUGE** trackball on macOS.

Replaces the official Mouse Assistant with a small always-on app:

- Raw HID readout so **Fn1–3** work on macOS (OS hides them)
- Button remaps, pointer/scroll settings (software)
- Menu bar + launch at login

## Requirements

- macOS 12+
- Node 20+
- Rust (stable)
- ELECOM HUGE wired (`M-HT1URBK`) or wireless (`M-HT1DRBK`)

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
