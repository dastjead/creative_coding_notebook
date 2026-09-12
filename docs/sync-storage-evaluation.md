# 동기화 저장소 비교 검토

- 검토일: 2026년 9월 12일
- 상태: 저장소 선택 전 기술 검증 필요
- 관련 계획: [전체 개발 계획](project-master-plan.md)

## 검토 목적

모바일 크리에이티브 코딩 노트북의 외부 저장소를 Supabase로 확정하기 전에, 앱 전용 동기화 백엔드뿐 아니라 사용자가 직접 소유하고 열어볼 수 있는 GitHub, Dropbox, Google Drive, iCloud Drive, Notion을 함께 비교한다.

이 제품에서 ZIP은 백업과 이전 수단일 뿐이다. 외부 저장소는 새 기기에서 로그인하거나 연결한 뒤 원본, 작업 revision, 메모, 출처 URL, asset, PNG capture를 다시 내려받을 수 있어야 한다.

## 확정 요구

- IndexedDB가 로컬 작업의 기준이며 네트워크 실패가 편집·실행·저장을 막지 않는다.
- 수집한 원본은 불변이며 작업본, wrapper, revision과 분리한다.
- 두 기기에서 같은 프로젝트를 수정해도 어느 쪽 코드도 사라지지 않는다.
- PNG와 asset 실패가 텍스트 metadata 동기화를 막지 않는다.
- 외부 저장 자료는 서비스에 종속된 불투명 객체만이 아니라 내보낼 수 있는 형식을 가져야 한다.
- 개인용 PWA와 GitHub Pages 정적 호스팅을 우선하며 별도 서버는 꼭 필요한 경우에만 추가한다.

## 비교 범주

외부 저장 후보는 서로 같은 종류가 아니다.

1. **앱 데이터 백엔드**: Supabase와 CloudKit처럼 인증, 데이터베이스, 객체 저장소를 제공한다.
2. **사용자 소유 파일 저장소**: Dropbox, Google Drive, GitHub, iCloud Drive처럼 사용자가 파일을 직접 보거나 다른 도구로 다룰 수 있다.
3. **문서·카탈로그 서비스**: Notion처럼 프로젝트를 읽기 좋게 정리하지만 정확한 원본과 대량 binary 보존에는 제약이 있다.

따라서 “자동 양방향 동기화가 가장 쉬운가”와 “사용자가 자료를 직접 소유하고 읽을 수 있는가”를 별도 축으로 판단한다.

## 요약 비교

| 후보 | 사용자 가시성 | 변경 감지·충돌 단서 | 정적 PWA 인증 지속성 | 코드와 PNG | 현재 권고 역할 |
|---|---|---|---|---|---|
| Supabase | 낮음 | 자체 revision RPC와 pull protocol 필요 | 높음 | 적합 | 앱형 동기화 후보 |
| Dropbox | 높음 | folder cursor, `rev`, content hash | 중간 | 적합 | 파일형 1순위 검증 후보 |
| Google Drive | 높음 | Changes token, file version, checksum | 중간 | 적합 | 파일형 2순위 검증 후보 |
| GitHub | 높음 | commit, blob SHA, `409 Conflict` | 중하 | 코드는 우수, 누적 PNG는 불리 | 선택형 코드 mirror |
| iCloud Drive | 높음 | 운영체제 파일 조정 | 현재 PWA에서 낮음 | 적합 | native 셸 이후 후보 |
| CloudKit | 낮음 | record/database change API | Apple 계정 중심 | 가능 | Apple 앱 데이터 백엔드 후보 |
| Notion | 높음 | page/block 갱신 | 정적 PWA 단독 구현에 부적합 | 긴 원문·revision·binary에 불리 | 선택형 카탈로그 |

## 후보별 판단

### Supabase

장점:

- PostgreSQL로 project head, 불변 original source, append-only revision, tombstone을 명확하게 표현할 수 있다.
- Auth와 Row Level Security를 결합해 브라우저의 publishable key만으로 사용자별 데이터를 제한할 수 있다.
- private Storage에 PNG와 asset을 두고 metadata queue와 분리할 수 있다.
- 현재 저장소에 client, outbox, migration, RPC, RLS 시험 파일이 이미 있어 재사용 비용이 가장 낮다.

