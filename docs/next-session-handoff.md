# 다음 세션 인계

- 작성일: 2026년 9월 12일
- 브랜치: `main`
- 구현 기준선: `bd1196e`
- 공개 PWA: <https://dastjead.github.io/creative_coding_notebook/>

## 현재 상태

- React, TypeScript, Vite, Dexie 기반 로컬 MVP의 기본 구현은 완료했다.
- GLSL/Shadertoy/twigl geekest, p5.js WebGL, three.js WebGL 프로필이 구현되어 있다.
- 빈 코드 수집, 자동 제목, 실행 화면 자동 썸네일, 검색, 복제, PNG capture, ZIP 왕복이 구현되어 있다.
- GitHub Pages가 `main` push에서 자동 배포된다.
- 사용자가 iOS 실제 기기에서 PWA의 기본 실행 성공을 확인했다.
- 홈 화면 설치 상태, 실제 기기 모델, iOS build, 세 프로필 오류 fixture, 2초 hard-stop, context loss, memory pressure, 완전 오프라인 재시작, ZIP 왕복의 상세 결과는 아직 기록되지 않았다. 기본 smoke 성공과 전체 복구 게이트를 구분한다.
- Supabase client, push outbox, SQL migration, RLS test 파일은 구현되어 있지만 실제 Supabase 프로젝트에는 적용하지 않았다.
- 동기화 저장소는 Supabase로 확정하지 않았다. Dropbox, Google Drive, GitHub, iCloud, Notion을 포함해 다시 검토했으며 결과는 [동기화 저장소 비교](sync-storage-evaluation.md)에 있다.

## 확정된 방향

- IndexedDB를 로컬 작업 기준으로 유지한다.
- 원본은 불변이며 작업본, wrapper, revision과 분리한다.
- ZIP은 백업·이전 수단이고 외부 접근 가능한 동기화 경로가 필요하다.
- provider를 바꿔도 읽을 수 있는 공통 Vault 형식을 유지한다.
- 마지막 쓰기 우선으로 코드를 버리지 않고 양쪽 revision을 보존한다.
- 기존 Supabase 코드는 삭제하지 않고 비교 후보로 유지한다.

## 다음 세션의 첫 목표

**provider-neutral Vault 형식과 원격 저장 adapter 계약을 테스트로 고정한 뒤 Dropbox 연결 가능성을 검증한다.**

권장 순서:

1. `git status`와 이 문서의 구현 기준선을 확인한다.
2. [동기화 저장소 비교](sync-storage-evaluation.md)와 [전체 개발 계획](project-master-plan.md)의 단계 3을 읽는다.
3. 현재 archive serializer를 재사용할 수 있는 `VaultCodec` 설계를 확정한다.
4. 원본, revision, capture, asset의 경로·manifest version·checksum fixture를 먼저 작성한다.
5. `RemoteStorageAdapter`의 connect, change cursor, read, conditional write, delete, quota 계약을 작성한다.
6. Dropbox App Folder와 PKCE를 사용하는 최소 spike를 별도 설정 뒤에서 연결한다.
7. token 만료와 foreground 재인증이 개인 사용에 허용 가능한지 실제 iPhone에서 확인한다.
8. 같은 fixture를 기존 Supabase 후보와 비교한 뒤 provider를 최종 선택한다.

## 외부 설정 checkpoint

Dropbox spike를 실제 연결하려면 사용자가 소유한 Dropbox API 앱과 redirect URL 등록이 필요하다. 다음 세션에서 코드 계약과 mock test는 먼저 진행할 수 있지만, 실제 credential 생성이나 외부 서비스 설정은 사용자가 선택한 뒤 진행한다.

저장소에 넣어서는 안 되는 값:

- Dropbox access token 또는 refresh token
- Google OAuth secret
- GitHub personal access token
- Notion integration secret
- Supabase service role key

GitHub Pages에는 공개 가능한 client ID나 Supabase publishable key만 둘 수 있다.

## 아직 필요한 선택

- Dropbox와 Google Drive 중 실제로 주로 사용하는 개인 저장소
- 공급자 화면에서 파일을 직접 볼 수 있는 일반 폴더와 숨겨진 app folder 중 우선순위
- token 만료 시 foreground 재인증을 허용할지 여부
- capture와 asset을 모든 기기에 자동 다운로드할지 필요할 때만 받을지
- GitHub code mirror와 Notion 카탈로그를 후속 기능으로 원하는지 여부

## 검증 명령

코드를 변경한 세션은 종료 전에 다음 기준을 유지한다.

```bash
npm run check
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

현재 자동화 기준은 단위·컴포넌트 테스트 45개, Playwright E2E 15개 통과와 WebKit offline reload 1개 의도적 skip이다.

## 읽기 순서

1. [이 문서](next-session-handoff.md)
2. [동기화 저장소 비교](sync-storage-evaluation.md)
3. [전체 개발 계획](project-master-plan.md)
4. [개발 경과](development-history.md)
5. [iOS 실제 기기 검증](ios-device-validation.md)
