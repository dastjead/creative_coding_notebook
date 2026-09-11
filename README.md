# Fieldnote — Mobile Creative Coding Notebook

iPhone에서 짧은 크리에이티브 코드를 수집하고, 격리 실행하고, PNG와 함께 다시 찾는 개인용 PWA입니다. 앱은 Supabase 없이도 완전히 로컬에서 동작합니다.

## 현재 구현 범위

- GLSL/Shadertoy, p5.js WebGL, three.js WebGL 자동 제안과 수동 프로필 선택
- CodeMirror 작업본, 750ms 자동 저장, 실행별 revision, 마지막 성공본 복구
- 수정할 수 없는 원본과 출처 URL, 메모, 태그, 즐겨찾기, 복제, 전체 검색
- `sandbox="allow-scripts"` iframe 실행, nonce/run ID 검증, 하드 중지·초기화
- 첫 canvas PNG 캡처와 revision/렌더링 조건 기록
- IndexedDB 저장, 지속 저장 상태 표시, 프로젝트 ZIP 내보내기·가져오기
- 설치 가능한 오프라인 PWA
- 선택적 Supabase magic-link 인증, 영속 outbox, 낙관적 잠금, 충돌 보존, 분리된 미디어 큐

WebGPU/WGSL/TSL, 사이트 자동 추출, GIF·영상, OCR, 공유 확장, 네이티브 셸은 후속 범위입니다.

## 시작하기

Node.js 22 이상을 권장합니다.

```bash
npm install
npm run dev
```

같은 Wi-Fi의 iPhone에서 접속할 때는 개발 Mac의 LAN 주소와 Vite가 표시한 포트를 사용합니다. 카메라·PWA·서비스 워커 등 보안 컨텍스트 기능은 배포된 HTTPS 환경이나 로컬호스트에서 검증해야 합니다.

검증 명령:

```bash
npm run check
npm test
npm run build
npm run test:e2e
```

E2E는 먼저 production build를 만들고 production preview를 iPhone 크기의 Chromium과 WebKit으로 검사합니다. Playwright WebKit의 오프라인 reload 제한 때문에 서비스 워커 오프라인 재시작은 Chromium에서 자동 검증하고, 실제 Mobile Safari 항목은 [iOS 기기 검증 문서](docs/ios-device-validation.md)에 남겼습니다.

## 실행 구조와 안전 경계

호스트 React 앱과 실행기는 별도 문서입니다. 사용자 코드는 opaque-origin iframe에서만 실행되고 호스트의 IndexedDB, 인증 세션, 쿠키를 전달받지 않습니다. runner CSP는 외부 연결, form, object, base URL을 막고 이미지·미디어는 `blob:`과 `data:`만 허용합니다. p5.js `1.11.10`과 three.js `0.180.0`은 앱 번들에 고정되어 있습니다.

`중지`와 `초기화`는 실행 중인 iframe을 제거하고 새 nonce/run ID를 가진 iframe으로 교체합니다. 이 구조는 협조하지 않는 animation loop와 상태를 폐기하지만, iOS가 무한 루프 iframe을 별도 처리하는지는 반드시 실기기 게이트를 통과해야 합니다. 실패하면 임의 JavaScript 프로필을 배포하지 않고 WKWebView 셸을 앞당깁니다.

정적 호스팅 환경은 [`public/_headers`](public/_headers)의 runner CSP와 asset CORS에 해당하는 헤더를 제공해야 합니다. 해당 파일 형식을 지원하지 않는 호스트에서는 같은 규칙을 호스트 설정으로 옮겨야 opaque-origin runner가 모듈 번들을 읽을 수 있습니다.

편집기에서 가져온 로컬 파일은 runner 안에서 읽기 전용 `ASSETS['파일명']` Blob URL로 제공됩니다. 외부 URL은 계속 차단되므로 three.js texture 등은 이 값을 사용해야 합니다.

## 데이터와 복구

로컬 데이터는 두 IndexedDB 데이터베이스에 저장됩니다.

- `creative-coding-notebook`: 프로젝트, 불변 원본, revisions, assets, PNG captures
- `creative-coding-notebook-sync`: 클라우드 전송 outbox와 충돌/재시도 상태

브라우저 저장소는 운영체제가 정리할 수 있으므로 System 화면의 지속 저장 상태를 확인하고 중요한 프로젝트는 ZIP으로 내보내세요. ZIP에는 `manifest.json`, `source/original.txt`, `source/current.txt`, revision 텍스트, assets, captures가 들어갑니다. 가져오기 시 모든 ID를 새로 매핑하므로 기존 프로젝트와 충돌하지 않습니다.

## 선택적 Supabase 동기화

1. `.env.example`을 `.env.local`로 복사합니다.
2. 프로젝트 URL과 **publishable key**만 설정합니다. secret/service key는 브라우저에 넣지 않습니다.
3. Supabase CLI로 [`supabase/migrations/202609120001_notebook_sync.sql`](supabase/migrations/202609120001_notebook_sync.sql)을 적용합니다.
4. pgTAP 환경에서 [`supabase/tests/notebook_rls.test.sql`](supabase/tests/notebook_rls.test.sql)을 실행합니다.

환경 변수가 하나라도 없으면 동기화 어댑터는 비활성 구현이 되며 네트워크 요청도 outbox 기록도 만들지 않습니다. 설정된 경우 로컬 commit 후 outbox에 먼저 기록하고 백그라운드 전송합니다. metadata와 media는 서로 다른 큐로 처리되어 이미지 업로드 실패가 텍스트 저장을 막지 않습니다. 서버 revision이 달라지면 로컬 payload와 원격 payload를 `conflict` 상태로 함께 보존합니다.

Supabase SQL은 아직 특정 원격 프로젝트에 적용되지 않았습니다. 적용 후 RLS 테스트가 다른 사용자와 비인증 접근을 거부하는지 확인해야 동기화 단계를 완료로 판정할 수 있습니다.

## 코드 지도

- [`src/domain`](src/domain): 불변 원본, project/revision 타입, 검색과 프로필 판별
- [`src/storage`](src/storage): Dexie repository와 ZIP 왕복
- [`src/runtime`](src/runtime), [`src/runner`](src/runner): 메시지 계약, wrapper, iframe 수명주기
- [`src/components`](src/components): 수집함, 라이브러리, 편집기/미리보기, 설정
- [`src/sync`](src/sync): 비활성/Supabase adapter, 영속 outbox, repository observer
- [`tests/fixtures`](tests/fixtures): 정상·오류·무한 루프·context loss·누락 asset 기기 검증 샘플
- [`docs/development-history.md`](docs/development-history.md): 기획부터 현재 기준선까지의 결정, 구현, 문제 해결과 검증 기록
- [`docs/project-master-plan.md`](docs/project-master-plan.md): 실제 iPhone 검증부터 동기화·WebGPU·조건부 네이티브 셸까지의 전체 실행 계획
- [`docs/superpowers/specs/2026-09-12-mobile-creative-coding-notebook-design.md`](docs/superpowers/specs/2026-09-12-mobile-creative-coding-notebook-design.md): 설계 계약

## 확인된 것과 남은 게이트

TypeScript, 35개 단위·컴포넌트 테스트, production build, Chromium/WebKit 모바일 E2E로 로컬 수직 슬라이스와 세 프로필을 확인합니다. 실제 iOS 26 iPhone의 무한 루프 복구, WebGL context loss, 메모리 압박, 홈 화면 PWA 오프라인 재시작은 이 저장소만으로 실행할 수 없어 [체크리스트](docs/ios-device-validation.md)에 `PENDING`으로 남겨 둡니다.
