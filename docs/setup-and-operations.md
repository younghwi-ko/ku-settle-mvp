# Setup and operations

This document records the configuration boundaries for KU Settle. It is intentionally separate from the portfolio overview in the root README.

## Local development

```powershell
pnpm install
pnpm dev
```

Run the repository checks before opening a pull request:

```powershell
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
```

The application is a server-backed Next.js app. Vercel runs `pnpm install --frozen-lockfile` and `pnpm build`; it is not a Static Export deployment and does not use an `out/` directory.

## Environment and data boundaries

Keep local, preview, production, and integration-test variables separate. Never copy a production service-role key, admin token, or real user data into a local `.env.local` or a test runner. The integration runner must identify its dedicated Supabase project before any write request; see [the integration runbook](integration-test-runbook.md) and [the Supabase checklist](supabase-integration-test-checklist.md).

For a disposable remote test project, configure the runner outside version control with values such as:

```text
TEST_BASE_URL=http://127.0.0.1:3000
TEST_SUPABASE_PROJECT_REF=<test-project-ref>
TEST_INTEGRATION_SECRET=<local-secret>
TEST_ADMIN_API_TOKEN=<disposable-test-admin-token>
TEST_ALLOW_REMOTE=false
TEST_CONFIRM_ISOLATED=false
```

Use the exact variable names required by the current scripts; the example deliberately contains no usable credentials. Do not run integration writes against the public production Supabase project or Vercel Production.

## Account and email activation boundary

The following flags remain false until the sender domain and provider have been verified:

```text
ACCOUNT_SIGNUP_ENABLED=false
EMAIL_DELIVERY_ENABLED=false
EMAIL_PROVIDER_VERIFIED=false
AUTH_EMAIL_DOMAIN_VERIFIED=false
```

`ACCOUNT_SIGNUP_ENABLED` controls the KU Settle UI/API gate. It does not disable direct Supabase Auth signup. The production Supabase project must also have Authentication → Providers → Email → **Allow new users to sign up** disabled (`disable_signup=true`). The preflight command checks that provider setting:

```powershell
$env:SUPABASE_URL = "https://<production-project-ref>.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "<production-publishable-key>"
$env:EXPECTED_SUPABASE_PROJECT_REF = "<production-project-ref>"
pnpm run check:auth-signup
```

Do not print or commit the publishable key or any other secret. A successful preflight only confirms signup is blocked; it does not activate email delivery.

When the service is ready for real email, an operator must, in order:

1. Verify the sending domain and DNS records with the chosen provider.
2. Add the provider secret and sender address to the Supabase Edge Function environment, without committing them.
3. Deploy and test `supabase/functions/send-email` in an isolated environment.
4. Configure the Supabase Send Email Hook and confirm the provider response.
5. Review the privacy, support, and incident procedures, then enable the four flags deliberately.

Until those steps are complete, the app must keep email delivery disabled and must not claim that an OTP was delivered.

## Operations

Support-ticket and service-request handling is documented in [support operations](support-operations.md). That document does not invent an operator name, response time, vendor booking, payment, delivery, or storage commitment. Those policies must be supplied and approved before production operations are advertised.

The public demo is the Vercel URL in the root README. Use the login-free Guest flow for portfolio review; do not use real account, listing, reservation, or support data in screenshots or test runs.
