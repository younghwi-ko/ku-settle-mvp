import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validImage, uuid } from "../app/lib/server-api";

const publicStateRoute = readFileSync(new URL("../app/api/session/state/route.ts", import.meta.url), "utf8");
const serviceCreateRoute = readFileSync(new URL("../app/api/service-requests/route.ts", import.meta.url), "utf8");
const servicePatchRoute = readFileSync(new URL("../app/api/service-requests/[id]/route.ts", import.meta.url), "utf8");
const adminServiceRoute = readFileSync(new URL("../app/api/admin/service-requests/[id]/route.ts", import.meta.url), "utf8");
const remoteStateClient = readFileSync(new URL("../app/lib/remote-state.ts", import.meta.url), "utf8");
const adminSession = readFileSync(new URL("../app/lib/server-session.ts", import.meta.url), "utf8");
const marketplaceListRoute = readFileSync(new URL("../app/api/marketplace/listings/route.ts", import.meta.url), "utf8");
const supportTicketRoute = readFileSync(new URL("../app/api/support-tickets/route.ts", import.meta.url), "utf8");
const adminOverviewRoute = readFileSync(new URL("../app/api/admin/overview/route.ts", import.meta.url), "utf8");
const adminTicketsRoute = readFileSync(new URL("../app/api/admin/tickets/[id]/route.ts", import.meta.url), "utf8");
const integrationEnvironmentRoute = readFileSync(new URL("../app/api/integration/environment/route.ts", import.meta.url), "utf8");
const integrationFaultRoute = readFileSync(new URL("../app/api/integration/faults/route.ts", import.meta.url), "utf8");
const integrationRunner = readFileSync(new URL("../scripts/integration-support.mjs", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const accountConfigRoute = readFileSync(new URL("../app/api/account/config/route.ts", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("../app/lib/repository.ts", import.meta.url), "utf8");

describe("anonymous server input validation", () => {
  it("accepts only bounded image data URLs", () => {
    expect(validImage("data:image/png;base64,AAAA")).toBe(true);
    expect(validImage("https://example.com/image.png")).toBe(false);
    expect(validImage("data:text/html;base64,AAAA")).toBe(false);
  });
  it("validates UUID route identifiers", () => {
    expect(uuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(uuid("not-an-id")).toBe(false);
  });

  it("keeps administrator notes out of the public session payload", () => {
    expect(publicStateRoute).toContain('estimated_cost_label,terms_note,version,created_at,updated_at');
    expect(publicStateRoute).not.toContain('admin_note,admin_updated_at,admin_updated_by');
  });

  it("limits user cancellation and reserves status processing for administrators", () => {
    expect(servicePatchRoute).toContain('const userCancellation = status === "cancelled"');
    expect(servicePatchRoute).toContain('"application-ready"].includes(current.status)');
    expect(adminServiceRoute).toContain('admin_note: adminNote');
    expect(adminServiceRoute).toContain('admin_updated_at: now');
  });

  it("accepts changes to an existing request while keeping identical retries idempotent", () => {
    expect(serviceCreateRoute).toContain("const unchanged = existing.status === payload.status");
    expect(serviceCreateRoute).toContain("existing.idempotency_key === idempotencyKey && unchanged");
  });

  it("normalizes an empty listing image to null before server validation", () => {
    expect(remoteStateClient).toContain("imageDataUrl: imagePath ? null : product.imageDataUrl || null");
    expect(remoteStateClient).toContain('product.imageDataUrl?.startsWith("data:image/")');
  });

  it("stores a signed opaque administrator session instead of the administrator token", () => {
    expect(adminSession).toContain("parseAdminSession");
    expect(adminSession).toContain("randomBytes(24)");
    expect(adminSession).not.toContain("jar.set(ADMIN_COOKIE, token");
    expect(adminSession).toContain("httpOnly: true");
    expect(adminSession).toContain('sameSite: "lax"');
  });

  it("paginates and filters the public marketplace on the server", () => {
    expect(marketplaceListRoute).toContain('searchParams.get("search")');
    expect(marketplaceListRoute).toContain('searchParams.get("category")');
    expect(marketplaceListRoute).toContain('count: "exact"');
    expect(marketplaceListRoute).toContain("pagination:");
  });

  it("does not promise an unconfigured support response deadline", () => {
    expect(supportTicketRoute).not.toContain("firstResponseDueAt");
    expect(supportTicketRoute).toContain("처리 상태와 운영자 답변은 앱에서 확인하세요.");
    expect(adminOverviewRoute).not.toContain("isTicketOverdue");
  });

  it("scopes support data to the session and protects operator edits", () => {
    expect(supportTicketRoute).toContain('.eq("session_id", session.id)');
    expect(adminTicketsRoute).toContain("requireAdmin(request, true)");
    expect(adminTicketsRoute).toContain("version_conflict");
  });

  it("distinguishes support loading, empty, and failed states", () => {
    expect(pageSource).toContain("Loading support tickets…");
    expect(pageSource).toContain("No support tickets yet.");
    expect(pageSource).toContain('errorAction === "load" && error');
    expect(pageSource).toContain("Try again");
  });

  it("gates integration-only endpoints and blocks unsafe runner targets", () => {
    expect(integrationEnvironmentRoute).toContain('integrationModeEnabled()');
    expect(integrationEnvironmentRoute).toContain('INTEGRATION_SUPABASE_PROJECT_REF');
    expect(integrationEnvironmentRoute).toContain('isAllowedLocalUrl');
    expect(integrationEnvironmentRoute).toContain('integration_environment_unverified');
    expect(integrationFaultRoute).toContain('x-integration-test-secret');
    expect(integrationRunner).toContain('parsed.origin !== this.origin');
    expect(integrationRunner).toContain('isHttpOnly("ku_settle_admin")');
    expect(integrationRunner).toContain('version_conflict');
    expect(integrationRunner).toContain('Production/temporary Vercel hosts are blocked');
    expect(integrationRunner).toContain('no write requests were sent');
  });

  it("keeps email sign-in closed until provider and domain verification are attested", () => {
    expect(adminSession).toContain("EMAIL_PROVIDER_VERIFIED");
    expect(adminSession).toContain("AUTH_EMAIL_DOMAIN_VERIFIED");
    expect(adminSession).toContain("emailDeliveryReady");
    expect(accountConfigRoute).toContain("emailDeliveryReason");
    expect(pageSource).toContain("/api/account/config");
    expect(pageSource).toContain("errors:emailProviderUnverified");
    expect(pageSource).toContain("allowSignup: authConfig.signupEnabled");
    expect(pageSource).toContain("emailDeliveryEnabled");
    expect(repositorySource).toContain("shouldCreateUser: options.allowSignup ?? false");
  });
});
