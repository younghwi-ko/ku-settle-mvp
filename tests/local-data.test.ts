import { describe, expect, it } from "vitest";
import { emptyPreferences, migrateLocalData } from "../app/lib/local-data";

describe("local data migration", () => {
  it("preserves legacy profile, checklist, and products", () => {
    const result = migrateLocalData({ profile: { name: "A", arrivalDate: "2026-09-01", housing: "dorm", mode: "personalized" }, done: ["dorm"], products: [{ id: 1 }], verified: true });
    expect(result.version).toBe(8); expect(result.profile?.name).toBe("A"); expect(result.done).toEqual(["dorm"]); expect(result.verified).toBe(true); expect(result.preferences.favoriteProductIds).toEqual([]);
  });
  it("returns safe defaults for malformed data", () => expect(migrateLocalData({ preferences: { dueDates: { task: 3 }, customTasks: [{ bad: true }] } }).preferences).toEqual(emptyPreferences()));
  it("keeps only valid products and derives active reservation ids", () => {
    const result = migrateLocalData({ products: [{ id: "ok", priceKrw: 1000, category: "Home", condition: "good", status: "Available", icon: "box" }, { id: "bad", priceKrw: "1" }], preferences: { reservations: [{ id: "r1", productId: "ok", buyerName: "Alex", status: "active", createdAt: "2026-08-29T00:00:00Z" }] } });
    expect(result.products).toHaveLength(1); expect(result.preferences.reservedProductIds).toEqual(["ok"]);
  });
  it("migrates completed reservations and ignores malformed status values", () => {
    const result = migrateLocalData({ preferences: { reservations: [{ id: "done", productId: "p1", buyerName: "Alex", status: "completed", createdAt: "2026-08-29T00:00:00Z", completedAt: "2026-08-29T12:00:00Z" }, { id: "bad", productId: "p2", buyerName: "Alex", status: "unknown", createdAt: "bad" }] } });
    expect(result.preferences.reservations).toHaveLength(1);
    expect(result.preferences.reservations[0].status).toBe("completed");
  });
  it("migrates service requests and drops malformed entries", () => {
    const result = migrateLocalData({ preferences: { serviceRequests: [{ id: "s1", productId: "p1", mode: "storage", status: "quote-viewed", storageDuration: "30", storageLocation: "campus", updatedAt: "2026-08-29T00:00:00Z" }, { id: "bad", mode: "unknown", status: "in-progress", updatedAt: "bad" }] } });
    expect(result.preferences.serviceRequests).toHaveLength(1);
    expect(result.preferences.serviceRequests[0].status).toBe("quote-viewed");
  });
  it("accepts the expanded service lifecycle statuses", () => {
    const result = migrateLocalData({ preferences: { serviceRequests: [{ id: "s1", mode: "delivery", status: "application-ready", updatedAt: "2026-08-29T00:00:00Z" }, { id: "s2", mode: "pickup", status: "completed", updatedAt: "2026-08-29T00:00:00Z" }] } });
    expect(result.preferences.serviceRequests.map((item) => item.status)).toEqual(["application-ready", "completed"]);
  });
});
