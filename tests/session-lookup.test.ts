import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ cookie: undefined as string | undefined, row: null as { id: string; token_hash: string; revoked_at: string | null } | null, lookupError: false, lookupThrows: false, inserts: 0, replacements: 0, touches: 0 }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined, set: () => { state.replacements++; } }), headers: async () => new Headers() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from() {
  let action = "read", activeOnly = false;
  const query = { select() { return query; }, eq() { return query; }, is(key: string, value: unknown) { activeOnly = key === "revoked_at" && value === null; return query; },
    update() { state.touches++; return query; }, insert() { action = "insert"; return query; },
    maybeSingle: async () => { if (state.lookupThrows) throw new Error("fixture-lookup-error"); return { data: state.lookupError || (activeOnly && state.row?.revoked_at) ? null : state.row, error: state.lookupError ? { code: "fixture-transient-error" } : null }; },
    single: async () => { if (action === "insert") state.inserts++; return { data: { id: "new-session" }, error: null }; },
  }; return query;
} }) }));
import { getOrCreateServerSession } from "../app/lib/server-session";
import { sessionOrError } from "../app/lib/server-api";
import { POST as bootstrap } from "../app/api/session/bootstrap/route";
import { GET as support } from "../app/api/support-tickets/route";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://fixture.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  Object.assign(state, { cookie: "a".repeat(43), row: { id: "existing-session", token_hash: "fixture-hash", revoked_at: null }, lookupError: false, lookupThrows: false, inserts: 0, replacements: 0, touches: 0 });
});

afterEach(() => vi.unstubAllEnvs());
describe("익명 세션 조회 실패 보호 (실제 함수, 모의 DB·쿠키)", () => {
  it.each(["response-error", "exception"])("조회 오류 %s는 새 세션이나 쿠키를 만들지 않고 503이다", async (kind) => {
    state.lookupError = kind === "response-error"; state.lookupThrows = kind === "exception";
    const result = await sessionOrError();
    expect(result.response?.status).toBe(503); expect(result.session).toBeNull();
    expect((await bootstrap()).status).toBe(503);
    expect((await support()).status).toBe(503);
    expect(state).toMatchObject({ cookie: "a".repeat(43), inserts: 0, replacements: 0, touches: 0 });
  });
  it("정상 세션은 유지하고 last_seen만 갱신한다", async () => {
    expect((await getOrCreateServerSession())?.id).toBe("existing-session");
    expect(state).toMatchObject({ inserts: 0, replacements: 0, touches: 1 });
  });
  it.each(["cookie-missing", "not-found", "revoked"])("쿠키 없음·조회 성공 후 없음·폐기는 새 세션을 만든다 (%s)", async (kind) => {
    if (kind === "cookie-missing") state.cookie = undefined;
    if (kind === "not-found") state.row = null;
    if (kind === "revoked") state.row!.revoked_at = "2026-01-01";
    expect((await getOrCreateServerSession())?.id).toBe("new-session");
    expect(state).toMatchObject({ inserts: 1, replacements: 1, touches: 0 });
  });
});
