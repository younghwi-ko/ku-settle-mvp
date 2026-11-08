import { afterEach, describe, expect, it, vi } from "vitest";
import { applyServerReservation, cancelServerReservation, checkServerReservation, saveServerReservation } from "../app/lib/reservation-request";
import { emptyPreferences } from "../app/lib/local-data";

const productId = "11111111-1111-4111-8111-111111111111";
const reservationId = "22222222-2222-4222-8222-222222222222";
const pickup = { pickupDate: "2099-01-01", pickupStartTime: "10:00", pickupEndTime: "11:00" };
const row = (overrides = {}) => ({ id: reservationId, listing_id: productId, buyer_name: "Test", status: "active", created_at: "2026-01-01T00:00:00Z", expires_at: "2099-01-01T12:00:00Z", pickup_date: pickup.pickupDate, pickup_start_time: "10:00:00", pickup_end_time: "11:00:00", ...overrides });
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());

describe("예약 요청·확인 동작 (모의 HTTP, 실제 DB 아님)", () => {
  it("유효한 성공 응답의 서버 ID로만 예약을 확정한다", async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ reservation: row() }, 201)); vi.stubGlobal("fetch", fetch);
    const result = await saveServerReservation(productId, "Test", pickup, "attempt-1");
    expect(result.id).toBe(reservationId); expect(result.status).toBe("active");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "include", headers: { "x-idempotency-key": "attempt-1" } });
    expect(applyServerReservation(emptyPreferences(), result).reservedProductIds).toEqual([productId]);
  });
  it.each([400, 401, 403, 404, 409, 422])("HTTP %s 거절은 확정 없이 반환한다", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "rejected" }, status)));
    await expect(saveServerReservation(productId, "Test", pickup, "attempt-1")).rejects.toMatchObject({ kind: "rejected" });
  });
  it.each([408, 429, 500, 502, 503, 504])("HTTP %s는 저장 실패로 단정하지 않는다", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({}, status)));
    await expect(saveServerReservation(productId, "Test", pickup, "attempt-1")).rejects.toMatchObject({ kind: "uncertain" });
  });
  it.each([new TypeError("network"), new DOMException("timeout", "TimeoutError")])("응답 유실·타임아웃은 확인 필요 상태다", async (error) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(saveServerReservation(productId, "Test", pickup, "attempt-1")).rejects.toMatchObject({ kind: "uncertain" });
  });
  it.each([{}, row({ id: "local-id" }), row({ listing_id: "other" }), row({ status: "unknown" }), row({ expires_at: null }), row({ pickup_end_time: "09:00:00" }), row({ pickup_date: "2099-01-02" })])("잘못되거나 다른 요청의 응답은 확정하지 않는다", async (reservation) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ reservation })));
    await expect(saveServerReservation(productId, "Test", pickup, "attempt-1")).rejects.toMatchObject({ kind: "uncertain" });
  });
  it.each(["cancelled", "expired", "completed"])("재전송된 %s 예약을 활성화하지 않는다", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ reservation: row({ status }) })));
    const result = await saveServerReservation(productId, "Test", pickup, "attempt-1");
    expect(result.status).toBe(status);
    expect(applyServerReservation(emptyPreferences(), result).reservedProductIds).toEqual([]);
  });
  it("만료 시간이 지난 active 응답도 만료로 처리한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ reservation: row({ expires_at: "2020-01-01T00:00:00Z" }) })));
    expect((await saveServerReservation(productId, "Test", pickup, "attempt-1")).status).toBe("expired");
  });
  it("응답 유실 후 현재 세션의 같은 요청을 조회한다", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("lost")).mockResolvedValueOnce(reply({ reservation: row() })); vi.stubGlobal("fetch", fetch);
    await expect(saveServerReservation(productId, "Test", pickup, "attempt-1")).rejects.toMatchObject({ kind: "uncertain" });
    expect((await checkServerReservation(productId, "attempt-1"))?.id).toBe(reservationId);
    expect(fetch.mock.calls[1][0]).toContain("requestKey=attempt-1");
    expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: "include", cache: "no-store" });
  });
  it("재조회 실패와 조회 성공 후 미확인을 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply({}, 502)).mockResolvedValueOnce(reply({ reservation: null })));
    await expect(checkServerReservation(productId, "attempt-1")).rejects.toMatchObject({ kind: "uncertain" });
    expect(await checkServerReservation(productId, "attempt-1")).toBeNull();
  });
  it("같은 요청의 재시도는 같은 키를 사용한다", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("lost")).mockResolvedValueOnce(reply({ reservation: row() })); vi.stubGlobal("fetch", fetch);
    await expect(saveServerReservation(productId, "Test", pickup, "attempt-1")).rejects.toThrow();
    await saveServerReservation(productId, "Test", pickup, "attempt-1");
    expect(fetch.mock.calls.map((call) => call[1].headers["x-idempotency-key"])).toEqual(["attempt-1", "attempt-1"]);
  });
  it("일정 수정은 기존 서버 ID의 PATCH이며 취소도 같은 ID를 사용한다", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ reservation: row() })).mockResolvedValueOnce(reply({ reservation: row({ status: "cancelled" }) })); vi.stubGlobal("fetch", fetch);
    const edited = await saveServerReservation(productId, "Test", pickup, "attempt-1", reservationId);
    expect(fetch.mock.calls[0][0]).toBe(`/api/reservations/${reservationId}`);
    expect(fetch.mock.calls[0][1].method).toBe("PATCH");
    const cancelled = await cancelServerReservation(edited);
    expect(fetch.mock.calls[1][0]).toBe(`/api/reservations/${reservationId}`);
    expect(cancelled.status).toBe("cancelled");
    const active = applyServerReservation(emptyPreferences(), edited);
    const final = applyServerReservation(active, cancelled);
    expect(final.reservations).toHaveLength(1); expect(final.reservedProductIds).toEqual([]);
  });
  it("취소가 거절되면 기존 활성 상태는 유지된다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({}, 409)));
    const active = applyServerReservation(emptyPreferences(), { id: reservationId, productId, buyerName: "Test", status: "active", createdAt: "2026-01-01", ...pickup });
    await expect(cancelServerReservation(active.reservations[0])).rejects.toMatchObject({ kind: "rejected" });
    expect(active.reservedProductIds).toEqual([productId]);
  });
  it("오래된 취소 응답이 같은 상품의 다른 활성 예약을 지우지 않는다", () => {
    const active = { id: reservationId, productId, buyerName: "Test", status: "active" as const, createdAt: "2026-01-01", ...pickup };
    const preferences = applyServerReservation(emptyPreferences(), active);
    const result = applyServerReservation(preferences, { ...active, id: "33333333-3333-4333-8333-333333333333", status: "cancelled" });
    expect(result.reservedProductIds).toEqual([productId]);
    expect(result.reservations).toHaveLength(2);
  });
});
