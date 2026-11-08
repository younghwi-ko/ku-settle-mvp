import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: "buyer-a", rows: [] as Record<string, unknown>[], status: "active", insertConflict: false, inserts: 0, failListingUpdate: false, publishOnListing: false }));

// 실제 DB가 아닌 메모리 기반 대역으로 Route Handler를 실행한다.
function client() {
  return { from(table: string) {
    let action = "select"; let values: Record<string, unknown> = {}; const filters: Array<[string, unknown]> = [];
    const matches = (row: Record<string, unknown>) => filters.every(([key, value]) => row[key] === value);
    const execute = async () => {
      if (table === "guest_listings") {
        if (state.publishOnListing) { state.rows.push(active()); state.status = "reserved"; state.publishOnListing = false; }
        if (action === "update") { if (state.failListingUpdate) return { data: null, error: { code: "failed" } }; state.status = String(values.status); }
        return { data: { id: listingId, session_id: "seller", status: state.status }, error: null };
      }
      if (action === "insert") {
        state.inserts++;
        const row = { ...active(), ...values };
        state.rows.push(row);
        return state.insertConflict ? { data: null, error: { code: "23505" } } : { data: row, error: null };
      }
      return { data: state.rows.find(matches) ?? null, error: null };
    };
    const query = { select() { return query; }, eq(key: string, value: unknown) { filters.push([key, value]); return query; }, insert(row: Record<string, unknown>) { action = "insert"; values = row; return query; }, update(row: Record<string, unknown>) { action = "update"; values = row; return query; }, maybeSingle: execute, single: execute };
    return query;
  } };
}
vi.mock("@/app/lib/server-session", () => ({ serverClient: () => client(), getOrCreateServerSession: async () => ({ id: state.session, tokenHash: "test-only" }), requireSameOrigin: async (r: Request) => r.headers.get("origin") === "http://localhost:3001" }));
vi.mock("@/app/lib/reservation-expiry", () => ({ expireReservations: async () => {} }));
vi.mock("@/app/lib/notifications", () => ({ notifySession: async () => {} }));
import { GET, POST } from "../app/api/marketplace/listings/[id]/reservations/route";
const listingId = "11111111-1111-4111-8111-111111111111";
const reservationId = "22222222-2222-4222-8222-222222222222";
const pickup = { pickupDate: "2099-01-01", pickupStartTime: "10:00", pickupEndTime: "11:00" };
const active = (status = "active") => ({ id: reservationId, listing_id: listingId, buyer_session_id: "buyer-a", buyer_name: "Fixture", status, pickup_date: pickup.pickupDate, pickup_start_time: "10:00:00", pickup_end_time: "11:00:00", idempotency_key: "attempt", expires_at: "2099-01-01T00:00:00Z" });
const context = () => ({ params: Promise.resolve({ id: listingId }) });
const post = (origin = "http://localhost:3001", body = pickup) => new Request(`http://localhost:3001/api/marketplace/listings/${listingId}/reservations`, { method: "POST", headers: { origin, "content-type": "application/json", "x-idempotency-key": "attempt" }, body: JSON.stringify({ buyerName: "Fixture", ...body }) });
beforeEach(() => Object.assign(state, { session: "buyer-a", rows: [], status: "active", insertConflict: false, inserts: 0, failListingUpdate: false, publishOnListing: false }));
describe("예약 Route Handler 실행 (모의 저장소, 실제 DB 아님)", () => {
  it("다른 origin의 생성 요청을 거절한다", async () => expect((await POST(post("https://other.test"), context())).status).toBe(403));
  it("같은 요청의 순차 재전송은 같은 예약이며 추가 insert가 없다", async () => {
    const a = await POST(post(), context()); const b = await POST(post(), context());
    expect(a.status).toBe(201); expect(b.status).toBe(200); expect(state.inserts).toBe(1);
    expect((await b.json()).reservation.id).toBe(reservationId);
  });
  it("중복 insert 충돌 때 같은 요청의 저장된 결과를 다시 읽는다", async () => {
    state.insertConflict = true;
    const result = await POST(post(), context());
    expect(result.status).toBe(200); expect((await result.json()).reservation.id).toBe(reservationId);
  });
  it("두 조회 사이 다른 요청이 저장됐으면 거절 대신 같은 예약을 반환한다", async () => {
    state.publishOnListing = true;
    const result = await POST(post(), context());
    expect(result.status).toBe(200); expect(state.inserts).toBe(0);
    expect((await result.json()).reservation.id).toBe(reservationId);
  });
  it.each(["cancelled", "expired", "completed"])("재전송 %s 예약을 active로 바꾸지 않는다", async (status) => {
    state.rows = [active(status)];
    const result = await POST(post(), context());
    expect((await result.json()).reservation.status).toBe(status); expect(state.inserts).toBe(0);
  });
  it("같은 키를 다른 일정으로 재사용하면 409다", async () => {
    state.rows = [active()];
    expect((await POST(post(undefined, { ...pickup, pickupEndTime: "12:00" }), context())).status).toBe(409);
  });
  it("상품 상태 갱신 실패는 502이며 저장된 예약은 지우지 않는다", async () => {
    state.failListingUpdate = true;
    expect((await POST(post(), context())).status).toBe(502); expect(state.rows).toHaveLength(1);
    state.failListingUpdate = false;
    expect((await POST(post(), context())).status).toBe(200); expect(state.inserts).toBe(1);
  });
  it("현재 구매 세션만 요청 키로 예약을 조회한다", async () => {
    state.rows = [active()]; state.status = "reserved";
    const request = () => new Request(`http://localhost:3001/api/marketplace/listings/${listingId}/reservations?requestKey=attempt`);
    expect((await (await GET(request(), context())).json()).reservation.id).toBe(reservationId);
    state.session = "buyer-b";
    expect((await (await GET(request(), context())).json()).reservation).toBeNull();
    state.session = "seller";
    expect((await (await GET(request(), context())).json()).reservation).toBeNull();
  });
  it("생성의 종료 시각은 시작 시각보다 뒤여야 한다", async () => {
    expect((await POST(post(undefined, { ...pickup, pickupEndTime: "10:00" }), context())).status).toBe(422);
    expect(state.inserts).toBe(0);
  });
});
