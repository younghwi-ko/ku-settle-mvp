import { describe, expect, it } from "vitest";
import { emptyPreferences, migrateLocalData } from "../app/lib/local-data";

describe("local data migration", () => {
  it("preserves legacy profile, checklist, and products", () => {
    const result = migrateLocalData({ profile: { name: "A", arrivalDate: "2026-09-01", housing: "dorm", mode: "personalized" }, done: ["dorm"], products: [{ id: 1 }], verified: true });
    expect(result.version).toBe(4); expect(result.profile?.name).toBe("A"); expect(result.done).toEqual(["dorm"]); expect(result.verified).toBe(true); expect(result.preferences.favoriteProductIds).toEqual([]);
  });
  it("returns safe defaults for malformed data", () => expect(migrateLocalData({ preferences: { dueDates: { task: 3 }, customTasks: [{ bad: true }] } }).preferences).toEqual(emptyPreferences()));
  it("keeps only valid products and derives active reservation ids", () => {
    const result = migrateLocalData({ products: [{ id: "ok", priceKrw: 1000, category: "Home", condition: "good", status: "Available", icon: "box" }, { id: "bad", priceKrw: "1" }], preferences: { reservations: [{ id: "r1", productId: "ok", buyerName: "Alex", status: "active", createdAt: "2026-08-29T00:00:00Z" }] } });
    expect(result.products).toHaveLength(1); expect(result.preferences.reservedProductIds).toEqual(["ok"]);
  });
});
