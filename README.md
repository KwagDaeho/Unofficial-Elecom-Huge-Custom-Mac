# Unofficial Elecom Huge Custom (Mac)

[![Download for macOS](https://img.shields.io/badge/Download-macOS%20DMG%20(v1.0.6)-0A7EA4?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/download/v1.0.6/Unofficial-Elecom-Huge-Custom-Mac-1.0.6-aarch64.dmg)
[![All releases](https://img.shields.io/badge/Releases-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)

**Language / 언어:** [한국어](#ko) · [English](#en)

> **Unofficial / 비공식.** Not ELECOM software · ELECOM 공식 소프트웨어가 아닙니다.  
> Not affiliated with ELECOM Co., Ltd. · ELECOM과 무관한 개인 제작물입니다.

---

<a id="ko"></a>

## 한국어

### 소개

macOS용 **ELECOM HUGE** 트랙볼 커스텀 리매퍼입니다.  
공식 Mouse Assistant 대신, 메뉴 바에 상주하는 작은 앱으로 동작합니다.

- macOS가 숨기는 **Fn1–3**까지 Raw HID로 인식
- 버튼 리맵, 포인터/스크롤 설정
- 메뉴 바 + 로그인 시 자동 실행

이 저장소의 소스 코드는 릴리즈 태그와 대응되므로, 설치 전에 코드를 확인할 수 있습니다.

### 요구 사항

- macOS 12+ (v1.0.6은 Apple Silicon / M1 이상)
- ELECOM HUGE 유선 (`M-HT1URBK`) 또는 무선 (`M-HT1DRBK`)
- 소스에서 빌드 시: Node 20+, Rust (stable)

### 다운로드 및 설치

1. 위 **Download macOS DMG** 또는 [Releases](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)에서 받습니다.
2. `.dmg`를 엽니다.
3. **Elecom Huge Custom**을 **Applications**로 드래그합니다.
4. DMG 창을 닫고(추출), **응용 프로그램**에서 앱을 엽니다.

현재 빌드는 Apple **공증(notarize)이 없습니다.**  
macOS Sequoia(15)+에서는 예전처럼 **우클릭 → 열기**로 Gatekeeper를 우회할 수 없습니다. Apple이 막았습니다.

### 처음 실행 — Gatekeeper

앱을 열면 「열지 않음」만 뜨고 **완료** / **휴지통으로 이동**만 있는 것이 정상입니다.

#### 방법 A — 터미널 (단계가 가장 짧음)

응용 프로그램에 넣은 뒤, 터미널에서 한 줄:

```bash
xattr -cr "/Applications/Elecom Huge Custom.app" && open "/Applications/Elecom Huge Custom.app"
```

다운로드 격리(quarantine) 표시를 지워 Gatekeeper 차단을 건너뜁니다.

#### 방법 B — 시스템 설정 (GUI)

1. 앱을 열어 본 뒤 **완료**를 누릅니다.
2. **시스템 설정 → 개인정보 보호 및 보안**으로 이동합니다.
3. 아래쪽에 차단 문구가 보이면 **확인 없이 열기** → 한 번 더 **열기**.

> 공증 없이는 「확인 없이 열기」를 앱이 대신 누를 수 없습니다.  
> 진짜로 이 마찰을 없애려면 Apple Developer 서명·공증이 필요합니다.

### 앱을 연 뒤 — 권한

정보 탭에서 **권한 요청** 한 번만 누르면 됩니다.  
(내부에서 이전 권한 기록을 지운 뒤 시스템 허용 요청을 띄웁니다.)

### 업데이트 후 권한이 안 먹을 때

ad-hoc 빌드는 버전마다 서명이 달라, 설정에는 켜져 있는데 앱만 권한을 요구할 수 있습니다.  
정보 탭 **권한 요청**을 다시 누르거나:

```bash
tccutil reset Accessibility com.kwagdaeho.elecom-huge
```

이후 허용 대화상자에서 다시 켠 뒤, 앱을 완전히 종료하고 재실행하세요.

### 개발

```bash
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri:dev
```

### 참고

- 창을 닫아도 메뉴 바에 남아 있는 동안 리맵이 유지됩니다.
- 본체 DPI 스위치와 앱 안 속도 설정은 별개입니다.
- Huge Plus (`M-HT1MRBK`)는 초기 지원 목록에 없습니다.
- Apple Developer 서명·공증이 되면 Gatekeeper 마찰이 줄어든 빌드를 올릴 수 있습니다.

### 라이선스

MIT — [LICENSE](./LICENSE) 참고.

---

<a id="en"></a>

## English

### About

Custom remapper for the **ELECOM HUGE** trackball on macOS.  
A small always-on menu bar app instead of the official Mouse Assistant.

- Raw HID so **Fn1–3** work (macOS hides them)
- Button remaps, pointer/scroll settings
- Menu bar + launch at login

Source in this repository matches the tagged release so you can audit before installing.

### Requirements

- macOS 12+ (v1.0.6 is Apple Silicon / M1+)
- ELECOM HUGE wired (`M-HT1URBK`) or wireless (`M-HT1DRBK`)
- Building from source: Node 20+, Rust (stable)

### Download & install

1. Click **Download macOS DMG** (or open [Releases](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)).
2. Open the `.dmg`.
3. Drag **Elecom Huge Custom** to **Applications**.
4. Eject the DMG, then open the app from Applications.

This build is **not notarized**. On **macOS Sequoia (15)+**, the old **right-click → Open** Gatekeeper bypass no longer works (Apple removed it).

### First open — Gatekeeper

Opening the app shows “will not open” with only **Done** / **Move to Trash**. That is expected.

#### Method A — Terminal (fewest steps)

After copying to Applications:

```bash
xattr -cr "/Applications/Elecom Huge Custom.app" && open "/Applications/Elecom Huge Custom.app"
```

This clears the download quarantine flag so Gatekeeper does not block the launch.

#### Method B — System Settings (GUI)

1. Try to open the app, then click **Done**.
2. Open **System Settings → Privacy & Security**.
3. Click **Open Anyway**, then confirm **Open** if asked again.

> Without Apple notarization, nothing can click **Open Anyway** for you.  
> Notarization is the only way to remove this friction entirely.

### After the app opens — permissions

On the Info tab, tap **Grant access** once.  
(It clears stale TCC rows, then shows the system allow prompt.)

### After an update — Settings ON but app still asks

Ad-hoc builds change code signature each release. Tap **Grant access** again, or:

```bash
tccutil reset Accessibility com.kwagdaeho.elecom-huge
```

Then allow the prompt, fully quit, and relaunch.

### Develop

```bash
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri:dev
```

### Notes

- Remaps apply while the app is running (close window → stays in menu bar).
- Hardware DPI switch is independent of in-app speed.
- Huge Plus (`M-HT1MRBK`) is not in the first device allow-list.
- Notarized builds (less Gatekeeper friction) may come later if Apple Developer signing is set up.

### License

MIT — see [LICENSE](./LICENSE).
