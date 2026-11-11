import { describe, expect, it, vi } from "vitest";

const { row, session, updates } = vi.hoisted(() => ({
  row: { id: "11111111-1111-4111-8111-111111111111", session_id: "seller-session", status: "active" },
  session: { id: "seller-session" },
  updates: vi.fn(),
}));
vi.mock("@/app/lib/server-session", () => ({
  getOrCreateServerSession: async () => session,
  requireSameOrigin: async (request: Request) => request.headers.get("origin") === "http://localhost:3001",
  serverClient: () => ({
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = [];
        const query = {
          eq(key: string, value: unknown) { filters.push([key, value]); return query; },
          select() { return query; },
          async maybeSingle() {
            updates(table, values, filters);
            const matches = filters.every(([key, value]) => row[key as keyof typeof row] === value);
            return { data: matches ? { ...row, ...values } : null, error: null };
          },
        };
        return query;
      },
    }),
  }),
}));

import { DELETE } from "../app/api/marketplace/listings/[id]/route";

describe("listing deletion", () => {
  const remove = (id: string) => DELETE(
    new Request(`http://localhost:3001/api/marketplace/listings/${id}`, { method: "DELETE", headers: { origin: "http://localhost:3001" } }),
    { params: Promise.resolve({ id }) },
  );

  it("returns the owned row that was actually soft-deleted", async () => {
    const response = await remove(row.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ listing: { id: row.id, status: "deleted" } });
    expect(updates).toHaveBeenCalledWith("guest_listings", { status: "deleted", availability: "available" }, [["id", row.id], ["session_id", row.session_id]]);
  });

  it("does not report success when the session owns no matching row", async () => {
    session.id = "other-session";
    const response = await remove(row.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "listing_conflict_or_not_found" });
  });
});
