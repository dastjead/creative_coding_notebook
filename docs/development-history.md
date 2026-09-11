# 모바일 크리에이티브 코딩 노트북 개발 경과

작성 기준일: 2026년 9월 12일  
기준 브랜치: `main`  
기준 구현 커밋: `88104d3`

## 문서 목적

이 문서는 모바일 크리에이티브 코딩 노트북이 기획 문서에서 현재 구현 상태에 이르기까지 어떤 결정을 거쳤고, 무엇을 구현·검증했으며, 개발 중 발견한 문제를 어떻게 해결했는지 기록한다. 현재 코드를 인수인계하거나 다음 개발 단계의 출발점을 확인할 때 이 문서를 먼저 읽는다.

현재 결론은 다음과 같다. 로컬 우선 PWA의 주요 기능과 선택적 Supabase 동기화 기반 코드는 구현되었고 자동화 검증도 통과했다. GitHub Pages HTTPS staging 배포와 원격 Chromium/WebKit smoke test도 완료했다. 다만 실제 iOS 26+ iPhone에서의 무한 루프 복구, 메모리 압박, 홈 화면 PWA 오프라인 재시작과 실제 Supabase 프로젝트의 RLS 검증은 아직 수행하지 않았다. 따라서 코드는 로컬 MVP 기준선에 도달했지만 기기 릴리스 게이트와 클라우드 운영 게이트는 열려 있다.

## 출발점과 제품 요구

