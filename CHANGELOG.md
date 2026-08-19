# Changelog

All notable changes to this project are documented here.

## [1.2.1] — 2026-08-19

### Added

- **Macro editor** — drag-to-reorder steps with pointer-based sorting; popup prompts for adding/editing keys and delays; edit button per step; overlay scrollbar on the step list.

### Fixed

- **Custom mapping chords** — modifier + HUGE button combos no longer leak OS default clicks; chord keystrokes are isolated so Spotlight and foreground apps are not polluted.

### Changed

- **Contact SSOT** — email, Kakao, and GitHub links centralized in `src/meta/app.json`; footer order Email → Kakao → GitHub; README EN section first.
- **Frontend structure** — types, domain, and mapping UI reorganized with barrel exports; hooks/providers replace legacy context; `export const` style codemod.
- **Rust structure** — domain profile/custom_mapping/engine, platform capture, and ball-scroll runtime split into focused modules (same layout philosophy as the FE refactor).
- **UI** — overlay scrollbar idle fade; disabled long-press select styling.

## [1.2.0]

See [release v1.2.0](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/tag/v1.2.0).
