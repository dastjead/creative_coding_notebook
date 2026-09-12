# 모바일 크리에이티브 코딩 노트북 전체 개발 계획

- 작성 기준일: 2026년 9월 12일
- 현재 구현 기준선: `main`의 `bd1196e`
- 기준 제품 문서: [Notion 프로젝트 브리프](https://app.notion.com/p/3d767b855d6781549fe3c3b20034c3d9)

## 문서 목적

이 문서는 현재 구현된 로컬 PWA 기준선과 앞으로 필요한 기기 검증, 클라우드 동기화, WebGPU 확장, 조건부 네이티브 셸을 하나의 실행 순서로 관리한다. 기존 구현 계획은 최초 구축 기록으로 유지하고, 앞으로의 우선순위와 완료 판정은 이 문서를 기준으로 갱신한다.

사용자가 실제 iOS 기기에서 PWA의 기본 실행 성공을 확인했으므로 PWA 경로는 유효하다. 다만 홈 화면 설치 상태, 2초 hard-stop, context loss, memory pressure, 완전 오프라인 재시작과 ZIP 왕복의 상세 게이트는 아직 별도로 기록해야 한다. 동기화 단계에서는 Supabase를 즉시 확정하지 않고 사용자 소유 파일 저장소까지 동일 기준으로 검증한다.

## 제품 목표

개인용 모바일 노트북에서 짧은 크리에이티브 코드를 수집하고 원문을 보존한 채 안전하게 실행·수정하며, 결과 이미지와 문맥을 여러 기기에서 다시 찾을 수 있게 한다.

최종 핵심 흐름:

`수집 → 프로필 확인 → 작업본 편집 → 격리 실행 → 오류 복구 → 캡처 → 로컬 저장 → 동기화 → 재발견`

## 확정된 제품 경계

| 구분 | 확정 내용 |
|---|---|
| 사용자 | 개인 사용자, 비공개 데이터 |
| 첫 기기 | iOS 26+ iPhone |
| 배포 | PWA 우선, App Store 배포는 현재 범위 밖 |
| 초기 프로필 | GLSL/Shadertoy/twigl geekest, p5.js WebGL, three.js WebGL |
| 원본 | 수집 후 불변, 작업본·wrapper·revision과 분리 |
| 캡처 | MVP는 PNG |
| 네트워크 | runner 외부 연결과 원격 runtime 기본 차단 |
| 로컬 저장 | IndexedDB, persistent storage 상태 표시, ZIP 안전장치 |
| 외부 저장 | Supabase, Dropbox, Google Drive를 같은 Vault 계약으로 비교한 뒤 결정 |
| 충돌 | 마지막 쓰기 우선 금지, 양쪽 revision 보존 |
| 후속 프로필 | Raw WGSL과 three.js WebGPU/TSL을 별도 profile로 추가 |

## 현재 기준선

| 영역 | 상태 | 현재 판단 |
|---|---|---|
| 도메인·원본·revision | 완료 | 자동 테스트 통과 |
| Dexie 로컬 저장·검색 | 완료 | 자동 테스트 통과 |
| ZIP 내보내기·가져오기 | 완료 | 빈 저장소 왕복 테스트 통과 |
| 코드 수집 UX | 완료 | 빈 코드 입력, 선택 제목, 자동 제목 적용 |
| GLSL, p5.js, three.js runner | 구현 완료 | Chromium/WebKit 통과, iOS PWA 기본 실행 확인·상세 fixture 미기록 |
| PNG capture·대표 썸네일 | 구현 완료 | 생성 직후 자동 실행·캡처, Chromium/WebKit 통과 |
| 로컬 asset | 구현 완료 | `ASSETS` 전달과 누락 오류 분리 |
| PWA·오프라인 | 구현·Pages 배포 완료 | iOS 실제 기기 기본 실행 확인, 완전 오프라인·복구 상세 미기록 |
| runner 보안 경계 | 구현 완료 | 자동 검증 통과, 실기기 재확인 필요 |
| Supabase client·outbox | 후보 기반 완료 | 원격 환경 미연결, provider 선택 전 운영 적용 보류 |
| PostgreSQL·RLS·RPC | 파일 완료 | 실제 migration과 pgTAP 미실행 |
| 충돌 해결 UI | 미구현 | conflict 데이터는 보존되나 선택 화면 필요 |
| WebGPU/WGSL/TSL | 미구현 | 기기 게이트 후 착수 |
| SwiftUI/WKWebView 셸 | 조건부 | PWA 복구 실패 시 앞당김 |

상태 해석상 로컬 MVP 코드는 완성되었고 iOS PWA 기본 실행도 확인했다. 상세 복구 게이트와 일상 사용 검증은 남아 있으므로 전체 기기 릴리스 게이트가 완료된 것은 아니다. Supabase는 adapter와 서버 정의가 준비된 후보이며, Dropbox와 Google Drive 비교 전에는 운영 저장소로 확정하지 않는다.

## 실행 순서 개요

| 단계 | 목표 | 선행 조건 | 종료 조건 |
|---|---|---|---|
| 0 | 자동화 기준선 유지 | 완료 | 모든 자동 검증 green |
| 1 | iOS 실제 기기 가능성 판정 | HTTPS staging | 기본 실행 확인 후 hard stop 포함 상세 기기 게이트 판정 |
| 2 | 로컬 MVP 릴리스 품질 확보 | 단계 1 통과 또는 경로 변경 | 개인용 일상 사용 가능 |
| 3 | 동기화 저장소 비교·선정과 단일 사용자 활성화 | iOS PWA 경로 유효 | Dropbox·Drive·Supabase 동일 fixture 비교 후 한 후보의 새 기기 복원 통과 |
| 4 | 두 기기 동기화와 충돌 UX | 단계 3 | 양쪽 revision 보존·선택·재동기화 |
| 5 | WebGPU 계열 profile 검증 | 단계 2 안정화 | 지원 기기별 기능 감지와 별도 profile |
| 6 | 네이티브 셸 조건부 도입 | 명확한 PWA 한계 | 필요한 기능만 native bridge로 제공 |
| 7 | 장기 확장 | 실제 사용 데이터 | 우선순위가 확인된 항목만 착수 |

## 단계 0 자동화 기준선

상태: 완료, 이후 모든 단계에서 회귀 게이트로 유지

유지할 명령:

```bash
npm run check
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

현재 기준은 단위·컴포넌트 테스트 45개, 모바일 E2E 15개 통과와 Playwright WebKit offline reload 1개 skip이다. 새 profile이나 저장 형식을 추가할 때 이 기준을 낮추지 않는다.

운영 규칙:

- 오류 수정에는 재현 테스트를 먼저 추가한다.
- archive manifest 변경에는 명시적 format version과 이전 버전 fixture를 추가한다.
- runtime 버전 변경에는 세 profile 전체 회귀와 실제 기기 재검증이 필요하다.
- runner CSP나 sandbox 권한 확대는 보안 테스트와 이유 기록 없이는 허용하지 않는다.

## 단계 1 iOS 실제 기기 가능성 게이트

우선순위: P0, 다음 작업

### 1A HTTPS staging 준비

- [x] GitHub Pages에 production build를 배포한다.
- [x] `runner.html`의 meta CSP와 GitHub Pages asset CORS를 확인한다.
- [x] staging commit `88104d3`과 URL을 기록한다.
- [ ] 실제 iPhone 설치 후 새 service worker가 적용되는 update 경로를 확인한다.

Staging URL: <https://dastjead.github.io/creative_coding_notebook/>

### 1B 세 profile 실제 실행

- GLSL 정상, 컴파일 오류, 줄 번호 mapping을 확인한다.
- p5.js 정상, runtime 오류, PNG capture를 확인한다.
- three.js 정상, runtime 오류, local texture asset을 확인한다.
- Safari 탭과 홈 화면 PWA에서 같은 fixture를 실행한다.

### 1C 복구와 메모리

- `p5/infinite-loop.js` 실행 전 자동 저장 완료를 확인한다.
- 중지 후 2초 안에 기존 iframe 제거와 새 READY를 확인한다.
- `three/context-loss.js` 후 정상 fixture로 회복하는지 확인한다.
- memory pressure 후 재진입 시 작업본, 원본, capture가 남는지 확인한다.
- 비행기 모드에서 완전 종료 후 PWA 재시작·편집·실행·저장을 확인한다.

종료 판정:

- 통과: PWA를 기본 셸로 유지하고 단계 2와 3으로 진행한다.
- JavaScript profile만 실패: GLSL-only 축소와 SwiftUI/WKWebView 조기 도입을 비교한다.
- host UI와 저장 복구 실패: 임의 JavaScript 실행 릴리스를 차단하고 단계 6을 앞당긴다.

결과는 `docs/ios-device-validation.md`의 표와 실행 기록에 남긴다.

## 단계 2 로컬 MVP 릴리스 품질

우선순위: P0, 단계 1 직후

### 기능 보강

완료된 보강:

- [x] 새 코드 입력란의 샘플 placeholder를 제거한다.
- [x] 제목이 비어 있으면 profile과 생성 시각으로 자동 이름을 만든다.
- [x] 새 노트 생성 직후 정상 실행 화면을 자동 캡처해 대표 썸네일로 저장한다.
- [x] 실제 capture가 없는 카드는 가상 이미지 대신 명시적인 빈 상태를 표시한다.

남은 보강:

- invalid ZIP, 손상 manifest, unsupported archive version 오류를 UI에 표시한다.
- asset 이름 충돌, 삭제, 교체와 용량 표시를 추가한다.
- storage usage와 quota를 표시하고 대용량 capture 경고 기준을 정한다.
- p5.js와 three.js 비동기 runtime 오류의 성공 revision 판정 시점을 보강한다.
- service worker update 대기·적용 상태를 사용자에게 표시한다.
- capture 대표 이미지 변경, asset 추가, ZIP 가져오기를 VoiceOver로 점검한다.

### 회귀와 복구

- archive v1 golden fixture와 빈 저장소 import E2E를 추가한다.
- quota 부족, DB transaction 실패, capture 변환 실패 fixture를 추가한다.
- reload와 app update 중인 draft flush를 점검한다.
- iPhone 세로 화면의 키보드 표시·숨김과 safe area를 점검한다.

종료 조건:

- 실제 iPhone에서 일주일 개인 사용 중 원본·작업본 유실이 없다.
- 오류가 발생해도 export와 마지막 성공본 복구에 접근할 수 있다.
- 모든 로컬 자료를 내보내고 새 설치로 가져올 수 있다.
- 새 PWA 버전 적용 후 IndexedDB와 archive 호환성이 유지된다.

## 단계 3 동기화 저장소 비교·선정과 단일 사용자 활성화

우선순위: P1

상세 비교와 공식 문서 근거는 [동기화 저장소 비교 검토](sync-storage-evaluation.md)를 기준으로 한다. Supabase는 기존 구현이 있는 앱형 후보이고, Dropbox는 파일형 1순위 검증 후보, Google Drive는 파일형 2순위 검증 후보다. GitHub는 선택형 코드 mirror, Notion은 선택형 카탈로그, iCloud Drive는 native 셸 이후 후보로 둔다.

### 공통 저장 계약

- 읽을 수 있는 `Fieldnote Vault v1` 경로, manifest, checksum과 format version을 정의한다.
- original과 revision은 생성 후 수정하지 않고 project head만 provider version으로 조건부 갱신한다.
- `RemoteStorageAdapter`가 인증, 변경 cursor, 읽기, 조건부 쓰기, 삭제, quota를 제공한다.
- provider adapter와 도메인 merge, conflict inbox, Vault serialization을 분리한다.
- 로컬 750ms 자동 저장과 원격 저장 빈도를 분리한다.
- media는 metadata와 별도 queue로 전송하고 지연 다운로드를 허용한다.

### 후보 검증

- Dropbox App Folder와 PKCE로 GitHub Pages PWA 연결을 검증한다.
- Dropbox folder cursor, `rev`, content hash로 초기 pull과 조건부 write를 검증한다.
- Google Drive `drive.file`, Changes token, file version으로 같은 fixture를 실행한다.
- 기존 Supabase adapter는 magic-link, RLS, private Storage, custom pull cursor 후보로 비교한다.
- GitHub, Notion, iCloud는 기본 저장소가 아닌 권고 역할에 맞춰 후속 범위로 둔다.

### 공통 전송 fixture

- 프로젝트 20개와 PNG 100개를 올리고 빈 IndexedDB의 새 기기에서 복원한다.
- 두 기기의 offline 동시 수정 후 어느 revision도 잃지 않고 conflict를 감지한다.
- media 업로드 실패가 text metadata를 막지 않는지 확인한다.
- token 만료, 앱 종료, 네트워크 전환, 공급자 화면의 직접 파일 변경을 확인한다.
- 사용자가 provider 도구만으로 자료를 내려받아 읽고 복구할 수 있는지 확인한다.
- 요청 수, 전송량, 저장 용량, 예상 비용, 재로그인 빈도를 기록한다.

### Supabase 후보 선행 수정

- magic-link redirect에 GitHub Pages base path를 포함한다.
- 동일 `clientMutationId` 재전송 시 mutation receipt의 적용 revision을 반환한다.
- 초기 full pull, 단조 증가 change cursor, tombstone pull을 추가한다.
- Realtime은 cursor pull을 깨우는 신호로만 사용한다.

### 선택 후 환경과 보안

- 선택한 provider의 개인 프로젝트 또는 API 앱과 redirect URL을 등록한다.
- GitHub Pages bundle과 저장소에 secret이나 장기 access token이 포함되지 않는지 확인한다.
- Supabase 선택 시 migration, private bucket, explicit grants, RLS와 pgTAP을 실행한다.
- Dropbox 선택 시 App Folder 최소 scope와 PKCE verifier 수명주기를 확인한다.
- Google Drive 선택 시 `drive.file` 최소 scope와 OAuth consent 설정을 확인한다.

### 전송 동작

- 로컬 project, immutable source, revision을 서버에 round-trip한다.
- asset과 capture 업로드를 metadata queue와 독립적으로 재시도한다.
- offline 편집 후 online 복귀 시 outbox가 순서대로 비워지는지 확인한다.
- provider version 또는 mutation receipt가 동일 작업 재전송을 멱등 처리하는지 확인한다.
- auth 만료와 세션 갱신 실패가 로컬 저장을 방해하지 않는지 확인한다.

종료 조건:

- Dropbox, Google Drive, Supabase 비교 결과와 탈락 이유가 문서에 남는다.
- 선택한 provider에서 허가하지 않은 요청이 다른 row 또는 object를 읽거나 쓸 수 없다.
- 실패한 media upload가 metadata 저장과 다음 mutation을 막지 않는다.
- 브라우저를 종료해도 pending outbox가 복원된다.
- ZIP 없이 새 기기에서 로그인해 개인 자료를 내려받을 수 있다.

## 단계 4 두 기기 동기화와 충돌 경험

우선순위: P1

현재 queue는 conflict에 local payload와 remote payload를 보존하지만 사용자가 이를 비교하고 선택하는 화면은 없다. 이 단계에서 conflict를 제품 기능으로 완성한다.

### 구현

- 서버에서 변경 목록을 가져오는 pull cursor와 tombstone 동기화를 추가한다.
- project별 sync 상태, 마지막 성공 시각, pending 수, 실패 이유를 표시한다.
- conflict inbox와 두 revision 비교 화면을 만든다.
- local 유지, remote 유지, 새 merge revision 생성 선택을 제공한다.
- conflict 해결도 새 mutation으로 기록하고 원본 source는 바꾸지 않는다.
- media download cache와 orphan object 정리 정책을 만든다.

### 검증

- 두 iPhone에서 같은 base revision을 각각 수정한다.
- 서버가 한쪽을 적용하고 다른 쪽을 conflict로 돌려주는지 확인한다.
- UI에서 양쪽 코드를 모두 열고 선택 또는 merge할 수 있는지 확인한다.
- 해결 후 두 기기가 같은 head를 갖되 양쪽 과거 revision이 남는지 확인한다.
- 삭제와 복원, offline 장기 편집, media upload 부분 실패를 반복한다.

종료 조건:

- 두 기기 동시 수정에서 어느 코드도 사라지지 않는다.
- sync 장애 중에도 로컬 편집·실행·capture가 계속된다.
- 사용자가 conflict를 해결한 이유와 선택한 revision을 추적할 수 있다.
- 다른 사용자의 row와 object 접근 거부가 자동 테스트로 유지된다.

## 단계 5 WebGPU 계열 확장

우선순위: P2, 로컬 MVP와 sync 안정화 후

WebGPU는 기존 GLSL wrapper에 섞지 않는다. 기능 감지와 오류 계약이 다른 별도 runtime profile로 추가한다.

### 조사 순서

1. Raw WGSL fragment/compute 최소 runner를 독립 prototype으로 만든다.
2. 실제 iPhone에서 adapter/device 획득, canvas configure, context loss를 확인한다.
3. three.js WebGPURenderer와 TSL의 고정 버전·번들 크기·Safari 동작을 확인한다.
4. WGSL과 TSL 오류 줄 mapping 방법을 결정한다.
5. WebGPU 미지원 또는 제한 기기에서 명확한 capability 안내를 제공한다.

### profile 계약

- `wgsl-webgpu`: raw WGSL과 앱 wrapper를 분리 보존한다.
- `three-webgpu-tsl`: three.js WebGPU/TSL 전용 runtime을 사용한다.
- WebGL profile의 기존 project와 revision 의미를 바꾸지 않는다.
- profile version과 wrapper version을 revision마다 기록한다.

종료 조건:

- 지원 기기에서는 정상 fixture가 실행·capture된다.
- 미지원 기기에서는 실행 전에 unsupported로 판정한다.
- compilation, validation, device loss 오류를 구분한다.
- WebGL regression과 별개로 실제 기기 행렬을 유지한다.

## 단계 6 조건부 SwiftUI와 WKWebView 셸

우선순위: 조건부

다음 중 하나가 실제로 확인될 때만 착수한다.

- 무한 루프가 PWA host UI까지 반복적으로 멈춘다.
- 홈 화면 PWA의 저장·복구가 개인 사용에 충분하지 않다.
- Share Extension이 수집 시간에 명확한 이점을 준다.
- background upload 또는 파일 접근이 PWA 범위를 넘어선다.

네이티브 셸을 도입해도 web runner, domain model, archive format은 재사용한다. SwiftUI는 navigation, file access, share ingestion, WebView process recovery에 집중하고 creative runtime 코드를 다시 작성하지 않는다.

종료 조건은 별도 WebView 프로세스 종료 후 host와 자동 저장 데이터가 살아 있고, 동일 archive를 PWA와 native 셸이 왕복할 수 있는 것이다.

## 단계 7 장기 확장 후보

실제 사용 빈도와 불편을 기록한 뒤 별도 milestone로 선택한다.

- GIF와 영상 capture
- X 및 사이트별 코드 추출
- screenshot OCR과 코드 후보 정리
- PWA share target 또는 Share Extension
- 선택형 runtime pack과 bundle lazy download
- Git 원격 백업
- iPad split layout과 외부 키보드 최적화
- 공개 gallery 또는 App Store 배포

이 항목들은 현재 로컬·동기화 품질 게이트보다 우선하지 않는다.

## 전체 테스트 전략

| 계층 | 자동화 | 실제 환경 |
|---|---|---|
| 도메인 | 원본 불변, 검색, revision lineage, profile 판별 | 해당 없음 |
| 저장 | fake-indexeddb CRUD, recovery, ZIP, Blob/ArrayBuffer 경계 | iOS quota·eviction·재시작 |
| runner | wrapper, nonce/run ID, stop/reset, heartbeat | iOS infinite loop·context loss·memory pressure |
| UI | Testing Library 수집·검색·설정 | touch keyboard·safe area·VoiceOver |
| PWA | production build, Chromium offline | Mobile Safari 홈 화면 offline·update |
| 보안 | Chromium/WebKit fetch·popup·navigation·storage 차단 | staging response header와 Web Inspector |
| sync | queue unit test, retry, conflict, Vault serialization | Dropbox·Drive·Supabase 실제 인증, 조건부 쓰기, 새 기기 복원, 두 기기 |
| WebGPU | profile별 unit/E2E | 지원 iPhone/iPad device matrix |

## 주요 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| iOS에서 무한 루프가 host를 차단 | JavaScript profile 출시 불가 | 단계 1 차단 게이트, 실패 시 native 셸 또는 GLSL-only |
| IndexedDB eviction | 개인 자료 유실 | persist 상태, ZIP, 선택한 원격 저장소, quota 표시 |
| service worker와 DB schema 불일치 | update 후 실행 실패 | archive version, migration test, staged rollout |
| runtime bundle 증가 | cold install 지연 | profile별 chunk, 후속 runtime pack 평가 |
| sync conflict 누락 | 코드 덮어쓰기 | optimistic lock, conflict inbox, 양쪽 revision 보존 |
| 원격 저장 권한 오류 | 데이터 노출 | 최소 scope, secret 번들 검사, provider별 negative test |
| 정적 PWA token 만료 | 동기화 중단·반복 로그인 | Dropbox·Drive foreground 재인증과 Supabase session 지속성 비교 |
| 범용 파일의 직접 수정 | manifest 손상·revision 불일치 | checksum, provider version, conflict inbox, 복구 가능한 immutable 파일 |
| async runtime 오류를 성공으로 기록 | 잘못된 last-known-good | 성공 판정 지연과 profile별 health event 보강 |
| archive 손상·미지원 버전 | 복구 실패 | checksum, version migration, golden fixture |

## 미확정 결정

다음 항목은 구현 전에 사용자 선택 또는 실제 시험 결과가 필요하다.

- 첫 실기기 모델과 테스트할 iOS 26 build
- 최종 원격 저장 provider: Dropbox, Google Drive, Supabase
- 사용자에게 보이는 일반 폴더와 provider app folder 중 우선순위
- token 만료 시 foreground 재인증 허용 여부
- Supabase 선택 시 프로젝트, 리전, 이메일 발송 설정
- 프로젝트·asset별 권장 용량과 경고 기준
- conflict 화면에서 기본으로 강조할 선택 방식
- media 원본을 모든 기기에 자동 다운로드할지 필요할 때만 받을지
- WebGPU runtime을 기본 precache할지 선택형 pack으로 둘지
- PWA 한계가 확인될 경우 native 셸의 최소 기능 범위

## 다음 실행 묶음

다음 작업 세션에서는 아래 순서로 진행한다.

1. `docs/next-session-handoff.md`와 `docs/sync-storage-evaluation.md`를 읽는다.
2. `Fieldnote Vault v1`과 `RemoteStorageAdapter` 계약을 테스트로 고정한다.
3. Dropbox App Folder·PKCE·cursor·조건부 write 최소 spike를 구현한다.
4. Google Drive 또는 기존 Supabase 후보에 동일 fixture를 실행한다.
5. 인증 지속성, 새 기기 복원, conflict 보존, media 실패, 비용을 비교해 provider를 확정한다.
6. 선택한 provider의 단일 사용자 push/pull과 실제 권한 negative test를 완료한다.
7. iOS 상세 기기 문서의 hard-stop, context loss, memory pressure, offline, ZIP 항목을 보완한다.
8. 두 기기 conflict fixture와 conflict inbox를 구현한다.
9. 일주일 개인 사용에서 저장·검색·capture·동기화 문제를 기록한다.
10. 관찰된 작업량을 기준으로 WebGPU milestone 일정과 범위를 산정한다.

## 완료 정의

로컬 MVP 완료:

- 실제 iPhone에서 세 WebGL profile과 오류 fixture가 동작한다.
- 무한 루프와 context loss 후 2초 내 복구되고 데이터가 남는다.
- 홈 화면 PWA가 offline에서 재시작·편집·저장된다.
- 원본, 작업본, wrapper, revision, capture, asset 관계를 식별할 수 있다.
- 전체 자료를 내보내 새 설치로 가져올 수 있다.

동기화 완료:

- 새 기기에서 로그인 후 ZIP 없이 개인 자료를 복원한다.
- 두 기기 동시 수정 시 양쪽 revision이 보존된다.
- media 실패가 metadata 동기화를 막지 않는다.
- 비인증·다른 사용자 접근을 실제 RLS 테스트가 거부한다.
- conflict를 UI에서 해결하고 모든 기기가 같은 head로 수렴한다.

후속 확장 완료:

- WebGPU profile은 WebGL과 별도 capability·wrapper·오류 계약을 가진다.
- native 셸은 실제로 확인된 PWA 한계만 해결한다.
- 장기 기능은 개인 사용 데이터로 우선순위를 정한다.

관련 문서:

- [개발 경과](development-history.md)
- [iOS 실제 기기 검증](ios-device-validation.md)
- [동기화 저장소 비교](sync-storage-evaluation.md)
- [다음 세션 인계](next-session-handoff.md)
- [설계 계약](superpowers/specs/2026-09-12-mobile-creative-coding-notebook-design.md)
- [최초 구현 계획](superpowers/plans/2026-09-12-mobile-creative-coding-notebook.md)