기준 문서는 Notion의 [모바일 크리에이티브 코딩 노트북 프로젝트 브리프](https://app.notion.com/p/3d767b855d6781549fe3c3b20034c3d9)다. 구현을 시작할 때 저장소는 비어 있었으며 신규 React 프로젝트로 구성했다.

초기 요구에서 유지한 제품 원칙은 다음과 같다.

- App Store 배포보다 개인 사용과 빠른 검증을 우선한다.
- 핵심 흐름은 `수집 → 프로필 판별 → 실행 → 수정 → 캡처 → 저장 → 재발견`이다.
- 수집한 원문은 바꾸지 않고 작업본, wrapper, revision을 분리한다.
- GLSL/WebGL과 WGSL·TSL/WebGPU를 서로 다른 실행 프로필로 취급한다.
- ZIP은 백업과 이전 수단이며, 장기적으로 외부 접근 가능한 동기화 저장소가 필요하다.
- 사용자 코드는 개인용이라도 앱 데이터와 인증 정보에서 격리한다.
- 로컬 저장은 네트워크나 로그인 실패와 독립적으로 항상 먼저 성공해야 한다.

## 개발 진행 기록

### 1 설계 기준 확립

커밋 `7b8ea8a`에서 제품 계약과 구현 계획을 저장했다. React UI, 프레임워크와 독립적인 도메인 계층, Dexie 저장소, sandbox iframe runner, 선택적 Supabase adapter를 분리했다. 초기 실행 프로필은 `glsl-webgl2`, `p5-webgl`, `three-webgl`로 제한하고 WebGPU 계열은 후속으로 남겼다.

이 단계에서 원본 불변성, 실행 전 자동 저장, 명시적 revision, nonce/run ID 메시지, 외부 네트워크 차단, ZIP 왕복을 구현 계약으로 고정했다.

### 2 도메인 모델과 프로필 판별

커밋 `feace69`에서 프로젝트의 핵심 타입과 순수 도메인 로직을 구현했다.

- `ProjectRecord`, `OriginalSource`, `Revision`, `AssetRecord`, `CaptureRecord`
- 원본 콘텐츠 해시와 수집 시각
- revision 부모 관계와 생성 사유
- 제목, 코드, 태그, 메모, 출처를 포함하는 검색 텍스트
- GLSL, p5.js, three.js 코드 신호를 이용한 결정적 프로필 순위

ID, 현재 시각, 해시 계산은 주입 가능한 도메인 컨텍스트 뒤에 두어 테스트에서 재현할 수 있게 했다.

### 3 IndexedDB 저장소와 ZIP 왕복

커밋 `287f597`에서 Dexie 기반 repository를 추가했다. 프로젝트와 원본, revision, asset, capture를 분리 저장하고 다음 동작을 구현했다.

- 로컬 CRUD와 soft delete
- 750ms 자동 저장을 위한 draft 저장 계약
- 실행 revision 생성과 성공·실패·중지 결과 기록
- 마지막 성공 revision 복구
- 전체 도메인 검색
- 프로젝트 복제
- 읽을 수 있는 `manifest.json`을 포함한 ZIP 내보내기와 가져오기
- 가져오기 시 project, source, revision, capture ID 재매핑

원본은 별도 저장소에 두고 수정 API를 제공하지 않았다. ZIP 안에는 원본, 현재 작업본, 모든 revision, asset, PNG capture가 함께 들어간다.

### 4 격리 실행기

커밋 `92dfd12`에서 host와 runner의 메시지 프로토콜, 프로필 wrapper, sandbox 수명주기를 구현했다.

- `sandbox="allow-scripts"`만 가진 opaque-origin iframe
- 제한적 CSP와 외부 `connect-src` 차단
- nonce와 run ID가 모두 맞는 event만 수용
- GLSL `main()` 및 Shadertoy `mainImage()` wrapper
- `iResolution`, `iTime`, `iFrame`, `iMouse` uniform
- 고정 버전 p5.js `1.11.10`과 three.js `0.180.0`
- 첫 canvas PNG capture
- iframe 전체 교체 방식의 중지와 초기화
- heartbeat 기반 무응답 실행기 폐기

GLSL 컴파일 로그는 wrapper 줄이 아니라 사용자 코드 줄을 가리키도록 정규화했다. JavaScript, shader, asset, security, unsupported 오류 범주를 분리했다.

### 5 iPhone 우선 인터페이스

커밋 `6d4a29e`에서 수집, 라이브러리, 편집기, 설정 화면을 연결했다. 작은 화면에서는 코드와 출력을 탭으로 전환하고 실행 도구막대를 고정했다. CodeMirror 6, 모바일 기호 입력 줄, 메타데이터 편집, 원본 열람, capture rail을 추가했다.

시각 체계는 필드 노트와 인쇄물 contact sheet를 결합한 방향으로 구성했다. warm paper 배경, 검은 실행 패널, vermilion 실행 강조, chartreuse 상태 표시, serif 제목과 monospaced 기술 라벨을 사용했다. 390 × 844 viewport에서 수집, 실행, 라이브러리 화면을 캡처해 애니메이션 종료 후 레이아웃을 확인했다.

### 6 PWA와 브라우저 회귀

커밋 `86afb96`에서 PWA manifest, service worker precache, Apple touch icon, production multi-entry build, Playwright 모바일 프로젝트를 추가했다. runner와 host를 각각 build entry로 만들고 p5.js, three.js, editor chunk를 분리했다.

production preview에서 다음을 자동화했다.

- GLSL 수집, 실행, capture, 대표 썸네일 표시
- p5.js와 three.js 번들 실행
- 새로고침 후 IndexedDB 복원
- Chromium의 완전 오프라인 app shell 재시작
- Chromium과 WebKit의 runner 보안 경계

Playwright WebKit은 `context.setOffline(true)` 이후 reload 자체가 내부 오류로 끝나므로 해당 조합만 명시적으로 skip하고 실제 Mobile Safari 체크리스트로 이동했다.

### 7 ZIP 가져오기와 선택적 동기화

커밋 `520d61d`에서 라이브러리에 ZIP 가져오기를 연결하고 Supabase 경계를 구현했다.

- 환경 변수가 없으면 네트워크와 outbox 기록을 모두 생략하는 비활성 adapter
- 이메일 magic-link 요청 UI
- 별도 IndexedDB에 저장되는 영속 sync outbox
- metadata와 media의 독립 flush
- stable `clientMutationId`
- `baseServerRevision` 낙관적 잠금
- 충돌 시 local payload와 remote payload 동시 보존
- 겹치는 flush 직렬화와 retry 횟수·오류 기록
- private Storage용 media upload와 metadata 등록
- PostgreSQL schema, RLS, immutable source trigger, optimistic mutation RPC, pgTAP 정책 테스트

로컬 repository는 observer를 통해 commit 이후 sync outbox에 기록한다. adapter나 outbox 오류가 발생해도 이미 완료된 로컬 저장은 되돌리지 않는다.

### 8 복구와 WebKit 호환성 보강

커밋 `5f24b22`에서 실제 브라우저 회귀 중 발견한 문제와 로컬 asset 흐름을 마무리했다.

- runner가 READY 전에 받은 RUN 명령을 잃는 race를 pending command로 해결
- 중지 시 STOP 명령에 의존하지 않고 iframe을 즉시 교체
- heartbeat가 2초 이상 끊기면 sandbox를 폐기하고 오류로 기록
- WebKit IndexedDB가 PNG Blob 저장에서 실패하는 문제를 내부 `ArrayBuffer` 저장으로 우회
- 외부 API에서는 계속 `Blob`을 사용해 UI, ZIP, sync 계약 유지
- 첫 capture를 대표 썸네일로 지정하고 다른 capture를 다시 선택할 수 있게 구현
- 로컬 파일을 저장하고 runner에서 `ASSETS['파일명']` Blob URL로 제공
- 누락된 local asset을 일반 JavaScript 오류와 분리
- 외부 fetch, popup, top navigation, runner local storage 차단을 브라우저에서 검증
- Vitest 보안 권고를 해결하는 버전으로 갱신

### 9 GitHub Pages HTTPS staging

커밋 `88104d3`에서 GitHub Pages 프로젝트 경로 배포를 추가했다.

- public 저장소 `dastjead/creative_coding_notebook` 생성
- `/creative_coding_notebook/` Vite base와 PWA scope 적용
- sandbox iframe의 `runner.html` 경로를 배포 base에 연결
- `main` push 시 type check, 단위 테스트, production build를 거치는 Pages workflow 추가
- GitHub Pages의 HTTPS와 asset CORS 응답 확인
- 공개 URL의 Chromium/WebKit에서 service worker 준비와 GLSL runner canvas smoke test 통과

Staging URL은 <https://dastjead.github.io/creative_coding_notebook/>이다.

## 개발 중 확인한 문제와 해결

| 문제 | 관찰된 증상 | 해결 | 남은 확인 |
|---|---|---|---|
| runner 초기화 race | iframe READY 전에 RUN을 보내면 canvas가 생기지 않음 | READY까지 RUN command 보류 | 실제 iPhone 저속 cold start |
| 협조하지 않는 사용자 코드 | STOP listener가 실행되지 않을 수 있음 | 중지·초기화 시 iframe 노드 교체 | iOS 무한 루프에서 host UI 생존 여부 |
| WebKit Blob 저장 | `Error preparing Blob/File data to be stored in object store` | IndexedDB에는 `ArrayBuffer`, API 경계에서는 `Blob` | 실제 Mobile Safari 장기 저장 |
| 중복 sync flush | 같은 mutation이 동시에 두 번 전송될 수 있음 | flush promise 직렬화와 mutation ID 멱등성 | 실제 네트워크 지연·재연결 |
| 미디어 업로드 실패 | 텍스트 동기화가 함께 막힐 위험 | metadata와 media channel 독립 실행 | 실제 private Storage retry |
| stale server update | 두 기기 수정이 마지막 쓰기로 덮일 위험 | server revision 검사 후 conflict 보존 | 사용자용 conflict 선택 UI |
| WebKit offline 자동화 | Playwright WebKit reload 내부 오류 | Chromium 자동 검증, 실제 Safari 수동 게이트 | iOS 홈 화면 PWA |
| 테스트 도구 취약점 | npm audit 중간 등급 2건 | Vitest `4.1.11`로 갱신 | 정기 audit |

## 현재 구현 구조

| 계층 | 주요 위치 | 책임 |
|---|---|---|
| 도메인 | `src/domain` | 데이터 타입, 원본과 revision, 검색, 프로필 판별 |
| 로컬 저장 | `src/storage` | Dexie CRUD, recovery, asset/capture, ZIP 왕복 |
| 실행 계약 | `src/runtime` | wrapper, 오류 정규화, command/event, iframe controller |
| 격리 실행 | `src/runner` | GLSL, p5.js, three.js 실행과 capture |
| 사용자 화면 | `src/components`, `src/App.tsx` | 수집, 검색, 편집, 실행, 설정 |
| 동기화 | `src/sync` | disabled/Supabase adapter, outbox, retry, conflict |
| 서버 정의 | `supabase` | schema, RLS, RPC, Storage policy, pgTAP |
| 자동 검증 | `src/**/*.test.ts`, `tests/e2e`, `tests/fixtures` | 단위, 컴포넌트, 브라우저, 기기 fixture |

## 검증 증거

기준 커밋에서 수행한 검증 결과는 다음과 같다.

| 검증 | 결과 |
|---|---|
| `npm run check` | 통과 |
| `npm test` | 9개 파일, 35개 테스트 통과 |
| `npm run build` | production build 및 PWA precache 38개 항목 생성 |
| `npm run test:e2e` | 13개 통과, 1개 의도적 skip |
| Chromium offline reload | 통과 |
| Chromium/WebKit 세 프로필 실행 | 통과 |
| Chromium/WebKit PNG capture·대표 썸네일 | 통과 |
| Chromium/WebKit runner 보안 경계 | 통과 |
| `npm audit --audit-level=moderate` | 취약점 0건 |
| 390 × 844 시각 점검 | 수집, 실행, 라이브러리 화면 확인 |
| GitHub Pages workflow | type check, 35개 테스트, build, deploy 통과 |
| 원격 HTTPS smoke test | Chromium/WebKit service worker와 GLSL runner 통과 |

production build에는 고정 runtime이 포함되어 p5.js와 three.js chunk가 크다는 경고가 남는다. 이는 현재 오프라인 실행 계약에 따른 것으로 build 실패는 아니며, 후속 단계에서 설치 후 다운로드 전략과 lazy runtime pack을 별도로 평가한다.

## 현재 상태와 인수인계 경계

완료된 범위:

- 로컬 수집부터 재검색까지의 수직 흐름
- 세 WebGL 실행 프로필
- 원본·작업본·revision·capture 관계
- 로컬 asset 전달과 외부 네트워크 차단
- ZIP 백업과 복원
- PWA production build와 자동화된 브라우저 회귀
- GitHub Pages HTTPS staging과 `main` 자동 배포
- Supabase adapter, outbox, migration, RLS 테스트 파일

외부 환경이 없어 완료 판정을 유보한 범위:

- iOS 26+ 실제 iPhone 복구·메모리·홈 화면 PWA 테스트
- 실제 iPhone의 GitHub Pages 설치와 service worker update 확인
- 실제 Supabase 프로젝트 migration 적용
- magic-link redirect와 세션 복원
- pgTAP RLS 실행
- 두 기기 동시 수정과 media retry 검증

후속 작업은 [전체 개발 계획](project-master-plan.md)을 기준으로 진행한다. 실제 기기 시험 절차와 기록 표는 [iOS 기기 검증 문서](ios-device-validation.md)를 사용한다.
