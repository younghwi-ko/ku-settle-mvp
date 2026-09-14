# 관리자 통합 테스트 준비 절차

이 절차는 운영 Supabase/Vercel과 분리된 테스트 프로젝트에서만 실행합니다. 운영 URL·키·토큰을 `.env.local`에 복사하거나 Vercel Production 환경변수를 교체하지 않습니다.

## 1. 격리 환경 준비

1. Supabase에서 별도 테스트 프로젝트를 만들거나, Docker가 설치된 개발 컴퓨터에서 이 저장소의 `supabase/` 프로젝트를 사용합니다.
2. 로컬 실행 시 `supabase start` 후 `supabase db reset`으로 마이그레이션과 `supabase/seed.sql`을 적용합니다. `seed.sql`의 `local-a@korea.ac.kr`와 `local-b@korea.ac.kr`는 테스트 전용 예시입니다.
3. 저장소 루트의 `.env.integration.example`을 참고해 `.env.local` 또는 현재 셸에 테스트 프로젝트 값만 입력합니다. 이 파일은 커밋하지 않습니다.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_API_TOKEN=
INTEGRATION_TEST_MODE=true
INTEGRATION_SUPABASE_PROJECT_REF=<isolated-project-ref>
INTEGRATION_TEST_SECRET=<test-only-secret>
ACCOUNT_SIGNUP_ENABLED=true
```

`SUPABASE_SERVICE_ROLE_KEY`와 `ADMIN_API_TOKEN`은 서버 전용이며 브라우저·로그·저장소에 노출하지 않습니다. 로컬 앱은 `pnpm dev`로 실행하고, 별도 테스트 브라우저 프로필을 사용합니다.

### Preview 환경 안전 확인

Preview에서 통합 테스트를 실행하려면 Vercel 프로젝트의 **Settings → Environment Variables**에서 Preview 범위의 `NEXT_PUBLIC_SUPABASE_URL`이 Production과 다른 테스트 프로젝트를 가리키는지 먼저 확인합니다. Preview에 Production URL 또는 동일한 프로젝트 ref가 보이면 테스트를 중단합니다. Vercel 대시보드에 로그인할 수 없거나 범위가 확인되지 않으면 Preview는 검증 대상에서 제외하고 로컬 환경만 사용합니다. 테스트 URL·키·토큰을 Production 범위에 추가하거나 기존 값을 교체하지 않습니다.

자동 러너는 `pnpm run test:integration`으로 실행합니다. 시작 전에 필수 값이 없으면 네트워크 요청 없이 필요한 변수 이름만 출력하고 종료합니다. 첫 쓰기 요청(`/api/session/bootstrap`) 전에 `/api/integration/environment`를 호출해 앱이 `INTEGRATION_TEST_MODE=true`이고 기대한 Supabase 프로젝트 ref를 사용한다고 증명했는지 확인합니다. 확인에 실패하면 쓰기 요청을 중단합니다. 원격으로 격리된 테스트 배포를 사용할 때만 다음 값을 현재 셸에 임시로 지정할 수 있습니다(파일에 저장하지 않음).

```text
TEST_BASE_URL=https://<isolated-preview-or-local-host>
TEST_SUPABASE_PROJECT_REF=<same-isolated-project-ref>
TEST_ADMIN_API_TOKEN=
TEST_OPERATOR_NAME=integration-test
TEST_INTEGRATION_SECRET=<same-test-only-secret>
```

브라우저 검증을 처음 준비할 때는 테스트 개발 환경에서만 `pnpm add -D playwright`와 `pnpm exec playwright install chromium`을 실행합니다. 브라우저 러너는 390×844 모바일 뷰포트에서 실제 UI를 열고, `/api/integration/faults`에 같은 origin·테스트 비밀값으로 1회 재조회 실패를 arm합니다. 이 endpoint와 fault 상태는 `INTEGRATION_TEST_MODE=true`인 비-Production 환경에서만 동작합니다.

러너는 테스트 전용 문의를 생성한 뒤 검증이 끝나면 관리자 API로 soft-delete하여 격리 DB를 정리합니다. 제목·본문·쿠키·토큰은 로그에 출력하지 않습니다. `temporary-fleet-maroon-2opm8kt.vercel.app`과 모든 `*.vercel.app` 주소는 운영 오접속 방지를 위해 차단하며, 원격 격리 호스트는 `TEST_ALLOW_REMOTE=true TEST_CONFIRM_ISOLATED=true`를 함께 지정해야 합니다.

## 2. 요청 검증 순서

- 관리자 인증: 올바른 토큰으로 `/api/admin/session`이 200과 관리자 쿠키를 반환하고 해당 `Set-Cookie`에 `HttpOnly`가 있는지 각각 확인한 뒤, 잘못된 토큰이 403이며 관리자 쿠키를 만들지 않는지 확인합니다. 토큰 자체는 출력하지 않습니다.
- 문의 처리: 테스트 세션에서 `/api/support-tickets`로 문의를 만들고 접수번호를 기록합니다. 관리자 세션에서 `/api/admin/tickets/{id}`를 PATCH한 후 사용자 세션의 GET과 새로고침에서 상태·답변을 확인합니다.
- 격리: 세션 A의 쿠키로 세션 B 문의를 조회하거나 수정할 수 없어야 합니다. 관리자 전용 PATCH를 일반 세션으로 호출하면 `admin_required`가 반환되어야 합니다.
- 동시성: 같은 문의의 이전 `version`으로 두 PATCH를 보내 하나는 성공하고 다른 하나는 `version_conflict`가 되는지 확인합니다.
- 오류: 테스트 서버에서 저장 요청 또는 후속 GET을 차단해 저장 실패와 재조회 실패가 서로 다른 오류로 표시되고, 실패 뒤 성공 배너가 남지 않는지 확인합니다.

자동 러너는 잘못된 상태 값(422)을 저장 검증 실패로 확인합니다. 후속 재조회 실패는 임의로 성공 처리하지 않도록 기본적으로 **SKIPPED**이며, 격리된 fault-injection 프록시를 준비한 경우에만 `TEST_REFETCH_FAILURE_URL=/api/...`를 지정해 동일 origin의 5xx 응답을 실제 요청으로 확인합니다. 브라우저 검증은 `pnpm run test:integration:browser`로 실행하며, 초기 문의 GET 완료를 기다린 뒤 fault endpoint를 arm합니다. 이후 실제 문의 POST가 201이고 후속 GET만 502인지 요청 순서로 확인하고, 화면의 오류·재시도·성공 배너 부재, 재시도 GET 200과 생성 문의 표시를 확인합니다.

실제 운영 문의·상품·예약 데이터에는 위 절차를 적용하지 않습니다. 테스트 결과와 쿠키/토큰 값은 로그에 남기지 않습니다.

## 3. 현재 실행 가능 범위

이 작업 환경에는 Docker와 실행 가능한 Supabase CLI가 없어 로컬 데이터베이스를 시작할 수 없고, 테스트 프로젝트 URL·서비스 키·관리자 토큰도 제공되지 않았습니다. 따라서 이 환경에서 `pnpm run test:integration`과 `pnpm run test:integration:browser`는 필수 변수 또는 브라우저 의존성 안내 후 종료됩니다. 위 환경변수를 격리 테스트 프로젝트에 설정하고 `pnpm dev`를 실행하면 동일한 러너로 실제 통합 테스트를 수행할 수 있습니다.
