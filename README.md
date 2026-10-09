# KU Settle

KU Settle is a multilingual settlement companion for international students preparing for arrival, adapting to campus life, and planning departure from Korea University. It turns scattered information into a sequence of small, actionable decisions: check an official notice, save a route, prepare a document, or record a marketplace request.

This project started from a presentation idea about the gap between “knowing what information exists” and “being able to act on it.” The web service format makes that idea testable: a student can choose a lifecycle stage, open the relevant guide, record progress, and follow a link to the next action.

## Project Overview

- **Problem observed:** international students must combine university notices, immigration guidance, transport information, housing instructions, and everyday decisions across different sites and languages. The difficult part is often the next action, not the existence of information.
- **Product direction:** connect official-source guidance, a personalized checklist, local campus guidance, and a clearly labelled sample/live marketplace in one flow.
- **Current scope:** a public Guest/Demo experience is available without an account. Supabase-backed account, marketplace, support, and operator flows exist in the codebase but remain subject to provider, environment, and operational verification.
- **Languages:** 8 configured locales — English (`en`), 한국어 (`ko`), 日本語 (`ja`), 简体中文 (`zh-CN`), O‘zbekcha (`uz`), Tiếng Việt (`vi`), Монгол (`mn`), Bahasa Melayu (`ms`).

## My Contribution

The repository and Git history support the following description of the work represented here:

- **Planning and product decisions visible in the implementation:** lifecycle-based onboarding; clear separation of Sample content and user-created listings; fail-closed email/account activation; explicit “implemented / operationally inactive / future” boundaries; and no unverified immigration dates, fees, or documents.
- **Design and implementation:** responsive lifecycle cards, personalization fields, deep-linkable guide and listing detail views, multilingual resource structure, local-data migration, marketplace and support flows, Supabase API/RLS boundaries, and integration-test runners.
- **Verification:** i18n key validation, unit/domain tests, API/source assertions, type checking, linting, production builds, public HTTP checks, and manual/browser review recorded in [Verification](#verification).
- **AI-assisted workflow:** AI tools were used for code exploration, implementation drafts, test/documentation drafts, and verification assistance. The final scope decisions, safe defaults, claims in this README, and release boundaries are based on the source, configuration, test output, and deployment responses in this repository.

Personal contribution percentage, team roles, and user outcome metrics are intentionally not inferred. Before submitting, replace or supplement this section with the role and contribution wording you personally want to claim.

## Key Features

### Publicly usable without login

- Guest lifecycle home with four stages: Before Arrival, First Weeks, Campus Life, and Departure.
- Personalized setup for name, arrival phase, study track, housing, arrival date, and optional departure date.
- Checklist progress, important-task recommendations, due-date notes, and local browser persistence.
- Life Guide cards with official-source links, applicability, steps, preparation items, contact guidance, completion criteria, and source status.
- Campus/local guidance with curated records and optional Kakao search configuration; place cards can open external Google Maps search/directions links.
- Marketplace browsing with explicitly marked Sample data, local listing/reservation flow, shareable listing URLs, and mobile-responsive screens.

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
4. Open **캠퍼스 마켓** to distinguish Sample data from the local listing/reservation flow. Detail pages can be refreshed or shared with their `listing=` URL parameter.

Screenshots below were captured from the public demo on 2026-10-09. They contain no account credentials, tokens, or user records.

![KU Settle home](docs/screenshots/home-ko.png)

![Personalized lifecycle checklist](docs/screenshots/checklist-ko.png)

![ARC life guide](docs/screenshots/guide-arc-ko.png)

![Campus marketplace](docs/screenshots/marketplace-ko.png)

## Verification

### Current verification — 2026-10-09

- `pnpm test` — passed; i18n validation covered 8 locales, 13 namespaces, 504 leaf keys, followed by 83 Vitest tests.
- `pnpm run typecheck` — passed.
- `pnpm run lint` — completed with 0 errors and 2 existing warnings in `app/page.tsx`.
- `pnpm run build` — passed with Next.js 16.3.2; dynamic `/api/*` routes were included in the server deployment output.
- Public demo HTTP check — Vercel responded successfully; the screenshots above were captured from the deployed URL.
- Screenshot/link check — all four relative image paths exist in `docs/screenshots/` and render as repository assets.

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
- **Remaining limit:** a dedicated automated cross-browser history suite still belongs in the isolated browser test environment.

### 2. Fail-closed email activation

- **Problem:** an app flag alone cannot prevent direct Supabase signup, and an unverified sender could create a misleading login experience.
- **Choice:** require delivery/provider/domain attestations in the app, keep signup disabled in Supabase Auth, and add `scripts/check-auth-signup-config.mjs` to verify the real Auth setting and expected project ref before release.
- **Verification:** the production Auth endpoint returned `disable_signup=true`; the preflight returned exit 0; the public account config remained disabled.
- **Remaining limit:** Resend DNS, sender identity, Hook secret, and actual disposable-email OTP tests remain operator setup items.

### 3. Guest/account data boundaries

- **Problem:** Guest/Demo convenience must not silently become another user's server data.
- **Choice:** keep Guest/Demo state in browser storage, require explicit account-claim confirmation, use session/user scoping and RLS for server state, and separate Sample listings from live/owned listings.
- **Verification:** local-data, server API, migration, and security tests pass; the support runbook documents session isolation and admin-only updates.
- **Remaining limit:** live operational review and a disposable remote DB test are still required before public account/operations claims.

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
