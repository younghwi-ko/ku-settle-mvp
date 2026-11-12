import { afterEach, describe, expect, it, vi } from "vitest";
import { createRemoteReport } from "../app/lib/remote-state";

const id = "50d6b013-f063-418b-aa2d-ab1ee4ec2cd7";
const reason = "other";
const detail = "Test report";
const receipt = { id: "9da8229c-f86b-481e-9db9-1ab96d7ef020", listing_id: id, place_key: null, status: "new", reason, detail, created_at: "2026-11-13T00:00:00.000Z" };

afterEach(() => vi.unstubAllGlobals());

describe("listing report receipt", () => {
  it("submits the listing and accepts a matching 201 record", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ report: receipt }, { status: 201 }));
    vi.stubGlobal("fetch", request);
    await expect(createRemoteReport({ id }, reason, detail)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith("/api/reports", expect.objectContaining({
      method: "POST", credentials: "include", body: JSON.stringify({ listingId: id, reason, detail }),
    }));
  });

  it.each([
    { status: 200, report: receipt },
    { status: 201, report: { ...receipt, listing_id: null } },
    { status: 201, report: { ...receipt, id: "not-a-uuid" } },
    { status: 201, report: { ...receipt, created_at: "not-a-date" } },
    { status: 201, report: undefined },
  ])("treats HTTP $status with an invalid receipt as unconfirmed", async ({ status, report }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ report }, { status })));
    await expect(createRemoteReport({ id }, reason, detail)).rejects.toMatchObject({ kind: "uncertain" });
  });

  it("distinguishes a rejection from a lost response", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "invalid_report" }, { status: 422 }))
      .mockRejectedValueOnce(new TypeError("connection lost")));
    await expect(createRemoteReport({ id }, reason, detail)).rejects.toMatchObject({ kind: "rejected" });
    await expect(createRemoteReport({ id }, reason, detail)).rejects.toMatchObject({ kind: "uncertain" });
  });
});
