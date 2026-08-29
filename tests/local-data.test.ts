import { describe, expect, it } from "vitest";
import { emptyPreferences, migrateLocalData } from "../app/lib/local-data";

describe("local data migration", () => {
  it("preserves legacy profile, checklist, and products", () => {
    const result = migrateLocalData({ profile: { name: "A", arrivalDate: "2026-09-01", housing: "dorm", mode: "personalized" }, done: ["dorm"], products: [{ id: 1 }], verified: true });
    expect(result.version).toBe(3); expect(result.profile?.name).toBe("A"); expect(result.done).toEqual(["dorm"]); expect(result.verified).toBe(true);
  });
  it("returns safe defaults for malformed data", () => expect(migrateLocalData({ preferences: { dueDates: { task: 3 }, customTasks: [{ bad: true }] } }).preferences).toEqual(emptyPreferences()));
});
