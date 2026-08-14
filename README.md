# Unofficial Elecom Huge Custom (Mac)

[![Download for macOS](https://img.shields.io/badge/Download-macOS%20DMG%20(v1.0.0)-0A7EA4?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/download/v1.0.0/Unofficial-Elecom-Huge-Custom-Mac-1.0.0-aarch64.dmg)
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

- macOS 12+ (v1.0.0은 Apple Silicon / M1 이상)
- ELECOM HUGE 유선 (`M-HT1URBK`) 또는 무선 (`M-HT1DRBK`)
- 소스에서 빌드 시: Node 20+, Rust (stable)

### 다운로드 및 설치

1. 위 **Download macOS DMG** 버튼을 누르거나 [Releases](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)에서 받습니다.
2. `.dmg`를 열고 **Elecom Huge Custom**을 **응용 프로그램**으로 드래그합니다.
3. 디스크 이미지를 꺼냅니다.

현재 빌드는 Apple **공증(notarize)이 되어 있지 않아**, 처음 실행 시 macOS가 의도적으로 막을 수 있습니다. 아래 방법 중 하나를 따르세요.

### 처음 실행 — 「열지 않음」이 나올 때

다음과 비슷한 창이 뜰 수 있습니다.

> “‘Elecom Huge Custom’을(를) 열지 않음”  
> Apple이 … 악성 코드가 없음을 확인할 수 없습니다.

버튼이 **휴지통으로 이동** / **완료**만 있고 **열기**가 없는 경우가 많습니다. 정상입니다. 휴지통으로 보내지 마세요.

#### 방법 A (권장 · Sonoma / Sequoia)

1. **완료**를 누릅니다 (앱은 응용 프로그램에 그대로 둡니다).
2. **시스템 설정** → **개인정보 보호 및 보안**을 엽니다.
3. 아래로 스크롤하면 **Elecom Huge Custom**이 차단되었다는 문구가 보입니다.
4. **확인 없이 열기**를 누릅니다.
5. 한 번 더 물으면 **열기**를 누릅니다.

#### 방법 B (Finder)

1. **Finder** → **응용 프로그램**을 엽니다.
2. **Elecom Huge Custom**을 찾습니다.
3. 앱을 **우클릭(또는 Control-클릭)** → **열기**를 선택합니다.  
   (더블클릭만 하면 차단 창만 반복될 수 있습니다.)
4. 이어지는 경고에서 **열기**를 누릅니다.

#### 방법 C (터미널 · A/B가 안 될 때)

```bash
xattr -cr "/Applications/Elecom Huge Custom.app"
open "/Applications/Elecom Huge Custom.app"
```

### 앱을 연 뒤 — 필요한 권한

리맵을 넣으려면 macOS 권한이 필요합니다.

1. 요청이 뜨면 **손쉬운 사용**을 허용합니다.
2. 필요하면 **입력 모니터링**도 허용합니다.
3. 나중에 확인: **시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용**  
   (및 **입력 모니터링**)

리맵이 안 되면 위 목록에서 **Elecom Huge Custom**이 켜져 있는지 확인한 뒤, 메뉴 바 아이콘에서 앱을 종료하고 다시 실행하세요.

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

- macOS 12+ (v1.0.0 is Apple Silicon / M1+)
- ELECOM HUGE wired (`M-HT1URBK`) or wireless (`M-HT1DRBK`)
- Building from source: Node 20+, Rust (stable)

### Download & install

1. Click **Download macOS DMG** above (or open [Releases](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)).
2. Open the `.dmg` and drag **Elecom Huge Custom** into **Applications**.
3. Eject the disk image.

This build is **not notarized by Apple** yet, so the first launch may be blocked. Use one of the methods below.

### First open — when macOS says it “will not open”

You may see a dialog like:

> “Elecom Huge Custom” cannot be opened  
> Apple could not verify … free of malware …

Buttons are often only **Move to Trash** and **Done** — **no Open** on that sheet. That is normal. Do **not** move it to Trash.

#### Method A (recommended on Sonoma / Sequoia)

1. Click **Done** (leave the app in Applications).
2. Open **System Settings** → **Privacy & Security**.
3. Scroll down. You should see that **Elecom Huge Custom** was blocked.
4. Click **Open Anyway**.
5. Confirm with **Open** if asked again.

#### Method B (Finder)

1. Open **Finder** → **Applications**.
2. Find **Elecom Huge Custom**.
3. **Right-click (or Control-click)** → **Open**.  
   (Double-click alone often only shows the block dialog.)
4. In the next warning, click **Open**.

#### Method C (Terminal — if A/B still fail)

```bash
xattr -cr "/Applications/Elecom Huge Custom.app"
open "/Applications/Elecom Huge Custom.app"
```

### After the app opens — required permissions

The remapper needs macOS permissions to inject mouse/keyboard actions:

1. When prompted, allow **Accessibility**.
2. If asked, also allow **Input Monitoring**.
3. Review later under **System Settings → Privacy & Security → Accessibility**  
   (and **Input Monitoring**).

If remaps do nothing, ensure **Elecom Huge Custom** is enabled there, then quit and relaunch from the menu bar icon.

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
