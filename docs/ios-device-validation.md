# iOS 26+ 실제 기기 가능성 게이트

이 문서는 릴리스 전 차단 게이트입니다. 사용자가 iOS 실제 기기에서 PWA의 기본 실행 성공을 확인했지만, 아래 세부 항목이 확인되기 전에는 전체 복구 게이트를 통과한 것으로 간주하지 않습니다.

## 준비

- iOS 26+ 실제 iPhone과 Safari 최신 패치 버전 기록
- 동일 네트워크의 HTTPS staging build 또는 Mac에서 제공하는 신뢰 가능한 HTTPS URL
- 홈 화면에 Fieldnote 설치
- Mac Safari 개발자 도구에서 iPhone Web Inspector 연결
- 필요 시 iPhone의 WebDriver 허용 후 연결된 Mac에서 Safari WebDriver 실행
- 테스트 전 프로젝트 ZIP 내보내기와 기기 저장 공간 기록

현재 staging: <https://dastjead.github.io/creative_coding_notebook/>

## 자동 staging smoke test

2026년 9월 12일, 커밋 `88104d3`의 GitHub Pages 배포에서 다음 항목을 확인했다.

- HTTPS app shell, manifest, service worker 응답
- `/creative_coding_notebook/` PWA scope와 start URL
- runner HTML과 JavaScript asset의 CORS 응답
- 원격 Chromium/WebKit에서 service worker 준비와 GLSL canvas 실행

이 결과는 실제 Mobile Safari와 홈 화면 PWA 검증을 대체하지 않는다.

## 사용자 확인 상태

2026년 9월 12일, 사용자가 iOS 실제 기기에서 PWA가 성공적으로 동작한다고 확인했다. 확인된 범위는 기본 실행 smoke로 기록한다. 홈 화면 설치 상태, 기기 모델, iOS/Safari build와 아래 profile·복구·오프라인 세부 항목은 별도 결과가 제공되기 전까지 `PENDING`을 유지한다.

## 프로필 행렬

각 프로필에서 정상 fixture, 문법/컴파일 오류, 런타임 오류를 실행합니다. fixture는 `tests/fixtures` 아래에 있습니다.

| 항목 | Safari 탭 | 홈 화면 PWA | 결과 |
|---|---:|---:|---|
| GLSL 정상 렌더·PNG 캡처 | 미실행 | 미실행 | PENDING |
| GLSL 컴파일 오류와 사용자 줄 번호 | 미실행 | 미실행 | PENDING |
| twigl geekest 본문 렌더·PNG 캡처 | 미실행 | 미실행 | PENDING |
| p5.js 정상 렌더·PNG 캡처 | 미실행 | 미실행 | PENDING |
| p5.js 런타임 오류 후 원본/작업본 유지 | 미실행 | 미실행 | PENDING |
| three.js 정상 렌더·PNG 캡처 | 미실행 | 미실행 | PENDING |
| three.js 런타임 오류 후 재실행 | 미실행 | 미실행 | PENDING |
| 외부 texture URL 차단·asset 오류 분류 | 미실행 | 미실행 | PENDING |

## 복구 게이트

1. `p5/infinite-loop.js`를 열기 전에 자동 저장 상태가 `저장됨`인지 확인합니다.
2. 실행 직후 host UI의 중지 버튼이 반응하는지 확인합니다.
3. 중지 시계를 재어 **2초 안에 기존 iframe이 제거되고 새 iframe이 READY**가 되는지 Web Inspector에서 확인합니다.
4. 원본, 현재 작업본, 직전 성공 revision이 모두 남아 있는지 확인합니다.
5. `three/context-loss.js` 실행 후 초기화하고 정상 three.js fixture가 다시 렌더되는지 확인합니다.
6. 여러 큰 캡처/asset과 다른 앱을 함께 사용해 메모리 압박을 유도한 뒤 PWA 재진입·복원을 확인합니다.

판정:

- 모든 복구 단계 통과: PWA 임의 JavaScript 실행을 계속 진행합니다.
- host UI가 멈추거나 2초 내 iframe 교체 실패: p5.js/three.js 출시를 차단하고 SwiftUI + WKWebView 셸과 별도 WebView 프로세스 복구를 우선합니다. GLSL 전용 PWA 축소안은 별도 판단합니다.

## 저장·오프라인·왕복

- System 화면에서 persistent storage 결과를 기록합니다.
- 비행기 모드에서 홈 화면 PWA를 완전히 종료했다가 재실행합니다.
- 기존 프로젝트 검색, 편집, 자동 저장, 실행, 캡처가 네트워크 없이 되는지 확인합니다.
- 앱을 다시 종료·실행해 변경 내용과 캡처가 복원되는지 확인합니다.
- 프로젝트 ZIP을 Files로 내보내고 로컬 데이터를 비운 별도 테스트 설치에 가져옵니다.
- 원본, 모든 revision, 캡처 관계, 출처 URL, 태그가 식별 가능한지 확인합니다.

## 보안 확인

- runner에서 `fetch('https://example.com')`가 CSP로 거부되는지 확인합니다.
- popup, form submit, `top.location` navigation이 성공하지 않는지 확인합니다.
- runner frame의 IndexedDB/cookie가 호스트 앱 데이터나 인증 세션을 볼 수 없는지 확인합니다.
- nonce/run ID가 틀린 `postMessage`와 이전 iframe의 지연 event가 host 상태를 바꾸지 않는지 확인합니다.

## 실행 기록

| 필드 | 값 |
|---|---|
| 날짜/담당자 | PENDING |
| iPhone 모델 | PENDING |
| iOS/Safari build | PENDING |
| staging commit | `88104d3` |
| 세 프로필 | PENDING |
| 2초 hard-stop | PENDING |
| context loss | PENDING |
| memory pressure | PENDING |
| offline/PWA | PENDING |
| ZIP round-trip | PENDING |
| 최종 판정 | BLOCKED UNTIL DEVICE RUN |
