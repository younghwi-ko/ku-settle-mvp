import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validImage, uuid } from "../app/lib/server-api";

const publicStateRoute = readFileSync(new URL("../app/api/session/state/route.ts", import.meta.url), "utf8");
const servicePatchRoute = readFileSync(new URL("../app/api/service-requests/[id]/route.ts", import.meta.url), "utf8");
const adminServiceRoute = readFileSync(new URL("../app/api/admin/service-requests/[id]/route.ts", import.meta.url), "utf8");

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
});
