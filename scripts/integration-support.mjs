import assert from "node:assert/strict";
import { URL } from "node:url";

const productionHost = "temporary-fleet-maroon-2opm8kt.vercel.app";
const configuredBaseUrl = String(process.env.TEST_BASE_URL ?? "").trim();
const adminToken = String(process.env.TEST_ADMIN_API_TOKEN ?? "");
const expectedProjectRef = String(process.env.TEST_SUPABASE_PROJECT_REF ?? "").trim();
const operatorName = String(process.env.TEST_OPERATOR_NAME ?? "integration-test").trim();
const remoteAllowed = process.env.TEST_ALLOW_REMOTE === "true" && process.env.TEST_CONFIRM_ISOLATED === "true";

function fail(message) {
  console.error(`integration setup failed: ${message}`);
  process.exit(2);
}

const missing = [];
if (!configuredBaseUrl) missing.push("TEST_BASE_URL");
if (!adminToken) missing.push("TEST_ADMIN_API_TOKEN");
if (!expectedProjectRef) missing.push("TEST_SUPABASE_PROJECT_REF");
if (missing.length) fail(`Set ${missing.join(" and ")} in the current shell only (never commit or print secrets).`);
let parsedBase;
try { parsedBase = new URL(configuredBaseUrl); } catch { fail("TEST_BASE_URL must be an absolute http(s) URL."); }
const baseUrl = parsedBase.origin;
if (!operatorName || operatorName.length > 80) fail("TEST_OPERATOR_NAME must be 1-80 characters.");
const target = parsedBase;
if (!/^https?:$/.test(target.protocol)) fail("TEST_BASE_URL must use http or https.");
if (target.hostname === productionHost || target.hostname.endsWith(".vercel.app")) fail("Production/temporary Vercel hosts are blocked.");
const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname);
if (!loopback && !remoteAllowed) fail("Remote targets require TEST_ALLOW_REMOTE=true and TEST_CONFIRM_ISOLATED=true.");
const configuredRefetchFailureUrl = String(process.env.TEST_REFETCH_FAILURE_URL ?? "").trim();
if (configuredRefetchFailureUrl) {
  try {
    if (new URL(configuredRefetchFailureUrl, baseUrl).origin !== baseUrl) fail("TEST_REFETCH_FAILURE_URL must use the same origin as TEST_BASE_URL.");
  } catch { fail("TEST_REFETCH_FAILURE_URL must be a valid same-origin URL or path."); }
}

