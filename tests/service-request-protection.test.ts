import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ rows: {} as Record<string, Row[]>, writes: [] as Row[], admin: true }));
const sessionId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const fixture = (): Row => ({ id: requestId, session_id: sessionId, task_id: "departure", listing_id: null, service_type: "delivery", status: "method-selected", delivery_method: "parcel", origin: "Anam", destination: "Seoul", storage_duration: null, storage_location: null, estimated_cost_label: "운영자 견적", terms_note: "사용자 메모", idempotency_key: "fixture-key", version: 1, reference_code: "REQ-FIXTURE", created_at: "2026-01-01", updated_at: "2026-01-01", admin_note: "내부 메모 대역", admin_updated_by: "내부 담당자 대역", admin_updated_at: "2026-01-01", admin_cancel_reason: "내부 취소 사유 대역", deleted_by: "내부 담당자 대역", deletion_reason: "내부 삭제 사유 대역" });

// SQL 실행·실제 DB가 아닌 저장소 대역이다. 모든 반환 행에 내부 필드를 채운다.
function client() {
  return { from(table: string) {
    let action = "read", columns = "*"; let values: Row = {};
    const filters: Array<(row: Row) => boolean> = [];
    const execute = async (single = false) => {
      const rows = state.rows[table] ?? [];
      let selected = rows.filter((row) => filters.every((filter) => filter(row)));
      if (action === "insert") {
        selected = [{ ...fixture(), estimated_cost_label: null, ...values }];
        state.rows[table] = [...rows, ...selected];
        state.writes.push(values);
      } else if (action === "update") {
        selected.forEach((row) => Object.assign(row, values)); state.writes.push(values);
      }
      const project = (row: Row) => columns === "*" ? { ...row } : Object.fromEntries(columns.split(",").filter((key) => key in row).map((key) => [key, row[key]]));
      return { data: single ? selected[0] ? project(selected[0]) : null : selected.map(project), error: null };
    };
    const query = {
      select(value = "*") { columns = value; return query; },
      eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return query; },
      is(key: string, value: unknown) { return query.eq(key, value); },
      neq(key: string, value: unknown) { filters.push((row) => row[key] !== value); return query; },
      in(key: string, values: unknown[]) { filters.push((row) => values.includes(row[key])); return query; },
      order() { return query; },
      insert(value: Row) { action = "insert"; values = value; return query; },
      update(value: Row) { action = "update"; values = value; return query; },
      single: () => execute(true), maybeSingle: () => execute(true),
      then: (resolve: (value: Awaited<ReturnType<typeof execute>>) => unknown) => execute().then(resolve),
    };
    return query;
  } };
}
vi.mock("@/app/lib/server-session", () => ({ serverClient: () => client(), getOrCreateServerSession: async () => ({ id: sessionId }), authenticatedPrincipal: async () => ({ userId: "account-fixture" }), adminActor: async () => "operator-fixture", requireSameOrigin: async (r: Request) => r.headers.get("origin") === "http://localhost:3001" }));
vi.mock("@/app/lib/admin", () => ({ requireAdmin: async () => state.admin ? { client: client(), response: null } : { client: null, response: Response.json({ error: "admin_required" }, { status: 401 }) }, adminBody: (r: Request) => r.json(), audit: async () => {}, versionOf: (value: unknown) => typeof value === "number" ? value : null }));
vi.mock("@/app/lib/notifications", () => ({ notifySession: async () => {} }));
import { POST } from "../app/api/service-requests/route";
import { PATCH, POST as cancel } from "../app/api/service-requests/[id]/route";
import { POST as cancelAlias } from "../app/api/service-requests/[id]/cancel/route";
import { GET } from "../app/api/me/service-requests/route";
import { GET as accountState } from "../app/api/account/state/route";
import { PATCH as adminPatch } from "../app/api/admin/service-requests/[id]/route";
const context = () => ({ params: Promise.resolve({ id: requestId }) });
const request = (body: Row, method = "POST", origin = "http://localhost:3001") => new Request("http://localhost:3001/api/service-requests", { method, headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const input = { serviceType: "delivery", taskId: "departure", status: "method-selected", deliveryMethod: "parcel", origin: "Anam", destination: "Seoul", termsNote: "사용자 메모", idempotencyKey: "fixture-key" };
const publicKeys = "id,reference_code,listing_id,task_id,service_type,status,delivery_method,origin,destination,storage_duration,storage_location,estimated_cost_label,terms_note,version,created_at,updated_at".split(",").sort();
async function publicRow(response: Response) {
  expect(response.status).toBeLessThan(300);
  const row = (await response.json()).serviceRequest;
  expect(Object.keys(row).sort()).toEqual(publicKeys);
  return row;
}
beforeEach(() => { state.rows = { guest_service_requests: [fixture()], anonymous_sessions: [{ id: sessionId, account_user_id: "account-fixture" }] }; state.writes = []; state.admin = true; });

describe("사용자 신청 응답·견적 보호 (실제 핸들러, 모의 저장소)", () => {
  it("새 신청은 내부 필드 없이 반환하고 사용자 견적을 저장하지 않는다", async () => {
    state.rows.guest_service_requests = [];
    const row = await publicRow(await POST(request({ ...input, estimatedCostLabel: "사용자 위조 견적" })));
    expect(row.estimated_cost_label).toBeNull();
    expect(state.writes[0]).not.toHaveProperty("estimated_cost_label");
  });
  it("동일한 기존 요청을 그대로 반환해도 내부 필드가 없다", async () => {
    await publicRow(await POST(request({ ...input, estimatedCostLabel: "운영자 견적" })));
    expect(state.writes).toHaveLength(0);
  });
  it("대상 없는 중복 키 응답도 공개 필드만 반환한다", async () => {
    await publicRow(await POST(request({ serviceType: "delivery", idempotencyKey: "fixture-key" })));
    expect(state.writes).toHaveLength(0);
  });
  it.each(["사용자 위조 견적", null, undefined])("POST의 견적 변경·초기화·누락을 무시하고 기존 입력 변경은 보존한다 (%s)", async (value) => {
    const row = await publicRow(await POST(request({ ...input, destination: "Busan", estimatedCostLabel: value })));
    expect(row.estimated_cost_label).toBe("운영자 견적"); expect(row.destination).toBe("Busan");
    expect(state.writes[0]).not.toHaveProperty("estimated_cost_label");
  });
  it.each(["사용자 위조 견적", null, undefined])("PATCH의 견적 변경·초기화·누락을 무시한다 (%s)", async (value) => {
    const row = await publicRow(await PATCH(request({ origin: "KU", estimatedCostLabel: value }, "PATCH"), context()));
    expect(row.estimated_cost_label).toBe("운영자 견적"); expect(row.origin).toBe("KU");
    expect(state.writes[0]).not.toHaveProperty("estimated_cost_label");
  });
  it.each(["POST", "PATCH", "cancel", "cancel-alias"])("사용자 취소 %s의 응답도 공개 필드만 포함한다", async (path) => {
    const response = path === "POST" ? await POST(request({ ...input, status: "cancelled" })) : path === "PATCH" ? await PATCH(request({ status: "cancelled" }, "PATCH"), context()) : await (path === "cancel" ? cancel : cancelAlias)(request({}), context());
    const row = await publicRow(response);
    expect(row.status).toBe("cancelled"); expect(row.estimated_cost_label).toBe("운영자 견적");
  });
  it("본인 GET과 계정 연결 GET은 같은 공개 필드를 사용한다", async () => {
    const mine = await (await GET()).json();
    const account = await (await accountState(new Request("http://localhost:3001"))).json();
    expect(Object.keys(mine.serviceRequests[0]).sort()).toEqual(publicKeys);
    expect(account.serviceRequests).toEqual(mine.serviceRequests);
  });
  it("다른 origin과 다른 세션의 수정·운영 상태 승격을 거절한다", async () => {
    expect((await POST(request(input, "POST", "https://other.test"))).status).toBe(403);
    state.rows.guest_service_requests[0].session_id = "other-session";
    expect((await PATCH(request({}, "PATCH"), context())).status).toBe(404);
    state.rows.guest_service_requests[0].session_id = sessionId;
    expect((await PATCH(request({ status: "completed" }, "PATCH"), context())).status).toBe(422);
  });
  it("관리자 정당한 견적·내부 메모 수정은 유지되고 사용자는 관리자 수정을 못 한다", async () => {
    const response = await adminPatch(request({ version: 1, estimatedCostLabel: "변경된 운영 견적", adminNote: "변경된 내부 메모" }, "PATCH"), context());
    expect(response.status).toBe(200);
    const body = await response.json(); expect(body.serviceRequest.admin_note).toBe("변경된 내부 메모");
    expect(body.serviceRequest.estimated_cost_label).toBe("변경된 운영 견적");
    const user = await publicRow(await PATCH(request({ estimatedCostLabel: null }, "PATCH"), context()));
    expect(user.estimated_cost_label).toBe("변경된 운영 견적");
    state.admin = false; expect((await adminPatch(request({}, "PATCH"), context())).status).toBe(401);
  });
});