제약:

- Supabase 자체가 IndexedDB와 자동으로 양방향 동기화해 주는 것은 아니다.
- 현재 구현은 push outbox까지이며 초기 pull, 변경 cursor, tombstone pull, media download cache, conflict 해결 UI가 남아 있다.
- 사용자는 Postgres row와 Storage object를 일반 파일 폴더처럼 직접 열어보기 어렵다.
- 무료 프로젝트는 활동이 적으면 일시 정지될 수 있으므로 간헐적으로 쓰는 개인 앱에서 복귀 UX를 확인해야 한다.

공식 참고:

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase 무료 프로젝트 일시 정지](https://supabase.com/docs/guides/platform/free-project-pausing)

### Dropbox

장점:

- App Folder 권한으로 접근 범위를 앱 전용 폴더에 제한할 수 있다.
- `list_folder`와 cursor로 추가, 수정, 삭제를 증분 수집할 수 있다.
- 파일의 `rev`와 `content_hash`를 이용해 로컬 기준 버전을 확인하고 조건부 갱신할 수 있다.
- revision이 일치하지 않는 쓰기는 conflicted copy로 보존할 수 있어 무조건 덮어쓰기를 피하기 쉽다.
- 코드, JSON, PNG, 임의 asset을 일반 파일 구조로 보존할 수 있다.

제약:

- 순수 JavaScript 웹 앱은 PKCE와 짧은 수명의 access token 사용이 권장되며 refresh token 없는 흐름이 기본 권고다. 장시간 무인 동기화보다 앱을 열었을 때 수행하는 foreground 동기화에 적합하다.
- 파일 API는 도메인 충돌을 해결하지 않는다. revision을 불변 파일로 만들고 project head만 조건부 갱신하는 앱 규칙이 필요하다.
- 750ms 로컬 자동 저장을 매번 원격 파일 쓰기로 바꾸면 안 된다. 원격 반영은 별도 debounce와 실행, 캡처, 화면 이탈 시점에 묶어야 한다.

공식 참고:

- [Dropbox OAuth와 PKCE](https://developers.dropbox.com/oauth-guide)
- [Dropbox 변경 감지](https://developers.dropbox.com/detecting-changes-guide)
- [Dropbox 파일 metadata와 content hash](https://developers.dropbox.com/dbx-file-access-guide)
- [Dropbox JavaScript SDK](https://dropbox.github.io/dropbox-sdk-js/Dropbox.html)

### Google Drive

장점:

- `drive.file` scope로 앱이 만들었거나 사용자가 선택한 파일에만 접근할 수 있다.
- Changes API의 page token으로 변경과 삭제를 증분 수집할 수 있다.
- 임의 MIME의 코드, JSON, PNG, asset과 재개 가능한 업로드를 지원한다.
- file `version`, `modifiedTime`, checksum을 자체 충돌 판정에 사용할 수 있다.

제약:

- 경로보다 file ID와 parent ID가 중심이므로 폴더 이동, 중복 이름, 삭제 복구 구현이 Dropbox보다 복잡하다.
- 브라우저 token model의 access token은 짧게 유지되며 만료 후 사용자 동작으로 다시 요청해야 한다.
- appDataFolder를 사용하면 앱 데이터는 숨겨지지만 사용자가 일반 Drive 폴더에서 직접 읽을 수 없다. 사용자 가시성을 원하면 일반 폴더와 `drive.file`을 사용해야 한다.

공식 참고:

- [Google Drive API scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Drive Changes API](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list)
- [Google Drive 업로드](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)

### GitHub

장점:

- 원본과 revision을 실제 텍스트 파일로 읽고 diff와 commit 이력을 활용할 수 있다.
- Contents API는 기존 파일 갱신에 blob SHA를 요구하며 불일치 시 `409 Conflict`를 반환한다.
- 코드와 manifest의 장기 보존, 외부 편집, 수동 복구가 쉽다.

제약:

- draft 자동 저장을 모두 commit으로 만들 수 없으므로 성공 revision이나 명시적 동기화 단위로 묶어야 한다.
- 변경되는 PNG를 계속 commit하면 저장소 이력이 커지고 모바일 동기화 비용이 증가한다.
- Contents API는 100MB보다 큰 파일을 지원하지 않고 한 디렉터리 조회에도 제한이 있다.
- 정적 PWA는 OAuth token을 서버만큼 안전하게 보관할 수 없으며 인증 UX가 Dropbox나 Google보다 개발자 중심이다.

권고:

- 기본 원격 저장소보다 선택형 code/metadata mirror로 사용한다.
- mirror에서는 original, revision text, project manifest를 우선하고 capture와 asset은 크기 정책을 별도로 둔다.

공식 참고:

- [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents)
- [GitHub OAuth 앱 인증](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub OAuth 보안 권고](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app)

### iCloud Drive와 CloudKit

iCloud Drive와 CloudKit은 같은 대상이 아니다.

- CloudKit JS는 웹 앱이 Apple 앱 컨테이너의 public/private database를 사용하는 API다. 이는 Supabase와 같은 앱 데이터 백엔드에 가깝다.
- 사용자가 Files 앱에서 보는 iCloud Drive 디렉터리 접근은 네이티브 iOS에서 document picker와 security-scoped URL로 제공된다.
- 현재 순수 PWA가 iCloud Drive 폴더를 지속적인 자동 동기화 대상으로 유지할 수 있는 공식 웹 경로는 확인되지 않았다.

따라서 iCloud Drive는 SwiftUI/WKWebView 셸이 실제로 필요해질 때 다시 평가하고, CloudKit은 Apple 생태계 종속을 받아들이는 별도 백엔드 후보로만 둔다.

공식 참고:

- [CloudKit JS](https://developer.apple.com/documentation/cloudkitjs)
- [iOS 디렉터리 접근](https://developer.apple.com/documentation/uikit/providing-access-to-directories)

### Notion

장점:

- 프로젝트 제목, 태그, 메모, 출처 URL, 프로필, 대표 이미지와 외부 파일 링크를 읽기 좋은 데이터베이스로 정리할 수 있다.
- 사람이 탐색하고 주석을 남기는 보조 카탈로그로 유용하다.

제약:

- rich text 객체의 text content는 2,000자, 요청은 최대 500KB와 1,000 block 제한이 있어 긴 코드와 여러 revision을 원형 그대로 다루려면 분할 로직이 필요하다.
- 평균 요청 제한이 초당 3회이므로 편집 자동 저장 대상으로 부적합하다.
- public OAuth는 client secret을 사용하는 서버 측 code exchange가 필요하므로 GitHub Pages만으로 안전하게 연결할 수 없다.

권고:

- 원본 저장소로 사용하지 않는다.
- 선택적으로 프로젝트 요약과 Dropbox, Drive, GitHub 원본 링크를 발행하는 adapter만 고려한다.

공식 참고:

- [Notion API 요청 제한](https://developers.notion.com/reference/request-limits)
- [Notion public OAuth 연결](https://developers.notion.com/guides/get-started/public-connections)

## 제안하는 서비스 독립 저장 형식

원격 서비스를 선택하기 전에 아래와 같은 읽을 수 있는 `Fieldnote Vault v1`을 정의한다.

```text
Fieldnote/
  vault.json
  projects/
    {project-id}/
      project.json
      original/
        source.txt
        metadata.json
      revisions/
        {revision-id}.txt
        {revision-id}.json
      captures/
        {capture-id}.png
        {capture-id}.json
      assets/
        {asset-id}/...
```

규칙:

- original과 revision 파일은 생성 후 수정하지 않는다.
- `project.json`은 현재 head, 제목, 태그, 메모, 대표 capture 같은 가변 projection만 가진다.
- global index 하나에 모든 변경을 몰지 않는다. provider change cursor에서 project별 manifest를 갱신한다.
- 원격 객체마다 provider의 `rev`, version, SHA 또는 ETag에 해당하는 토큰을 로컬 sync metadata에 저장한다.
- 조건부 쓰기가 실패하면 기존 revision과 새 revision을 모두 유지하고 conflict inbox에 넣는다.
- capture와 asset은 metadata와 별도 queue로 전송하고 필요 시 지연 다운로드한다.
- ZIP archive와 Vault는 같은 도메인 serializer를 공유하되 서로 다른 format version을 가진다.

## 제안하는 adapter 경계

현재 `SyncAdapter`를 즉시 제거하지 않는다. 다음 검증에서는 서비스별 API 차이를 숨기는 상위 경계를 먼저 정의한다.

```ts
interface RemoteStorageAdapter {
  readonly provider: 'dropbox' | 'google-drive' | 'github' | 'supabase';
  connect(): Promise<void>;
  listChanges(cursor?: string): Promise<RemoteChangePage>;
  readObject(key: string): Promise<RemoteObject | undefined>;
  writeObject(input: RemoteWrite, expectedVersion?: string): Promise<RemoteObjectVersion>;
  deleteObject(key: string, expectedVersion?: string): Promise<void>;
  getQuota?(): Promise<RemoteQuota>;
}
```

별도 `VaultCodec`가 도메인 record와 파일을 직렬화한다. provider adapter는 프로젝트 의미를 해석하지 않고 인증, 변경 조회, 조건부 파일 읽기·쓰기만 담당한다.

## 선택을 위한 기술 검증

Dropbox를 첫 파일형 후보, Google Drive를 두 번째 후보로 검증한다. Supabase 기존 구현은 비교 기준으로 유지한다.

각 후보에서 동일하게 확인할 항목:

1. GitHub Pages PWA에서 secret을 번들하지 않고 연결할 수 있다.
2. 프로젝트 20개와 PNG 100개를 올리고 빈 IndexedDB의 새 기기에서 복원한다.
3. 기기 A와 B를 오프라인으로 만든 뒤 같은 project head를 수정한다.
4. 재연결 후 어느 revision도 잃지 않고 conflict를 감지한다.
5. PNG 업로드를 중간에 실패시켜도 text metadata가 계속 동기화된다.
6. access token 만료, 앱 완전 종료, 네트워크 전환 뒤 재연결 UX를 기록한다.
7. 공급자 화면에서 파일을 직접 수정, 이동, 삭제했을 때 다음 pull 결과를 기록한다.
8. 저장 자료를 공급자 도구만으로 내려받아 사람이 읽고 복구할 수 있는지 확인한다.
9. 요청 수, 전송량, 저장 용량과 예상 비용을 비교한다.

## 현재 결정

- Supabase는 확정 백엔드가 아니라 기존 구현이 있는 **앱형 후보**로 유지한다.
- Dropbox는 **파일형 1순위 기술 검증 후보**다.
- Google Drive는 **파일형 2순위 기술 검증 후보**다.
- GitHub는 **선택형 코드·metadata mirror** 후보로 둔다.
- Notion은 **선택형 카탈로그·발행 adapter** 후보로 둔다.
- iCloud Drive는 **네이티브 셸 도입 시 재검토**한다.
- provider를 선택하기 전에는 기존 Supabase migration을 실제 운영 데이터에 적용하지 않는다.

최종 선택 기준:

- 파일 소유권, 가시성, 이식성이 가장 중요하면 Dropbox 또는 Google Drive를 선택한다.
- 재로그인 없는 자동 동기화, 서버 검색, 명시적인 RLS와 확장이 가장 중요하면 Supabase를 선택한다.
- 선택 결과와 무관하게 로컬 Dexie, 불변 원본, append-only revision, provider-neutral Vault 형식은 유지한다.

## Supabase를 선택할 경우 선행 수정

현재 구현을 운영하기 전에 다음 문제를 해결한다.

- magic-link 복귀 URL에 GitHub Pages의 `/creative_coding_notebook/` base path를 포함한다.
- 동일 `clientMutationId` 재전송 시 현재 project revision이 아니라 mutation receipt에 저장된 적용 revision을 반환한다.
- 초기 full pull, 단조 증가 change cursor, tombstone pull을 추가한다.
- Realtime은 authoritative log가 아니라 cursor pull을 깨우는 신호로만 사용한다.
- media download cache와 orphan object 정리 정책을 구현한다.
- 실제 원격 프로젝트에서 grants, RLS, private Storage negative test를 실행한다.

