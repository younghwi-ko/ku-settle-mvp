import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrateLocalData } from "../app/lib/local-data";

describe("local data migration", () => {
  it("preserves valid legacy data and drops malformed service requests", () => {
    const data = migrateLocalData({ version: 7, done: ["task-one"], products: [], preferences: { serviceRequests: [{ id: "ok", mode: "storage", status: "method-selected", updatedAt: "2026-08-30T00:00:00.000Z" }, { nope: true }] } });
    expect(data.version).toBeGreaterThanOrEqual(8);
    expect(data.done).toEqual(["task-one"]);
    expect(data.preferences.serviceRequests).toHaveLength(1);
  });

  it("adds public-safe support ticket references with a legacy backfill", () => {
    const sql = readFileSync(resolve("supabase/migrations/202608310010_support_ticket_reference.sql"), "utf8");
    expect(sql).toContain("add column if not exists reference_code text");
    expect(sql).toContain("TKT-");
    expect(sql).toContain("support_tickets_reference_code_idx");
  });
});
