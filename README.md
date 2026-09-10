# KU Settle

KU Settle은 고려대학교 외국인 학생이 입국 준비부터 귀국까지 해야 할 일을 단계별로 확인하고 실행 화면으로 이동할 수 있는 Next.js 서비스입니다. Guest/Demo 화면은 정적으로 동작하고, 계정·동기화·Marketplace·Kakao 검색은 서버 API와 Supabase를 사용합니다.

> **Information → Action: 입국부터 귀국까지 이어지는 유학생 lifecycle 온보딩**

English, 한국어, 日本語, 简体中文을 지원합니다. Supabase가 설정되지 않은 환경에서는 기존 Guest/Demo 발표 시나리오가 그대로 동작하고, 설정된 환경에서는 고려대 이메일 OTP 계정과 기기 간 데이터 동기화를 사용합니다.

## 주요 기능

- 4단계 lifecycle: Before Arrival, First Weeks, Campus Life, Departure
- 사용자 이름·입국 예정일·기숙사/교외 거주 유형에 맞춘 18개 활성 작업
- 전체·단계별 진행률과 첫 번째 미완료 작업 자동 추천
- HiKorea·KU 공식 안내, Local Guide 필터, Marketplace 모드로 이어지는 action
- 입국 학생 상품 탐색 및 출국 학생 상품 등록 데모
- Guest/Demo의 명시적인 데모 인증과 실제 사용자의 Supabase 6자리 이메일 OTP 인증을 분리
- 실제 사용자의 프로필·진행률·상품은 Postgres와 RLS로 보호하고 Guest/Demo 상태는 `localStorage`에 저장
- 사용자가 확인한 경우에만 기존 개인화 Guest 데이터를 계정으로 가져오는 멱등 import
- 실제 상품 등록·판매 완료·숨김·삭제와 본인 소유권 검증
- Reset demo 실행 시 언어를 제외한 데모 상태만 초기화
- 320px 모바일부터 데스크톱까지 대응하는 CJK 안전 반응형 UI

## 다국어 구조

`i18next`와 `react-i18next`를 사용하며 번역 리소스는 빌드 결과물에 정적으로 포함됩니다. 서버 요청이나 번역 API는 없습니다.

지원 locale:

- `en` — English, 기본 fallback
- `ko` — 한국어
- `ja` — 日本語
- `zh-CN` — 简体中文

언어 결정 우선순위는 URL `?lang=` → `ku-settle-language` 저장값 → 브라우저 언어 → 영어입니다. 기존 `en`·`ko` 저장값은 그대로 사용하며, `zh`, `zh-SG`, `zh-Hans`는 `zh-CN`으로 정규화합니다. 공유 URL 예시는 `/?lang=ja`입니다. 이후 `zh-TW` 리소스를 같은 구조로 추가할 수 있습니다.

번역 파일은 다음 12개 namespace의 동일한 키 구조를 가집니다.

- `common`
- `navigation`
- `home`
- `onboarding`
- `marketplace`
- `localGuide`
- `verification`
- `profile`
- `reset`
- `validation`
- `errors`
- `accessibility`

Lifecycle, 상품, 장소 데이터에는 번역문 대신 `titleKey`, `descriptionKey`, `categoryKey`, `preparationKeys`, `practicalNoteKey`, `actionLabelKey` 같은 키와 언어 중립적인 숫자·상태 값만 저장합니다. 날짜, 숫자, 진행률, KRW 가격은 렌더링 시 표준 `Intl` API로 현지화합니다.

> 일본어와 중국어는 프로토타입 수준의 자연스러운 UI 번역을 완료했지만, 실제 출시 전에는 행정·의료 문맥을 포함해 원어민 검수를 진행해야 합니다. 이 메모는 개발 문서용이며 화면에는 표시되지 않습니다.

## 기술 스택

- Next.js 16 App Router + React 19 + TypeScript
- i18next + react-i18next
- Tailwind CSS 4 및 프로젝트 전용 CSS
- lucide-react
- Next.js Static Export (`output: "export"`)
- Supabase Auth, Postgres RLS, Edge Functions
- Vitest와 pgTAP

## 로컬 실행 방법

Node.js 22 이상과 pnpm 10 이상을 권장합니다.

```bash
pnpm install
pnpm dev
```

