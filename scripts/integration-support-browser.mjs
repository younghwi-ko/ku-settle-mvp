import assert from "node:assert/strict";
import { URL } from "node:url";

const configuredBaseUrl = String(process.env.TEST_BASE_URL ?? "").trim();
const expectedProjectRef = String(process.env.TEST_SUPABASE_PROJECT_REF ?? "").trim();
const adminToken = String(process.env.TEST_ADMIN_API_TOKEN ?? "");
const faultSecret = String(process.env.TEST_INTEGRATION_SECRET ?? "");
if (!configuredBaseUrl || !expectedProjectRef || !adminToken || !faultSecret) {
  console.error("browser integration setup failed: set TEST_BASE_URL, TEST_SUPABASE_PROJECT_REF, TEST_ADMIN_API_TOKEN, and TEST_INTEGRATION_SECRET.");
  process.exit(2);
}
let parsedBase;
try { parsedBase = new URL(configuredBaseUrl); } catch { console.error("browser integration setup failed: TEST_BASE_URL must be an absolute URL."); process.exit(2); }
const baseUrl = parsedBase.origin;
if (parsedBase.hostname === "temporary-fleet-maroon-2opm8kt.vercel.app" || parsedBase.hostname.endsWith(".vercel.app")) { console.error("browser integration setup failed: Production/temporary Vercel hosts are blocked."); process.exit(2); }
const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedBase.hostname);
if (!loopback && !(process.env.TEST_ALLOW_REMOTE === "true" && process.env.TEST_CONFIRM_ISOLATED === "true")) { console.error("browser integration setup failed: remote targets require TEST_ALLOW_REMOTE=true and TEST_CONFIRM_ISOLATED=true."); process.exit(2); }
let playwright;
try { playwright = await import("playwright"); } catch {
  console.error("browser integration setup failed: install the Playwright package and browser before running this test.");
  process.exit(2);
}

const marker = `browser-integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const browser = await playwright.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let cleanupOk = false;
try {
  await page.goto(`${baseUrl}/?lang=ko`, { waitUntil: "networkidle" });
  const environment = await page.evaluate(async () => { const response = await fetch("/api/integration/environment", { cache: "no-store" }); return { status: response.status, body: await response.json().catch(() => null) }; });
  assert.equal(environment.status, 200, "isolated environment check failed");
  assert.equal(environment.body?.isolated, true, "app did not prove isolated mode");
  assert.equal(environment.body?.projectRef, expectedProjectRef, "app Supabase project ref mismatch");
  await page.getByRole("button", { name: "운영 문의" }).click();
  await page.getByRole("heading", { name: "운영 문의" }).waitFor();

  const armed = await page.evaluate(async (secret) => {
    const response = await fetch("/api/integration/faults", { method: "POST", headers: { "content-type": "application/json", "x-integration-test-secret": secret }, body: JSON.stringify({ fault: "support_refetch" }) });
    return response.status;
  }, faultSecret);
  assert.equal(armed, 200, "fault injection was not armed");

  const fields = page.locator(".field input");
  await fields.first().fill(marker);
  await page.locator(".field textarea").fill("Automated browser integration ticket.");
  await page.getByRole("button", { name: "문의 접수" }).click();
  await page.getByRole("alert").getByText("문의 내역을 불러오지 못했습니다.").waitFor();
  assert.equal(await page.getByText(/접수번호/).count(), 0, "success banner remained after re-fetch failure");
  assert.equal(await page.getByRole("alert").getByRole("button", { name: "다시 시도" }).count(), 1, "retry action missing");
  console.log("browser save-then-refetch failure: 502 shown, success banner absent, retry shown");

  await page.getByRole("alert").getByRole("button", { name: "다시 시도" }).click();
  await page.getByText(marker).waitFor();
  assert.equal(await page.getByText("문의 내역을 불러오지 못했습니다.").count(), 0, "retry did not recover the ticket list");
  console.log("browser retry recovery: ticket visible after retry");

  const cleanup = await page.evaluate(async ({ token, subject }) => {
    const auth = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, operatorName: "browser-integration" }) });
    if (auth.status !== 200) return { ok: false, status: auth.status };
    const list = await fetch(`/api/admin/tickets?search=${encodeURIComponent(subject)}`);
    if (!list.ok) return { ok: false, status: list.status };
    const body = await list.json();
    const ticket = body.tickets?.find((entry) => entry.subject === subject);
    if (!ticket) return { ok: false, status: 404 };
    const removed = await fetch(`/api/admin/tickets/${ticket.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: ticket.version, status: "deleted", operatorResponse: "" }) });
    return { ok: removed.status === 200, status: removed.status, deleted: removed.ok && (await removed.json()).ticket?.status === "deleted" };
  }, { token: adminToken, subject: marker });
  assert.equal(cleanup.ok, true, `browser test cleanup failed (${cleanup.status})`);
  assert.equal(cleanup.deleted, true, "soft-delete response was not confirmed");
  cleanupOk = true;
  console.log("browser cleanup: soft-delete confirmed");
  console.log("browser integration result: PASS");
} finally {
  await browser.close();
  if (!cleanupOk) console.error("browser cleanup warning: inspect only the isolated test project for the generated ticket.");
}
