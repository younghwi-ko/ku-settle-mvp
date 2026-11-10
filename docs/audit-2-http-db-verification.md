# 감사 2번 후속: REST 401 원인과 실제 HTTP → DB 검증

2026-11-10, `ponytail full` 적용 후 `ponytail-review`로 검토했다. 대상은 격리 프로젝트 `nlzcikoxttenpcflikpd`와 로컬 앱뿐이다. 운영 프로젝트 연결·SQL·설정 변경, main 푸시·배포는 하지 않았다. 기존 예약 수정안은 보존했으며 **이번 후속 작업에서 서비스 코드는 변경하지 않았다.**

## 401은 키 폐기·불일치 문제가 아니었다

키 내용 대신 종류, 프로젝트 일치 여부, HTTP 상태·안전한 오류만 확인했다. `.env.local`도 수정하지 않았다.

| 요청/확인 | 실제 결과 | 해석 |
| --- | --- | --- |
| URL/ref | HTTPS URL의 ref와 `INTEGRATION_SUPABASE_PROJECT_REF`가 테스트 ref와 일치 | 운영 URL을 대체로 사용하지 않음 |
| 공개 키 종류 | `sb_publishable_` 형식, 앞뒤 공백·비 ASCII 문자 없음 | opaque 키이므로 문자열에서 ref를 추정하지 않음 |
| publishable key → `/auth/v1/settings` | HTTP 200 | 이 프로젝트에서 실제로 승인된 키임을 확인 |
| 키 없음·잘못된 대조 키 → 같은 Auth 설정 | 각각 HTTP 401 | 해당 엔드포인트가 무조건 공개 200을 반환한 것이 아님 |
| publishable key → `/rest/v1/` | HTTP 401, `Secret API key required`, `Only secret API keys can be used for this endpoint.` | REST 루트는 이 환경에서 공개 키용 연결 확인 경로가 아님 |
| publishable key → `/rest/v1/guest_reservations?select=id&limit=0` | HTTP 401, SQLSTATE `42501`, `permission denied for table guest_reservations` | `anon`의 테이블 권한을 회수한 기존 보호 정책에 따른 거부 |
| 서버 키 종류·JWT | legacy `service_role` JWT, ref 일치·미만료 | decode 확인만으로 유효하다고 단정하지 않음 |
| 서버 키 → REST 루트, Auth 설정 | 각각 HTTP 200 | 실제 서버 키 승인 확인 |
| 설치된 SDK → 예약 테이블 HEAD | 서버 키 200, 공개 키 401 | 서버 API를 통하는 기존 구조와 일치 |
| SDK의 실제 요청 헤더 | `apikey`가 서버 키와 일치, `Authorization`이 해당 JWT의 Bearer와 일치 | 값 자체는 출력하지 않고 비교 결과만 확인 |

