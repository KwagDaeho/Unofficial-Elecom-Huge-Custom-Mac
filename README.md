# Unofficial Elecom Huge Custom (Mac)

> **Unofficial / 비공식.** Not ELECOM software · ELECOM 공식 소프트웨어가 아닙니다.  
> Not affiliated with ELECOM Co., Ltd. · ELECOM과 무관한 개인 제작물입니다.

[![Download for macOS](https://img.shields.io/badge/Download-macOS%20DMG%20(v1.1.0)-0A7EA4?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/download/v1.1.0/Unofficial-Elecom-Huge-Custom-Mac-1.1.0-aarch64.dmg)
[![All releases](https://img.shields.io/badge/Releases-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest)

**Contact**  
Email: [1438eogh@gmail.com](mailto:1438eogh@gmail.com)  
Kakao: [open.kakao.com/me/Theo_Kwag](https://open.kakao.com/me/Theo_Kwag)

<br />

---

<br />

**Supported languages / 지원 언어:** Korean (한국어) · English

**Jump to docs / 문서 바로가기:** [한국어](#ko) · [English](#en)

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

- macOS 12+ (v1.1.0은 Apple Silicon / M1 이상)
- ELECOM HUGE 유선 (`M-HT1URBK`) 또는 무선 (`M-HT1DRBK`)
- 소스에서 빌드 시: Node 20+, Rust (stable)

### 앱 실행

1. [macOS DMG](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest/download/Unofficial-Elecom-Huge-Custom-Mac-1.1.0-aarch64.dmg)를 다운로드합니다.
2. `Unofficial-Elecom-Huge-Custom-Mac-x.x.x-aarch64.dmg`를 엽니다.
3. **Elecom Huge Custom**을 **Applications(응용 프로그램)**으로 드래그합니다.
4. 데스크톱(또는 Finder 사이드바)에 나타난 마운트된 **Elecom Huge Custom** 디스크 아이콘을 우클릭하고 **추출**합니다.
5. **응용 프로그램**에서 앱을 엽니다.
6. 「열지 않음」 경고가 뜨면 **완료**를 누릅니다. (정상입니다. 휴지통으로 보내지 마세요.)
7. **시스템 설정 → 개인정보 보호 및 보안**으로 이동합니다.
8. 아래쪽 차단 안내에서 **그래도 열기**를 누릅니다. 이어지는 확인 팝업에서도 **그래도 열기**를 누른 뒤, 암호 또는 Touch ID로 승인합니다.

> 현재 빌드는 Apple **공증(notarize)이 없습니다.**  
> macOS Sequoia(15)+에서는 우클릭 → 열기로 Gatekeeper를 우회할 수 없습니다.

#### 대안 (터미널)

응용 프로그램에 넣은 뒤:

```bash
xattr -cr "/Applications/Elecom Huge Custom.app" && open "/Applications/Elecom Huge Custom.app"
```

### 앱 설정 (권한)

앱이 열린 뒤 **정보** 탭에서:

1. **«권한 요청»**을 클릭합니다.
2. 시스템 대화상자 또는 손쉬운 사용 설정에서 **Elecom Huge Custom**을 허용합니다.
3. 권한이 허용되면 앱이 **자동으로 재시작**됩니다.

### 업데이트 후 권한이 안 먹을 때

ad-hoc 빌드는 버전마다 서명이 달라, 설정에는 켜져 있는데 앱만 권한을 요구할 수 있습니다.  
정보 탭에서 **권한 요청**을 다시 진행하거나:

```bash
tccutil reset Accessibility com.kwagdaeho.elecom-huge
```

허용 후 앱이 자동 재시작됩니다.

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

- macOS 12+ (v1.1.0 is Apple Silicon / M1+)
- ELECOM HUGE wired (`M-HT1URBK`) or wireless (`M-HT1DRBK`)
- Building from source: Node 20+, Rust (stable)

### Run the app

1. Download the [macOS DMG](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest/download/Unofficial-Elecom-Huge-Custom-Mac-1.1.0-aarch64.dmg).
2. Open `Unofficial-Elecom-Huge-Custom-Mac-x.x.x-aarch64.dmg`.
3. Drag **Elecom Huge Custom** to **Applications**.
4. On the Desktop (or Finder sidebar), right-click the mounted **Elecom Huge Custom** disk icon and choose **Eject**.
5. Open the app from **Applications**.
6. If you see “will not open”, click **Done**. (Expected — do not move it to Trash.)
7. Open **System Settings → Privacy & Security**.
8. Under the block notice, click **Open Anyway**. In the confirmation sheet, click **Open Anyway** again, then authenticate with password or Touch ID.

> This build is **not notarized**. On macOS Sequoia (15)+, right-click → Open no longer bypasses Gatekeeper.

#### Alternative (Terminal)

After copying to Applications:

```bash
xattr -cr "/Applications/Elecom Huge Custom.app" && open "/Applications/Elecom Huge Custom.app"
```

### App setup (permissions)

In the running app, on the **Info** tab:

1. Click **«Grant access»**.
2. Allow **Elecom Huge Custom** in the system prompt or Accessibility settings.
3. When permission is granted, the app **restarts automatically**.

### After an update — Settings ON but app still asks

Ad-hoc builds change code signature each release. Tap **Grant access** again, or:

```bash
tccutil reset Accessibility com.kwagdaeho.elecom-huge
```

Allow again — the app restarts automatically.

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
