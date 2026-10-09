# KU Settle

고려대학교 유학생이 여러 공식 사이트에 흩어진 정착 정보를 찾고 실제 준비로 이어 가기 어렵다는 문제에서 출발했습니다. 활동 당시 3인 팀이 함께 아이디어를 구체화하고 발표했으며, 이 단계에서는 MVP나 서비스 코드를 개발하지 않았습니다. 발표 이후에는 본인이 혼자 Codex를 활용해 MVP 개발과 웹 서비스 고도화를 진행하고, 입국부터 귀국까지의 개인화 체크리스트와 공식 출처 기반 생활 가이드를 연결했습니다. 개인 개발 단계에서 본인은 요구사항과 수정 우선순위를 정하고 공개 화면을 확인하며 오류를 제보했고, 코드 구현·수정·테스트·문서 작업에는 Codex를 활용했습니다. 2026-10-09에 테스트 83개, 8개 언어 키 검증, 타입체크와 빌드를 통과했고 린트에는 기존 경고 2개가 남았습니다. 현재 로그인 없이 계획·가이드·샘플 마켓을 시연할 수 있으며, 이메일 인증 운영 활성화와 상품·예약의 전체 서버 흐름 검증은 남아 있습니다.

KU Settle is a multilingual settlement companion for international students preparing for arrival, adapting to campus life, and planning departure from Korea University. It turns scattered information into a sequence of small, actionable decisions: check an official notice, save a route, prepare a document, or record a marketplace request.

The idea was developed and presented by a three-person team, focusing on the gap between “knowing what information exists” and “being able to act on it.” No MVP or service code was developed during that team activity. After the presentation, I independently developed the MVP and refined the web service using Codex. The web service format makes the idea testable: a student can choose a lifecycle stage, open the relevant guide, record progress, and follow a link to the next action.

## Project Overview

- **Problem observed:** international students must combine university notices, immigration guidance, transport information, housing instructions, and everyday decisions across different sites and languages. The difficult part is often the next action, not the existence of information.
- **Team idea and presentation stage:** three people worked together to develop the idea and deliver the presentation. This stage did not include MVP development or service coding.
- **Individual MVP development and refinement stage:** after the presentation, I used that shared idea as the basis for independently developing the MVP and refining the web service, with Codex assisting implementation and verification.
- **Product direction:** connect official-source guidance, a personalized checklist, local campus guidance, and a clearly labelled sample/live marketplace in one flow.
- **Current scope:** a public Guest/Demo experience is available without an account. Supabase-backed account, marketplace, support, and operator flows exist in the codebase but remain subject to provider, environment, and operational verification.
- **Languages:** 8 configured locales — English (`en`), 한국어 (`ko`), 日本語 (`ja`), 简体中文 (`zh-CN`), O‘zbekcha (`uz`), Tiếng Việt (`vi`), Монгол (`mn`), Bahasa Melayu (`ms`).

## My Contribution

### Team idea and presentation stage

I participated in the three-person team that developed the idea and delivered the presentation. The team did not develop an MVP or service code during this stage.

### Individual MVP development and refinement stage

After the presentation, I carried out the MVP development and web service refinement independently, building on the team's shared idea. Codex was the only AI tool used in this development stage.

