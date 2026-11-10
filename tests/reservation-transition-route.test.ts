import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ actor: "buyer", admin: true, rpc: vi.fn(), rows: [] as unknown[], audit: vi.fn() }));
const id = "22222222-2222-4222-8222-222222222222";
const saved = { id, listing_id: "listing", buyer_session_id: "buyer", status: "active", version: 4 };
function client() {
  return { rpc: state.rpc, from(table: string) {
    const execute = async () => ({ data: table === "guest_listings" ? { session_id: "seller", status: "reserved" } : saved, error: null });
    const query = { select() { return query; }, eq() { return query; }, lt() { return query; }, limit: async () => ({ data: state.rows, error: null }), maybeSingle: execute, single: execute };
    return query;
  } };
}
vi.mock("@/app/lib/server-session", () => ({ serverClient: client, getOrCreateServerSession: async () => ({ id: state.actor }), requireSameOrigin: async (r: Request) => r.headers.get("origin") === "http://localhost:3001" }));
vi.mock("@/app/lib/admin", () => ({ requireAdmin: async () => state.admin ? { client: client(), response: null } : { client: null, response: Response.json({ error: "admin_required" }, { status: 401 }) }, adminBody: async (r: Request) => r.json(), versionOf: (x: unknown) => typeof x === "number" ? x : null, audit: state.audit }));
vi.mock("@/app/lib/notifications", () => ({ notifySession: vi.fn() }));
import { PATCH as userPatch } from "../app/api/reservations/[id]/route";
import { PATCH as adminPatch, DELETE } from "../app/api/admin/reservations/[id]/route";
import { expireReservations } from "../app/lib/reservation-expiry";
import { notifySession } from "../app/lib/notifications";
const context = () => ({ params: Promise.resolve({ id }) });
const request = (body = { status: "cancelled", version: 4 }) => new Request("http://localhost:3001/api/reservations/" + id, { method: "PATCH", headers: { origin: "http://localhost:3001", "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); state.actor = "buyer"; state.admin = true; state.rows = []; state.rpc.mockResolvedValue({ data: { reservation: { ...saved, status: "cancelled" }, changed: true }, error: null }); });
describe("종료 경로와 RPC 연결 (모의 저장소)", () => {
  it.each(["buyer", "seller"])("%s 취소는 현재 version·세션을 RPC에 전달한다", async actor => {
    state.actor = actor; expect((await userPatch(request(), context())).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("transition_guest_reservation", { p_id: id, p_session_id: actor, p_status: "cancelled", p_version: 4, p_mode: "user" });
  });
  it("다른 세션의 취소는 DB 수정 호출 전에 거부한다", async () => {
    state.actor = "other"; expect((await userPatch(request(), context())).status).toBe(403); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("관리자 인증 실패와 오래된 version을 거부한다", async () => {
    state.admin = false; expect((await adminPatch(request(), context())).status).toBe(401);
    state.admin = true; const response = await adminPatch(request({ status: "completed", version: 3 }), context());
    expect(response.status).toBe(409); expect((await response.json()).error).toBe("version_conflict"); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("관리자 완료·DELETE도 동일한 트랜잭션 RPC를 사용한다", async () => {
    await adminPatch(request({ status: "completed", version: 4 }), context());
    expect(state.rpc).toHaveBeenLastCalledWith("transition_guest_reservation", expect.objectContaining({ p_mode: "admin", p_status: "completed", p_version: 4 }));
    await DELETE(request(), context());
    expect(state.rpc).toHaveBeenLastCalledWith("transition_guest_reservation", expect.objectContaining({ p_mode: "admin", p_status: "soft_deleted" }));
  });
  it("RPC의 충돌과 저장 오류를 구분하며 실패한 변경을 감사 성공으로 기록하지 않는다", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "version_conflict" } });
    expect((await userPatch(request(), context())).status).toBe(409);
    state.rpc.mockResolvedValue({ data: null, error: { message: "private internal error" } });
    const response = await adminPatch(request(), context()); expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("reservation_update_failed"); expect(state.audit).not.toHaveBeenCalled();
  });
  it("만료 충돌·실패는 알리지 않고 실제 종료 결과만 알린다", async () => {
    state.rows = [{ ...saved, buyer_session_id: "buyer" }];
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: "version_conflict" } })
      .mockResolvedValueOnce({ data: { changed: false }, error: null })
      .mockResolvedValueOnce({ data: { changed: true }, error: null });
    await expireReservations(client() as never); await expireReservations(client() as never);
    expect(notifySession).not.toHaveBeenCalled(); await expireReservations(client() as never);
    expect(state.rpc).toHaveBeenLastCalledWith("transition_guest_reservation", { p_id: id, p_session_id: null, p_status: "expired", p_version: 4, p_mode: "expiry" });
    expect(notifySession).toHaveBeenCalledTimes(1);
  });
});