class CookieClient {
  constructor(origin) { this.origin = origin; this.cookies = new Map(); }
  hasCookie(name) { return this.cookies.has(name); }
  cookieHeader() { return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "); }
  saveCookies(response) {
    const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const value of values) {
      const pair = value.split(";", 1)[0];
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  async request(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    if (!headers.has("origin")) headers.set("origin", this.origin);
    const cookie = this.cookieHeader();
    if (cookie) headers.set("cookie", cookie);
    let requestUrl;
    try {
      const parsed = new URL(path, this.origin);
      if (parsed.origin !== this.origin) throw new Error("cross-origin request blocked");
      requestUrl = parsed.href;
    } catch (error) {
      throw new Error(`same-origin request check failed: ${error instanceof Error ? error.message : "invalid URL"}`);
    }
    const response = await fetch(requestUrl, { ...options, headers, redirect: "manual" });
    this.saveCookies(response);
    let body = null;
    try { body = await response.json(); } catch { /* non-JSON response */ }
    return { status: response.status, body };
  }
}

function expectStatus(result, expected, label) {
  assert.equal(result.status, expected, `${label}: expected ${expected}, received ${result.status}`);
}
function codeOf(result) { return typeof result.body?.error === "string" ? result.body.error : ""; }
function report(label, result) { console.log(`${label}: ${result.status}${codeOf(result) ? ` (${codeOf(result)})` : ""}`); }
function jsonHeaders() { return { "content-type": "application/json" }; }

const anonymousA = new CookieClient(baseUrl);
const anonymousB = new CookieClient(baseUrl);
const admin = new CookieClient(baseUrl);
const adminConcurrent = new CookieClient(baseUrl);
let ticketId = "";
let ticketVersion = 0;
let ticketMarker = "";
let cleanupNeeded = false;
let cleanupFailure = false;
let testFailure = null;

try {
  const environment = await fetch(`${baseUrl}/api/integration/environment`, { headers: { origin: baseUrl }, redirect: "manual" });
  let environmentBody = null;
  try { environmentBody = await environment.json(); } catch { /* non-JSON response */ }
  if (environment.status !== 200 || environmentBody?.isolated !== true || environmentBody?.projectRef !== expectedProjectRef) fail("The app did not prove it is connected to the expected isolated Supabase project; no write requests were sent.");
  console.log("isolated environment check: PASS");

  let result = await admin.request("/api/admin/session", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ token: adminToken, operatorName }) });
  expectStatus(result, 200, "valid admin authentication");
  assert.equal(admin.hasCookie("ku_settle_admin"), true, "valid admin authentication did not set a session cookie");
  report("valid admin authentication", result);

  const invalid = new CookieClient(baseUrl);
  result = await invalid.request("/api/admin/session", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ token: `${adminToken}invalid`, operatorName }) });
  expectStatus(result, 403, "invalid admin authentication");
  assert.equal(invalid.hasCookie("ku_settle_admin"), false, "invalid admin authentication set a session cookie");
  report("invalid admin authentication", result);

  result = await anonymousA.request("/api/session/bootstrap", { method: "POST" });
  expectStatus(result, 200, "session A bootstrap");
  result = await anonymousB.request("/api/session/bootstrap", { method: "POST" });
  expectStatus(result, 200, "session B bootstrap");

  ticketMarker = `integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  result = await anonymousA.request("/api/support-tickets", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ subject: ticketMarker, body: "Automated isolated integration test ticket." }) });
  expectStatus(result, 201, "support ticket creation");
  ticketId = String(result.body?.ticket?.id ?? "");
  assert.match(ticketId, /^[0-9a-f-]{36}$/i, "support ticket id missing");
  cleanupNeeded = true;
  report("support ticket creation", result);

  result = await anonymousA.request("/api/support-tickets");
  expectStatus(result, 200, "session A ticket read");
  assert.ok(result.body?.tickets?.some((ticket) => ticket.id === ticketId), "session A cannot read its own ticket");
  report("session A ticket read", result);

  result = await anonymousB.request("/api/support-tickets");
  expectStatus(result, 200, "session B isolated ticket read");
  assert.ok(!result.body?.tickets?.some((ticket) => ticket.id === ticketId), "session B accessed session A ticket");
  report("session B isolation", result);

  result = await admin.request(`/api/admin/tickets?search=${encodeURIComponent(ticketMarker)}`);
  expectStatus(result, 200, "admin ticket read");
  const adminTicket = result.body?.tickets?.find((ticket) => ticket.id === ticketId);
  assert.ok(adminTicket, "admin cannot read test ticket");
  ticketVersion = Number(adminTicket.version);
  assert.ok(Number.isInteger(ticketVersion) && ticketVersion > 0, "ticket version missing");

  const answer = "Automated test response.";
  result = await admin.request(`/api/admin/tickets/${ticketId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ version: ticketVersion, status: "resolved", operatorResponse: answer }) });
  expectStatus(result, 200, "admin ticket update");
  ticketVersion = Number(result.body?.ticket?.version);
  report("admin ticket update", result);

  result = await anonymousA.request("/api/support-tickets");
  expectStatus(result, 200, "user ticket read after admin update");
  const updated = result.body?.tickets?.find((ticket) => ticket.id === ticketId);
  assert.equal(updated?.status, "resolved", "user status did not update");
  assert.equal(updated?.operator_response, answer, "user response did not update");
  report("user sees admin update", result);
  result = await anonymousA.request("/api/support-tickets");
  expectStatus(result, 200, "user ticket reload");
  assert.equal(result.body?.tickets?.find((ticket) => ticket.id === ticketId)?.operator_response, answer, "response did not survive reload");
  report("user reload persistence", result);

  result = await anonymousA.request(`/api/admin/tickets/${ticketId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ version: ticketVersion, status: "closed", operatorResponse: "unauthorized" }) });
  expectStatus(result, 401, "normal user admin mutation rejection");
  assert.equal(codeOf(result), "admin_required");
  report("normal user admin mutation rejection", result);

  const concurrentAuth = await adminConcurrent.request("/api/admin/session", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ token: adminToken, operatorName: `${operatorName}-concurrent` }) });
  expectStatus(concurrentAuth, 200, "second admin authentication");
  assert.equal(adminConcurrent.hasCookie("ku_settle_admin"), true, "second admin authentication did not set a session cookie");
  report("second admin authentication", concurrentAuth);
  const conflictBody = { version: ticketVersion, status: "reviewing", operatorResponse: "Concurrent test." };
  const [first, second] = await Promise.all([
    admin.request(`/api/admin/tickets/${ticketId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(conflictBody) }),
    adminConcurrent.request(`/api/admin/tickets/${ticketId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(conflictBody) })
  ]);
  const statuses = [first.status, second.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409], "concurrent updates did not produce one success and one conflict");
  const conflict = first.status === 409 ? first : second;
  assert.equal(codeOf(conflict), "version_conflict", "concurrent conflict did not return version_conflict");
  report("concurrent update A", first);
  report("concurrent update B", second);

  result = await admin.request(`/api/admin/tickets/${ticketId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ version: ticketVersion, status: "not-a-status" }) });
  expectStatus(result, 422, "save validation failure");
  report("save validation failure", result);

  if (configuredRefetchFailureUrl) {
    const failure = await anonymousA.request(configuredRefetchFailureUrl);
    assert.ok(failure.status >= 500, "refetch failure endpoint did not return a server error");
    report("configured refetch failure", failure);
  } else {
    console.log("refetch failure: SKIPPED (set TEST_REFETCH_FAILURE_URL to an isolated fault-injection endpoint; no false pass reported)");
  }

  console.log("integration checks complete; awaiting cleanup confirmation");
} catch (error) {
  testFailure = error;
} finally {
  if (cleanupNeeded && ticketId) {
    try {
      const current = await admin.request(`/api/admin/tickets?search=${encodeURIComponent(ticketMarker)}`);
      const ticket = current.body?.tickets?.find((entry) => entry.id === ticketId);
      if (!ticket) throw new Error("test ticket not found during cleanup");
      const removed = await admin.request(`/api/admin/tickets/${ticketId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ version: ticket.version, status: "deleted", operatorResponse: "" }) });
      expectStatus(removed, 200, "test ticket soft-delete");
      if (removed.body?.ticket?.status !== "deleted") throw new Error("soft-delete response did not confirm deleted status");
      console.log("test ticket cleanup: PASS (soft-delete confirmed)");
    } catch (error) {
      console.error(`cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
      cleanupFailure = true;
    }
  }
}

if (testFailure) {
  console.error(`integration result: FAIL (${testFailure instanceof Error ? testFailure.message : "unknown error"})`);
  process.exitCode = 1;
} else if (cleanupFailure) {
  console.error("integration result: FAIL (test data cleanup was not confirmed)");
  process.exitCode = 1;
} else {
  console.log("integration result: PASS (HTTP auth, ticket lifecycle, session isolation, admin protection, version conflict, and cleanup)");
}
