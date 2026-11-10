import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: "buyer-a", rows: [] as Record<string, unknown>[], status: "reserved", rpc: vi.fn() }));
// RPC의 원자성은 별도 실제 DB 테스트에서 검증한다. 여기서는 실제 HTTP 핸들러와 RPC 경계를 검증한다.
function client() {
  return { rpc: state.rpc, from(table: string) {
    const filters: Array<[string, unknown]> = [];
    const execute = async () => ({ data: table === "guest_listings" ? { status: state.status } : state.rows.find(row => filters.every(([key,value]) => row[key] === value)) ?? null, error: null });
    const query = { select() { return query; }, eq(key: string,value: unknown) { filters.push([key,value]); return query; }, maybeSingle: execute };
    return query;
  } };
}
vi.mock("@/app/lib/server-session", () => ({ serverClient: () => client(), getOrCreateServerSession: async () => ({ id: state.session, tokenHash: "test-only" }), requireSameOrigin: async (r: Request) => r.headers.get("origin") === "http://localhost:3001" }));
vi.mock("@/app/lib/reservation-expiry", () => ({ expireReservations: async () => {} }));
vi.mock("@/app/lib/notifications", () => ({ notifySession: vi.fn() }));
import { GET, POST } from "../app/api/marketplace/listings/[id]/reservations/route";
import { notifySession } from "../app/lib/notifications";
const listingId = "11111111-1111-4111-8111-111111111111";
const reservationId = "22222222-2222-4222-8222-222222222222";
const pickup = { pickupDate: "2099-01-01", pickupStartTime: "10:00", pickupEndTime: "11:00" };
const row = (status = "active") => ({ id: reservationId, listing_id: listingId, buyer_session_id: "buyer-a", status, idempotency_key: "attempt" });
const context = () => ({ params: Promise.resolve({ id: listingId }) });
const post = (origin = "http://localhost:3001", body = pickup) => new Request(
  "http://localhost:3001/api/marketplace/listings/" + listingId + "/reservations", { method: "POST", headers: { origin, "content-type": "application/json", "x-idempotency-key": "attempt" }, body: JSON.stringify({ buyerName: "Fixture", ...body }) });
beforeEach(() => { vi.clearAllMocks(); state.session = "buyer-a"; state.rows = []; state.status = "reserved"; });
describe("예약 HTTP 핸들러 (모의 RPC, 실제 DB 아님)", () => {
  it("다른 origin은 RPC 호출 전에 거부한다", async () => {
    expect((await POST(post("https://other.test"), context())).status).toBe(403); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("트랜잭션 생성 결과의 서버 ID를 201로 반환한다", async () => {
    state.rpc.mockResolvedValue({ data: { reservation: row(), created: true }, error: null });
    const response = await POST(post(),context());
    expect(response.status).toBe(201); expect((await response.json()).reservation.id).toBe(reservationId);
    expect(state.rpc).toHaveBeenCalledWith("create_guest_reservation", { p_listing_id: listingId, p_session_id: "buyer-a", p_buyer_name: "Fixture", p_pickup_date: pickup.pickupDate, p_start: "10:00", p_end: "11:00", p_key: "attempt" });
    expect(notifySession).toHaveBeenCalledTimes(1);
  });
  it.each(["active","cancelled","expired","completed","soft_deleted"])("재전송 %s 결과를 변경하거나 다시 알리지 않는다", async status => {
    state.rpc.mockResolvedValue({ data: { reservation: row(status), created: false }, error: null });
    const response = await POST(post(),context()); expect(response.status).toBe(200);
    expect((await response.json()).reservation.status).toBe(status); expect(notifySession).not.toHaveBeenCalled();
  });
  it.each(["listing_unavailable","idempotency_conflict","cannot_reserve_own_listing"])("DB 거부 %s는 409이며 성공 알림이 없다",async message => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message } });
    const response = await POST(post(),context()); expect(response.status).toBe(409); expect((await response.json()).error).toBe(message); expect(notifySession).not.toHaveBeenCalled();
  });
  it.each(["private failure", "constructor"])("알 수 없는 저장 오류 %s는 내부 내용을 노출하지 않는 502다",async message => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message } });
    const response = await POST(post(),context()); expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("reservation_create_failed"); expect(notifySession).not.toHaveBeenCalled();
  });
  it("현재 구매 세션만 키로 조회하고 상품 상태가 불명확하면 확정하지 않는다",async () => {
    state.rows=[row()]; const request=()=>new Request("http://localhost:3001/api/marketplace/listings/"+listingId+"/reservations?requestKey=attempt");
    expect((await (await GET(request(),context())).json()).reservation.id).toBe(reservationId);
    state.status="sold"; expect((await GET(request(),context())).status).toBe(502);
    for(const actor of ["buyer-b","seller"]) { state.session=actor; expect((await (await GET(request(),context())).json()).reservation).toBeNull(); }
  });
  it("잘못된 일정은 RPC 호출 전에 거부한다",async () => {
    expect((await POST(post(undefined,{...pickup,pickupEndTime:"10:00"}),context())).status).toBe(422); expect(state.rpc).not.toHaveBeenCalled();
  });
});
