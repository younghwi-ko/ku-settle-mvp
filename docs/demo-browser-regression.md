# Read-only demo browser regression

This is a rendered Chromium UI regression, not a server/DB integration test. It
uses disposable browser contexts and blocks **all non-GET/HEAD requests**, every
external-origin request, and every `/api/*` endpoint except read-only
`GET /api/account/config`. Session bootstrap/state GETs are blocked too because
they can create server records. No production users, listings, reservations, or
tickets are created. Do not remove the request guard for a public run.

Prerequisites: repository dependencies and Playwright Chromium installed.

```powershell
pnpm run build
pnpm start --port 3001
```

In another terminal:

```powershell
$env:DEMO_TEST_BASE_URL = 'http://localhost:3001'
pnpm run test:demo:browser
```

After deployment, run the same suite against the existing public demo:

```powershell
$env:DEMO_TEST_BASE_URL = 'https://temporary-fleet-maroon-2opm8kt.vercel.app'
pnpm run test:demo:browser
```

The runner allows only these hosts and loopback. Its six combinations are Korean
and English at 1440, 390, and 320 CSS pixels. Assertions cover:

- Home width and important-task card bounds (without hiding overflow).
- Expanded ARC descendants, progress controls, and browser-local persistence.
- Guide opening/closing, preservation of language/extra query parameters,
  direct address, refresh, keyboard activation, back/forward, and stable history
  length (automatic opening must not append entries).
- Related ARC stage/task URL, card visibility and matching local progress.
- Sample listing direct address, refresh and history; map-link hit testing and
  clicks, sharing feedback, close button, Escape and backdrop dismissal.

Optional `DEMO_SCREENSHOT_DIR` saves UI captures to an existing directory. The
runner never uses an existing user's cookies or storage. A pass does not verify
server persistence, authenticated transactions, external Maps page rendering,
Safari/Firefox, or physical-device keyboard behavior.