[http://localhost:3000](http://localhost:3000)을 엽니다. 프로덕션 정적 빌드는 다음 명령으로 확인합니다.

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

정적 결과물은 `out/`에 생성됩니다.

## Vercel 배포 방법

1. GitHub 저장소에 변경사항을 push합니다.
2. Vercel에서 **Add New → Project**를 선택하고 저장소를 Import합니다.
3. Framework Preset이 **Next.js**인지 확인합니다.
4. Guest/Demo만 배포하려면 환경 변수 없이 배포합니다. 계정·동기화·Marketplace를 켤 때는 아래 변수를 Vercel **Production** 환경에 설정합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
ACCOUNT_SIGNUP_ENABLED
ADMIN_API_TOKEN
KAKAO_REST_API_KEY
NEXT_PUBLIC_KAKAO_JS_KEY
KAKAO_MONTHLY_CALL_LIMIT
PILOT_CLOSED_DATES
```

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_TOKEN`, `KAKAO_REST_API_KEY`는 서버 전용입니다. 브라우저에 노출되는 `NEXT_PUBLIC_*` 값과 섞어 공개하지 않습니다. `ACCOUNT_SIGNUP_ENABLED=false`이면 신규 가입은 닫히고 기존 인증 흐름만 유지됩니다. `main`에 push하면 연결된 Vercel Production 배포가 자동으로 생성됩니다.

현재 저장소가 Vercel 프로젝트와 연결되어 있다면 `main` push 뒤 자동으로 새 Production Deployment가 생성됩니다. `next.config.ts`에는 보안 헤더가 포함되어 있으며, `/api/*` 서버 라우트가 동작하므로 Vercel의 Next.js preset을 사용합니다.

## 다른 컴퓨터에서 접속하는 방법

Vercel이 제공하는 `https://프로젝트명.vercel.app` URL을 공유하면 일반 Chrome, Edge, Safari에서 별도 설치 없이 열 수 있습니다. 선택 언어가 포함된 `?lang=ko`, `?lang=ja`, `?lang=zh-CN` URL도 공유할 수 있습니다.

같은 Wi-Fi에서 개발 화면을 확인하려면 다음 명령을 사용하고 터미널의 Network 주소를 엽니다.

```bash
pnpm dev:network
```

## 프로젝트 구조

```text
app/
├─ data.ts                  # 언어 중립 lifecycle·상품·장소 데이터
├─ i18n/
│  ├─ config.ts             # i18next 설정과 영어 fallback
│  ├─ formatters.ts         # Intl 날짜·숫자·통화·거리 formatter
│  ├─ types.ts              # locale 정규화·감지
│  ├─ use-app-i18n.ts       # URL·localStorage·document 동기화
│  └─ locales/              # en, ko, ja, zh-CN JSON 리소스
├─ lib/                     # Supabase client, repository, validation·migration
├─ page.tsx                 # Guest/Demo/Auth 화면과 접근 가능한 모달
├─ globals.css              # 디자인 시스템과 CJK 반응형 스타일
└─ layout.tsx               # 메타데이터와 루트 레이아웃
scripts/
└─ validate-i18n.mjs        # 키 일치·빈 값·fallback·locale 감지 검사
supabase/
├─ migrations/              # schema, trigger, constraints, RLS policies
├─ functions/               # signed email hook, self-service account deletion
├─ tests/                   # pgTAP tenant isolation and security tests
├─ config.toml              # local Auth, 6-digit OTP, 10-minute expiry, Mailpit
└─ seed.sql                 # local-only security test users; no Alex data
tests/
└─ domain.test.ts           # email, validation, migration, error and email-template tests
```

## Supabase 로컬 개발

Docker Desktop이 실행 중이어야 합니다. CLI는 프로젝트 dev dependency이므로 전역 설치가 필요 없습니다.

```bash
pnpm install
pnpm supabase:start
pnpm supabase:reset
pnpm test:db
```

`pnpm supabase:start`가 표시하는 API URL과 publishable/anon key를 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`에 넣습니다. 로컬 OTP 이메일은 Supabase가 제공하는 Mailpit UI에서 확인합니다. 실제 Resend 발송은 로컬 기본 흐름에 사용하지 않습니다.

전체 로컬 검증:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:db
```

## 원격 Supabase와 이메일 설정

1. Supabase 프로젝트를 만든 뒤 `supabase link --project-ref <ref>`로 연결합니다.
2. `supabase db push`로 검증된 migration을 적용합니다.
3. Dashboard의 Site URL과 Redirect allowlist에 실제 Vercel URL을 등록합니다.
4. 이메일 OTP를 6자리, 만료 600초로 설정하고 `private.before_user_created`를 Before User Created Hook으로 활성화합니다.
5. Resend에서 발신 도메인을 검증한 뒤 Edge Function secret `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`, `AUTH_EMAIL_REPLY_TO`, `APP_URL`을 설정합니다.
6. `send-email`을 배포하고 Standard Webhooks secret과 일치하는 Send Email Hook을 활성화합니다.
7. `delete-account`를 JWT 검증이 켜진 상태로 배포합니다.
8. 마지막으로 Vercel에 공개 변수 두 개만 설정합니다. service-role key와 Edge Function secret은 Vercel 클라이언트 환경에 넣지 않습니다.

실제 원격 적용 전에는 pgTAP, Auth OTP, 네 언어 이메일, 계정 삭제 cascade를 별도 staging 프로젝트에서 확인하세요. `.env.example`은 변수명만 제공하며 실제 secret은 커밋하지 않습니다.

### 운영 전 체크

- Dashboard에서 모든 `supabase/migrations/*.sql`을 순서대로 적용하고, 각 공개 테이블의 RLS가 켜져 있는지 확인합니다. 저장소의 정책 테스트(`supabase/tests/rls.test.sql`)는 원격 Dashboard 상태를 자동으로 보증하지 않습니다.
- Supabase 프로젝트의 일일 백업과 PITR 보존 기간을 확인하고, 운영 배포 전 복구 리허설을 한 번 수행합니다.
- 화면의 Sample 상품은 실제 거래 대상이 아니며, 실제 등록 상품과 별도 배지로 구분합니다. 행정·의료·법률 정보는 화면의 확인일보다 공식 출처를 최종 기준으로 안내합니다.
- Kakao 검색은 서버에서만 REST 키를 사용하고 월간 호출 상한(`KAKAO_MONTHLY_CALL_LIMIT`, 기본 2,900,000)을 둡니다. 운영에서는 Kakao 개발자 콘솔의 실제 사용량·도메인 제한·쿼터 알림을 함께 확인합니다.
- 문의·신고·운영 변경은 관리자 화면과 `support_tickets`/`guest_reports` 기록을 기준으로 처리하고, 배포 후 첫 주에는 오류 로그와 API 응답을 매일 확인합니다.

## 앱 상태와 localStorage

앱 상태는 다음처럼 분리됩니다.

- `guest`: 계정 없이 기기 내 lifecycle을 체험합니다. 실제 Marketplace DB에는 쓸 수 없습니다.
- `demo`: 사용자가 **Try demo**를 선택했을 때만 Alex preset을 사용하며 모든 변경은 로컬에만 남습니다.
- `authenticated`: 유효한 Supabase 세션과 정확한 `@korea.ac.kr` 이메일을 사용하며 DB가 source of truth입니다.

현재 저장 키:

- `ku-settle-profile`: 이름, 입국 예정일, 주거 유형, 데모 여부
- `ku-settle-checklist`: 완료 작업 ID 배열
- `ku-settle-verified`: Demo 전용 legacy 인증 상태이며 실제 인증 판정에는 사용하지 않음
- `ku-settle-user-products`: 사용자가 등록한 언어 중립 상품 데이터
- `ku-settle-language`: 선택 locale

인증 사용자는 언어와 안전한 UI 상태, Supabase SDK가 관리하는 세션 외의 서비스 데이터를 localStorage의 source of truth로 사용하지 않습니다. 기존 개인화 Guest 데이터는 로그인 직후 요약 모달에서 사용자가 확인한 경우에만 가져오며, Alex Demo 데이터는 가져오지 않습니다.

## 데모 한계

- Supabase를 설정하지 않으면 계정과 실제 이메일 발송은 비활성화되고 Guest/Demo만 동작합니다.
- 학교 SSO, 결제, 예약, 실제 채팅, 배송, 지도, 푸시 알림은 없습니다.
- Sample 상품과 장소는 계속 정적 데모 데이터이며 DB 실제 상품과 UI에서 구분됩니다.
- 행정·비자·법률·의료 요건은 변경될 수 있으므로 화면에서도 공식 출처 확인을 안내합니다.
- Marketplace 인증은 실제 인증이 아닌 발표용 형식 검증입니다.
- 일본어·중국어는 출시 전 원어민 및 도메인 전문가 검수가 필요합니다.