`serverClient()`는 서버 전용 키와 세션 저장/자동 갱신을 끈 Supabase SDK를 사용한다. 브라우저 클라이언트는 publishable key를 사용한다. 익명 예약 데이터의 보호는 KU Settle 서버 API의 쿠키·소유권·관리자 인증과 service-role-only RPC가 담당한다. 공개 키로 guest 테이블을 직접 읽게 할 필요가 없다. [Supabase 공식 키 문서](https://supabase.com/docs/guides/api/api-keys)도 키가 매핑되는 DB 역할과 table grant/RLS를 구분한다.

이전 [DB 검증 보고서](audit-2-reservation-transactions.md)의 “REST 401 원인 미확인”은 그 실행 당시의 상태다. 이번 조사에서 위 두 원인을 구분했으며, 키 폐기·재발급이나 grant 추가는 필요하지 않았다. 응답의 GRANT 제안도 실행하지 않았다.

## 실행 방법과 안전 경계

```powershell
$env:TEST_DB_CA_FILE='<다운로드한 Supabase CA 인증서의 절대 경로>'
pnpm run test:reservation:http
```

필수 로컬 변수는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `INTEGRATION_SUPABASE_PROJECT_REF`, `INTEGRATION_TEST_MODE=true`다. 이번 실행은 기존 값을 그대로 사용했다. 키를 재입력할 필요가 생기면 테스트 프로젝트 대시보드의 값을 로컬 `.env.local`에서 직접 편집하고, 채팅·명령행 인자·로그·커밋으로 전달하지 않는다. 서버 키는 `NEXT_PUBLIC_` 변수에 넣지 않는다.

러너는 승인된 테스트 ref·정확한 HTTPS URL·현재 사용 중인 legacy 서버 JWT의 ref/role/만료를 검사하고, 검증된 CA를 사용해 직접 DB를 조회한다. 임의 원격 앱/DB 주소는 받지 않는다. 해당 로컬 포트에 이미 앱이 실행 중이면 종료한다.

그 후 로컬 `127.0.0.1:3102` 앱을 자식 프로세스로 시작하고 **브라우저 진입·세션 생성·관리자 인증 전에** 동일 origin의 `/api/integration/environment/`가 200, `isolated:true`, 정확한 ref를 반환하는지 확인한다. 브라우저의 외부 요청은 차단하지만 API 응답은 가로채거나 모킹하지 않는다. HTTP 러너도 동일 origin·리디렉션 거부를 유지한다.

관리자 토큰과 오류 주입 비밀값은 매 실행 무작위로 생성해 자식 프로세스 환경에만 전달한다. 기존 `.env.local`의 비어 있는 관리자 토큰을 덮어쓰거나 인증을 우회하지 않는다. 이메일·가입은 이 자식 프로세스에서만 false로 두며 운영 설정은 바꾸지 않는다. 자식 프로세스 출력은 폐기해 비밀값을 포함한 로그가 생기지 않게 한다.

### 기존 데이터 보존

- 사전 조회로 기존 활성 예약이 20분 안에 만료될 수 있으면 앱을 시작하지 않는다. 전역 지연 만료가 기존 예약을 바꾸지 않도록 한다.
- 기존 관리자 rate-limit 행 11개는 자동 만료 정리 대상이었다. 테스트 전용 `pg_temp` 함수와 BEFORE DELETE 보호 트리거가 **그 기존 PK들의 자동 삭제만 건너뛰게** 했다. 새 요청의 rate-limit 카운트·인증·RLS·RPC grant는 그대로 동작한다. 기존 행의 시각·카운트가 변하지 않았음도 대조했다.
- 테스트의 세션·상품·예약은 실제 HTTP로 새로 생성한다. 만료 조건을 만들기 위해 **이번 예약 하나의 `expires_at`만** 직접 SQL로 과거로 설정하고, 이후 실제 앱 GET이 만료 RPC를 실행하는지 확인한다.
- 브라우저·앱을 종료한 뒤 이번 UUID 세션의 FK 데이터, 이번 관리자 actor의 감사 행, 이번 토큰/쿠키로 만든 rate-limit 키만 정리한다. 다른 행은 삭제하지 않는다. 보호 트리거의 제거와 잔여 행 0을 확인한 후 최종 통과를 출력한다.
- `next dev`가 생성한 `next-env.d.ts` 경로 변경만 원래 바이트로 복원한다. 예상하지 않은 파일 변경은 덮어쓰지 않고 실패로 보고한다. 기존 지침·스킬·감사 자료와 `.env.local`도 해시로 보존을 확인한다.

## 실제 검증 결과

`pnpm run test:reservation:http`를 실제 실행해 **exit 0**, 7개 그룹 통과와 정리 완료를 확인했다. 보호·생성 파일 보존 보완 후 재실행도 exit 0이었다.

| 그룹 | 실제 확인 |
| --- | --- |
| 격리 확인 | DB/ref/함수 확인과 동일 origin 앱의 격리 응답을 브라우저 진입 전에 확인 |
| 세션·관리자 인증 | 구매자·판매자·다른 사용자 세션 ID가 서로 다름. HttpOnly 쿠키. 잘못된 관리자 토큰 403·쿠키 없음, 정상 토큰 200·관리자 쿠키 생성 |
| 생성·재전송·권한 | 생성 201, 같은 키 재전송 200·같은 예약 ID. 타 세션 취소 403, 일반 사용자의 관리자 수정 401, 다른 판매자 상품 수정 거부. DB 상태 유지. 구매자 본인 조회·타 세션 제외·판매자 연관 예약 조회 |
| 실제 새로고침 | Chromium의 로컬 예약 배열을 비우고 실제 `page.reload()` 실행. 동일 쿠키로 서버 예약 ID·활성 상태 복구, 상세 `reserved` 표시 |
| 취소·관리자 종료 | 구매자/판매자 취소, 중복 취소, stale version 409, 관리자 완료. R1 soft-delete 중 활성 R2와 `reserved` 보존. HTTP의 status/version과 SQL의 실제 예약·상품 행 대조 |
| 지연 만료 | 실제 GET으로 `expired`·상품 `active` 전환. 같은 키 재전송도 종료된 예약을 활성으로 바꾸지 않음 |
| 종료 상태 복구 | 관리자 완료 후 실제 reload에서도 서버의 `completed` 상태 복구 |

첫 7개 그룹은 모의 HTTP가 아니다. 로컬 Next.js Route Handler → 실제 Supabase SDK/REST/RPC → 격리 PostgreSQL의 실행 결과다. SQL 직접 연결은 함수 대조·행 상태 확인·만료 fixture·정리에 사용했다. 이전 9개 그룹의 별도 연결 동시성 SQL 테스트와 이번 HTTP/브라우저 검증은 서로 다른 검증이다.

추가 검사도 이번에 실제 실행했다.

| 명령/점검 | 결과 |
| --- | --- |
| `pnpm test` | exit 0, 20개 파일·168개 테스트. 이 중 신규 러너 차단 3개는 잘못된 URL/ref/키에서 앱·DB 연결 전 exit 2가 되는 자식 프로세스 검사이며 실제 DB 테스트가 아님 |
| i18n (`pnpm test` 포함) | 8개 언어·13개 namespace·511 leaf key·572 inline phrase 통과 |
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0, 기존 `app/page.tsx` 경고 2개·오류 0개 |
| `git diff --check` | exit 0 |
| 정리 후 별도 읽기 확인 | 테스트 상품·감사 행·보호 트리거 각각 0, 기존 rate-limit 행 수 11 유지 |

서비스 코드가 달라지지 않아 이번 후속 작업에서는 프로덕션 빌드를 다시 실행하지 않았다. 앞선 수정안의 빌드 통과와 이번 실행 결과를 혼동하지 않는다. Supabase CLI 도움말 최초 확인은 샌드박스의 telemetry 임시 파일 권한 문제로 실패했으며, 권한을 갖춘 `migration repair --help` 재실행으로 설치 버전과 인자를 확인했다. 실제 repair 실행 결과로 세지 않는다.

## 함수 일치와 migration 이력 관리

두 함수의 본문을 현재 SQL 파일과 줄바꿈 정규화 후 비교했다. 인자 이름/타입/기본값, JSONB 반환형, `SECURITY INVOKER`, `search_path=public`, anon/authenticated EXECUTE 거부와 service_role 허용도 실제 카탈로그에서 확인했다.

- 파일: `supabase/migrations/202611100001_atomic_guest_reservations.sql`
- 정규화 파일 SHA256: `9f6134c39e62ce5e7b8a0973664c5a39fda57f4669fb24f9487fb5954e3d322f`
- 현재 격리 DB 함수: **일치**.
- `supabase_migrations.schema_migrations`의 해당 버전: **0건**.
- 로컬 migration 파일 중 격리 DB 이력에 없는 버전: **202611100001 하나**.

이전 작업에서 직접 SQL로 적용했기 때문에 함수는 존재하지만 CLI 이력은 없다. `migration list`는 버전 이력 비교이며 함수 본문의 동일성을 증명하지 않는다. 이번에는 migration 이력을 임의로 보정하지 않았다.

운영 적용 전 필요한 절차(이번에는 실행하지 않음):

1. 확정 SQL과 checksum을 검토하고 적용 대상을 다시 확인한다. 기존 migration 전체의 이력과 실제 객체 차이도 대조한다. 이력 없음만 보고 데이터 삭제·reset·전체 재실행하지 않는다.
2. 격리 프로젝트는 실제 함수/권한과 SQL 일치를 재확인한 뒤, 승인된 이력 보정 작업에서만 설치 CLI v2.116.0의 다음 명령으로 해당 버전을 applied로 기록할 수 있다. 비밀번호는 명령행에 넣지 않는다.

   ```text
   pnpm exec supabase migration repair 202611100001 --status applied --project-ref nlzcikoxttenpcflikpd
   ```

   이 명령은 **준비만 했고 실행하지 않았다**. 설치 CLI의 `--help`로 해당 인자들을 확인했다. `repair`는 SQL을 실행하는 명령이 아니라 이력을 바꾸는 명령이므로 함수 미설치·불일치 상태에서는 사용하면 안 된다. [공식 CLI 설명](https://supabase.com/docs/reference/cli/supabase-migration-repair)을 참고한다.
3. 운영은 별도 승인 후 대상 ref를 명시해 이력과 객체를 읽기 점검한다. SQL이 아직 없으면 읽기/쓰기 전환 계획에 따라 해당 migration을 적용하고 이력을 남긴다. 이미 직접 적용된 동일 SQL이면 증거를 남긴 뒤 이력 보정 여부를 판단한다. 테스트 프로젝트의 상태만 보고 운영 버전을 applied로 표시하지 않는다.
4. pending 목록·함수 정의·grant를 다시 확인하고 앱 전환한다. 구버전 쓰기와 새 RPC 쓰기를 동시에 허용하지 않는 순서와 복구 방안은 [예약 트랜잭션 보고서](audit-2-reservation-transactions.md)에 준비돼 있다.

## 재리뷰와 남은 범위

`ponytail-review`로 키/헤더 처리, 앱 시작 전 차단, 쿠키·관리자 검사, RPC 연결, 기존 데이터 자동 정리 위험, 실패 시 finally 정리, 파일 보존을 검토했다. 포트 선점 검사와 Next.js 생성 파일 보존을 보완하고 실제 검증을 재실행했다. 범위 내 남은 필수 수정 사항은 발견하지 못했다. 판정은 **격리 HTTP→DB 검증 완료, 운영 적용 보류**다.

이번 후속 변경은 테스트 러너·안전 차단 테스트·실행 명령·이 문서다. 새 서비스 기능, 인증/RLS/RPC 권한 변경, 키 교체는 없다. 실제 이메일/OTP 계정 로그인, 다른 기기의 계정 복구, 운영 부하·장시간 장애·실기기는 이번 통과 범위가 아니다. 공개 서비스는 아직 이전 코드이므로 감사 2번을 운영 해결로 표시하지 않는다.
