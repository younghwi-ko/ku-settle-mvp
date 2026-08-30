import { describe, expect, it } from "vitest";
import { migrateLocalData } from "../app/lib/local-data";

describe("local data migration", () => {
  it("preserves valid legacy data and drops malformed service requests", () => {
    const data = migrateLocalData({ version: 7, done: ["task-one"], products: [], preferences: { serviceRequests: [{ id: "ok", mode: "storage", status: "method-selected", updatedAt: "2026-08-30T00:00:00.000Z" }, { nope: true }] } });
    expect(data.version).toBeGreaterThanOrEqual(8);
    expect(data.done).toEqual(["task-one"]);
    expect(data.preferences.serviceRequests).toHaveLength(1);
  });
});
