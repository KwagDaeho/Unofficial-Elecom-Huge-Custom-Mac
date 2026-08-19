# Unofficial Elecom Huge Custom (Mac)

> **Unofficial / 비공식.** Not ELECOM software · ELECOM 공식 소프트웨어가 아닙니다.  
> Not affiliated with ELECOM Co., Ltd. · ELECOM과 무관한 개인 제작물입니다.

[![Download for macOS](https://img.shields.io/badge/Download-macOS%20DMG%20(v1.1.1)-0A7EA4?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/download/v1.1.1/Unofficial-Elecom-Huge-Custom-Mac-1.1.1-aarch64.dmg)
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

### 요구 사항

- macOS 12+ (Monterey 이상)
- ELECOM HUGE 유선 (`M-HT1URBK`) 또는 무선 동글 (`M-HT1DRBK`)
- GitHub DMG (v1.1.1): Apple Silicon (M1 이상)
- 소스 빌드: Node 20+, Rust (stable)

### 지원 범위 (v1.1.1)

| | v1.1.1 DMG | 소스 빌드 |
|---|---|---|
| Apple Silicon, macOS 12+ | ✓ | ✓ |
| Intel Mac, macOS 12+ | — | ✓ |
| macOS 11 이하 | — | — |
| HUGE Plus, Bluetooth HUGE | — | — |

- **12–14:** 미공증 앱은 우클릭 → 열기로 실행 가능한 경우가 많음
- **15 Sequoia 이상:** **시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기**
- **손쉬운 사용** 필수 · 15+에서는 **입력 모니터링**도 필요할 수 있음

**개발·테스트 환경 (v1.1.1)**  
macOS 26.5.2 (25F84) · M3 Pro · arm64

### 앱 실행

1. [macOS DMG](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest/download/Unofficial-Elecom-Huge-Custom-Mac-1.1.1-aarch64.dmg)를 다운로드합니다.
2. DMG를 열고 **Elecom Huge Custom**을 **Applications(응용 프로그램)**으로 드래그합니다.
3. 마운트된 디스크 아이콘을 **추출**합니다.
4. **응용 프로그램**에서 앱을 엽니다.
5. 「열지 않음」 경고가 뜨면 **완료**를 누릅니다.
6. **시스템 설정 → 개인정보 보호 및 보안**에서 **그래도 열기**를 누릅니다.

> 현재 빌드는 Apple **공증(notarize)이 없습니다.**

#### 소스에서 빌드

[Xcode Command Line Tools](https://developer.apple.com/download/all/?q=command%20line%20tools), [Node 20+](https://nodejs.org/), [Rust](https://rustup.rs/)가 필요합니다.

```bash
git clone https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac.git
cd Unofficial-Elecom-Huge-Custom-Mac
git checkout v1.1.1

export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri:build
```

빌드 결과: `src-tauri/target/release/bundle/macos/Elecom Huge Custom.app`

```bash
cp -R "src-tauri/target/release/bundle/macos/Elecom Huge Custom.app" /Applications/
open "/Applications/Elecom Huge Custom.app"
```

Intel Mac:

```bash
rustup target add x86_64-apple-darwin
npx tauri build --target x86_64-apple-darwin
```

#### 대안 (터미널)

```bash
xattr -cr "/Applications/Elecom Huge Custom.app" && open "/Applications/Elecom Huge Custom.app"
```

### 앱 설정 (권한)

**정보** 탭에서:

1. **«권한 요청»** 클릭
2. **Elecom Huge Custom** 허용
3. 허용 후 앱이 **자동 재시작**

### 업데이트 후 권한이 안 먹을 때

**권한 요청**을 다시 진행하거나:

```bash
tccutil reset Accessibility com.kwagdaeho.elecom-huge
```

### 개발

```bash
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri:dev
```

### 참고

- 창을 닫아도 메뉴 바에 남아 있는 동안 리맵이 유지됩니다.
- 본체 DPI 스위치와 앱 안 속도 설정은 별개입니다.
- Huge Plus (`M-HT1MRBK`)는 지원하지 않습니다.

### 라이선스

MIT — [LICENSE](./LICENSE)

---

<a id="en"></a>

## English

### About

Custom remapper for the **ELECOM HUGE** trackball on macOS.  
A small always-on menu bar app instead of the official Mouse Assistant.

- Raw HID so **Fn1–3** work (macOS hides them)
- Button remaps, pointer/scroll settings
- Menu bar + launch at login

### Requirements

- macOS 12+ (Monterey or later)
- ELECOM HUGE wired (`M-HT1URBK`) or wireless dongle (`M-HT1DRBK`)
- GitHub DMG (v1.1.1): Apple Silicon (M1+)
- Building from source: Node 20+, Rust (stable)

### Coverage (v1.1.1)

| | v1.1.1 DMG | From source |
|---|---|---|
| Apple Silicon, macOS 12+ | ✓ | ✓ |
| Intel Mac, macOS 12+ | — | ✓ |
| macOS 11 and older | — | — |
| HUGE Plus, Bluetooth HUGE | — | — |

- **12–14:** unsigned apps can often be opened via right-click → Open
- **15 Sequoia+:** **System Settings → Privacy & Security → Open Anyway**
- **Accessibility** required · **15+** may also need **Input Monitoring**

**Development / test environment (v1.1.1)**  
macOS 26.5.2 (25F84) · M3 Pro · arm64

### Run the app

1. Download the [macOS DMG](https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac/releases/latest/download/Unofficial-Elecom-Huge-Custom-Mac-1.1.1-aarch64.dmg).
2. Open the DMG and drag **Elecom Huge Custom** to **Applications**.
3. **Eject** the mounted disk.
4. Open the app from **Applications**.
5. If you see “will not open”, click **Done**.
6. In **System Settings → Privacy & Security**, click **Open Anyway**.

> This build is **not notarized**.

#### Build from source

You need [Xcode Command Line Tools](https://developer.apple.com/download/all/?q=command%20line%20tools), [Node 20+](https://nodejs.org/), and [Rust](https://rustup.rs/).

```bash
git clone https://github.com/KwagDaeho/Unofficial-Elecom-Huge-Custom-Mac.git
cd Unofficial-Elecom-Huge-Custom-Mac
git checkout v1.1.1

export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri:build
```

Output: `src-tauri/target/release/bundle/macos/Elecom Huge Custom.app`

```bash
cp -R "src-tauri/target/release/bundle/macos/Elecom Huge Custom.app" /Applications/
open "/Applications/Elecom Huge Custom.app"
```

Intel Mac:

```bash
rustup target add x86_64-apple-darwin
npx tauri build --target x86_64-apple-darwin
```

#### Alternative (Terminal)

```bash
xattr -cr "/Applications/Elecom Huge Custom.app" && open "/Applications/Elecom Huge Custom.app"
```

### App setup (permissions)

On the **Info** tab:

1. Click **«Grant access»**
2. Allow **Elecom Huge Custom**
3. The app **restarts automatically** when permission is granted

### After an update — permission not working

Tap **Grant access** again, or:

```bash
tccutil reset Accessibility com.kwagdaeho.elecom-huge
```

### Develop

```bash
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri:dev
```

### Notes

- Remaps apply while the app is running (close window → stays in menu bar).
- Hardware DPI switch is independent of in-app speed.
- Huge Plus (`M-HT1MRBK`) is not supported.

### License

MIT — see [LICENSE](./LICENSE).