- **My product decisions:** I specified the lifecycle and personalization requirements, prioritized fixes, requested official-source guidance and accurate completion criteria, and decided to keep email delivery disabled until the domain and provider were configured.
- **My review and feedback:** I checked the public screens, reported reproducible problems such as setup reopening and ARC progress mismatches, and supplied error messages that guided subsequent fixes.
- **Codex-assisted implementation:** I used Codex to inspect and edit the code, prepare UI and multilingual content, implement persistence and API flows, investigate errors, write tests, and prepare documentation. The code and test execution described here were assisted by Codex.
- **Verification evidence:** the executed checks and their limits are recorded in [Verification](#verification). A passing unit test, an API implementation, and a successfully operated account or transaction are reported separately.

## Key Features

### Publicly usable without login

- Guest lifecycle home with four stages: Before Arrival, First Weeks, Campus Life, and Departure.
- Personalized setup for name, arrival phase, study track, housing, arrival date, and optional departure date.
- Checklist progress, important-task recommendations, due-date notes, and local browser persistence.
- Life Guide cards with official-source links, applicability, steps, preparation items, contact guidance, completion criteria, and source status.
- Campus/local guidance with curated records and optional Kakao search configuration; place cards can open external Google Maps search/directions links.
- Marketplace browsing with explicitly marked Sample data, a listing form, shareable listing URLs, and mobile-responsive screens. The form's storage destination depends on session/server availability, as detailed below.

### Marketplace storage and authentication boundaries

| Path | Source behavior | Verification boundary |
| --- | --- | --- |
| Local experience | When the anonymous server connection is unavailable, Guest/Demo listings are retained in browser storage and marked as Sample. Reservation state also has a local browser representation. Built-in and local Sample detail screens do not offer a real reservation action. | Local state is tied to that browser. Sample content is not real inventory, and a local record is not proof of a server reservation. |
| Anonymous session with server storage | After session bootstrap and state loading succeed, Guest/Demo listing creation calls `/api/marketplace/listings`, which inserts into `guest_listings` with `session_id`. For server-backed user-created listings, reservation requests call `/api/marketplace/listings/[id]/reservations` and write `guest_reservations`. Ownership is scoped by the HttpOnly session cookie. | These routes use an anonymous session rather than email verification. The listing GET route does not require a verified-student account. Cookie loss does not provide automatic cross-device recovery. This documentation pass inspected the code without creating production listings or reservations. |
| Authenticated account | Supabase-authenticated users create and update their listings through `marketplace_items` with user ownership and RLS. Explicit import/claim paths exist for local and anonymous-session data. | Email delivery and public signup remain disabled. Account login, import/claim, recovery, and reservation interoperability across the account and anonymous tables require isolated end-to-end verification. |

The current reservation UI updates local state before the server request resolves. A server failure can therefore leave a local reservation or saved notice visible; it is not a confirmed server reservation. The account listing and anonymous reservation paths also use different tables. This README does not claim that authenticated-account transactions or server failure recovery have been fully validated. Source references: [UI branches](app/page.tsx), [anonymous-session API](app/lib/server-session.ts), [listing API](app/api/marketplace/listings/route.ts), [reservation API](app/api/marketplace/listings/[id]/reservations/route.ts), and [account repository](app/lib/repository.ts).

### Implemented but operationally inactive or not fully verified

- Supabase email OTP/login code and localized email templates are implemented. Production email delivery is intentionally disabled while the sender domain, Resend credentials, and Send Email Hook are not verified.
- Production Supabase signup is disabled with `disable_signup=true`; the app-side `ACCOUNT_SIGNUP_ENABLED=false` flag is a separate UI/API gate, not a replacement for Supabase Auth enforcement.
- Supabase-backed profiles, lifecycle progress, live listings, reservations, service requests, support tickets, operator updates, RLS policies, and Edge Function sources exist. A production-grade operator workflow and isolated end-to-end DB test environment still require explicit external setup.
- `send-email` Edge Function source exists. The current production endpoint responds HTTP 500 with an email configuration error; the Send Email Hook is not enabled and no real email is sent.
- Admin APIs and integration runners are present, but tests that require a dedicated test Supabase, admin token, browser runner, or fault-injection environment are not represented as passed by the unit suite.

### Future plans

- Verify an email sender domain and Resend/Auth Hook configuration before enabling delivery.
- Complete an isolated remote or local Supabase integration environment and repeat HTTP/browser tests with disposable data.
- Establish operator ownership, response policy, and review procedures before treating support or service-request handling as a live service.
- Consider provider booking, payment, delivery/storage fulfillment, and external messaging only after policy, vendors, and data-protection requirements are decided.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript
- i18next and react-i18next with 8 locale resources and English fallback
- Tailwind CSS 4, project CSS, and lucide-react icons
- Supabase Auth, Postgres, RLS, and Edge Functions
- Kakao Local API integration code (server-side REST key, quota guard) and external Google Maps links
- Vitest, Playwright runner support, pgTAP SQL tests, ESLint, TypeScript, pnpm
- Vercel Next.js deployment using `pnpm install --frozen-lockfile` and `pnpm build`

This is a server-backed Next.js deployment. `next.config.ts` does not enable `output: "export"`; there is no supported `out/` static-export workflow. API routes, Auth, RLS, and Edge Functions are part of the deployed architecture.

## Demo & Screenshots

- Public demo: [temporary-fleet-maroon-2opm8kt.vercel.app](https://temporary-fleet-maroon-2opm8kt.vercel.app/?lang=ko)

Login-free demo sequence:

1. Open the public link with `?lang=ko`.
2. Choose **나중에 설정** if the setup dialog appears, or open **라이프사이클** to inspect the checklist.
3. Open **생활 가이드** and select **ARC 최신 안내 확인** to view source status, steps, and progress fields.
4. Open **캠퍼스 마켓** to inspect Sample labels and a sample detail's `listing=` URL. Sample inventory is not available for real reservations. The listing form may save to the anonymous-session server, so browsing is the submission demo; do not submit a listing just to demonstrate the screen.

Screenshots below were captured from the public demo on 2026-10-09. They contain no account credentials, tokens, or user records.
The ARC screenshot shows the expanded detail card, including progress controls, steps, and completion criteria. Its capture blocked server API requests to prevent session/data writes; it verifies presentation, not server persistence or official-content freshness.

![KU Settle home](docs/screenshots/home-ko.png)

![Personalized lifecycle checklist](docs/screenshots/checklist-ko.png)

![Expanded ARC guide: applicability, completion criteria, progress controls, steps, and preparation](docs/screenshots/guide-arc-ko.png)

![Campus marketplace](docs/screenshots/marketplace-ko.png)

## Verification

### Demo layout and URL regression — 2026-10-09

- `pnpm test` — passed: 83 Vitest tests; i18n covered 8 locales, 13 namespaces, 504 leaf keys, and 572 inline phrases.
- `pnpm run typecheck` and `pnpm run build` — passed. `pnpm run lint` — 0 errors, 2 pre-existing warnings.
- `pnpm run test:demo:browser` against both the local production build and the public Vercel demo — each passed all 6 combinations: Korean/English at 1440, 390, and 320 CSS pixels. This is an actual Chromium UI test, not a source-string or mocked-response test.
- Checked home horizontal bounds; expanded ARC body/appointment controls; opening/closing guide URL state, direct access, refresh, keyboard activation, back/forward, and stable history length; related ARC stage/card targeting; matching browser-local progress after refresh; listing map/share/close hit targets and clicks, direct access, refresh, back/forward, Escape, and backdrop closing.
- Reviewed captured Korean/English narrow-screen ARC, home, and sample listing screens. Overflow is fixed through grid/flex sizing and wrapping, not by hiding the guide's content.
- The runner blocked 60 API/external/non-read requests across the six combinations, including session-bootstrap/state GETs. Only read-only account config and same-origin assets were allowed. No production listings, reservations, or tickets were created. This does **not** verify DB persistence, account authentication, external Maps page rendering, other browser engines, or physical mobile devices.
- Fix commit `086c260` was deployed successfully to Vercel Production. The public demo and `/api/account/config` returned HTTP 200; signup and email delivery remained disabled. No Auth/provider settings were changed.
- Reproduction and public-demo execution instructions: [read-only browser regression](docs/demo-browser-regression.md).

### Code checks from the preceding README revision — 2026-10-09

- `pnpm test` — passed; i18n validation covered 8 locales, 13 namespaces, 504 leaf keys, followed by 83 Vitest tests.
- `pnpm run typecheck` — passed.
- `pnpm run lint` — completed with 0 errors and 2 existing warnings in `app/page.tsx`.
- `pnpm run build` — passed with Next.js 16.3.2; dynamic `/api/*` routes were included in the server deployment output.

### Final documentation review — 2026-10-09

- Compared the listing/reservation UI branches, anonymous-session APIs, and authenticated-account repository to document their distinct storage paths and unresolved integration limits. No production data writes were used.
- Compared the signup-preflight example with `scripts/check-auth-signup-config.mjs`: it reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Captured the expanded ARC detail from the public demo (HTTP 200) and inspected the image for readable content. Server API requests were blocked during this capture.
- Checked relative Markdown/document/image targets and the GitHub copies after publication. The application code was unchanged, so the earlier code checks above were not rerun for this documentation revision.

### Previous or environment-specific verification

- Production Supabase Auth settings were checked through the public publishable key: HTTP 200 with `disable_signup=true`; `pnpm run check:auth-signup` returned exit 0 after the setting was changed.
- Public `/api/account/config` returned HTTP 200 with signup and email delivery disabled. The public signup route returned HTTP 503 while delivery was not configured.
- The `send-email` production endpoint was reachable (not 404) but returned HTTP 500 for missing email configuration. It was not activated as an Auth Hook.
- Git history contains fixes for guide/listing URL synchronization, ARC progress synchronization, support loading/empty/error states, and fail-closed email activation. These are supported by source assertions and unit tests; they are not the same as a full isolated production DB test.
- Real integration commands requiring a disposable Supabase project, admin token, browser fault injection, or Docker were not counted as passed unless their environment was explicitly available. See [the integration runbook](docs/integration-test-runbook.md).

### Evidence types

- **String/source assertions:** `tests/server-api.test.ts` checks important route and safety invariants.
- **Unit/domain/migration tests:** Vitest tests validate parsing, i18n, state migration, URL construction, RLS/migration assumptions, and email-template behavior without contacting production data.
- **HTTP/deployment checks:** public Vercel and Supabase Auth responses were queried directly, without printing keys or response secrets.
- **DB/browser integration:** requires an isolated test project and disposable credentials; UI presence alone is not reported as a completed integration test.

## Technical Problem-Solving Cases

### 1. Deep links and state synchronization

- **Problem:** opening a guide or listing detail needed to survive refresh, back/forward navigation, and closing the detail without leaving a stale query parameter.
- **Choice:** synchronize page state with `history.pushState`/`replaceState`, keep `guide=` and `listing=` identifiers in the URL, and scroll/focus the selected guide/task on navigation.
- **Verification:** source tests and the public browser flow cover the URL-driven pages; the captured guide and marketplace screenshots show the resulting screens.
- **Remaining limit:** the read-only Chromium regression covers guide/listing history in Korean and English at three widths; Safari/Firefox and physical-device behavior remain unverified.

### 2. Fail-closed email activation

- **Problem:** an app flag alone cannot prevent direct Supabase signup, and an unverified sender could create a misleading login experience.
- **Choice:** require delivery/provider/domain attestations in the app, keep signup disabled in Supabase Auth, and add `scripts/check-auth-signup-config.mjs` to verify the real Auth setting and expected project ref before release.
- **Verification:** the production Auth endpoint returned `disable_signup=true`; the preflight returned exit 0; the public account config remained disabled.
- **Remaining limit:** Resend DNS, sender identity, Hook secret, and actual disposable-email OTP tests remain operator setup items.

### 3. Guest/account data boundaries

- **Problem:** Guest/Demo convenience must not silently become another user's server data.
- **Choice:** retain a local browser fallback, scope anonymous server records to a session cookie, require explicit account-claim confirmation, use user ownership and RLS for authenticated listings, and separate Sample listings from live/owned listings.
- **Verification:** local-data, server API, migration, and security tests pass; the support runbook documents session isolation and admin-only updates.
- **Remaining limit:** cookie loss, account/anonymous-table interoperability, and optimistic local reservation updates need isolated end-to-end review before claiming reliable transaction or recovery behavior.

## Limitations & Future Improvements

- No real payment, provider booking, delivery/storage fulfillment, external chat, or push-notification integration.
- Sample marketplace records are not real transaction inventory. Live listings, reservations, service requests, and support records depend on Supabase configuration and policy.
- Email OTP code exists but production delivery is disabled until domain, Resend, and Auth Hook settings are independently verified.
- Immigration, housing, transport, health, and telecom conditions can change. Users must follow the linked official notice; the app does not invent unverified dates, fees, or documents.
- Uzbek, Vietnamese, Mongolian, and Malay resources use the shared fallback/content structure and require native-speaker/domain review before treating them as final translations.
- Operator identity, response targets, service responsibility, and data-retention decisions are intentionally not invented. See [support operations](docs/support-operations.md).

## Further Documentation

- [Setup, deployment, and email operations](docs/setup-and-operations.md)
- [Isolated integration-test runbook](docs/integration-test-runbook.md)
- [Support/operator workflow](docs/support-operations.md)
- [Supabase integration checklist](docs/supabase-integration-test-checklist.md)
