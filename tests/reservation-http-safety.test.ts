import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("HTTP 예약 러너의 연결 전 차단 (DB/앱 실행 없음)", () => {
  it.each([
    { url: "https://exdyfbqhsnreridjbfgo.supabase.co", ref: "exdyfbqhsnreridjbfgo", key: "invalid-test-only" },
    { url: "https://unknown.example", ref: "nlzcikoxttenpcflikpd", key: "invalid-test-only" },
    { url: "https://nlzcikoxttenpcflikpd.supabase.co", ref: "nlzcikoxttenpcflikpd", key: "malformed-test-only" },
  ])("잘못된 URL/ref/서버 키는 exit 2로 앱/DB 연결 전에 차단한다", ({ url, ref, key }) => {
    const result = spawnSync(process.execPath, ["scripts/reservation-http-integration.mjs"], {
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, INTEGRATION_SUPABASE_PROJECT_REF: ref,
        INTEGRATION_TEST_MODE: "true", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "not-a-real-key",
        SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_DB_PASSWORD: "never-connect-sentinel", TEST_DB_CA_FILE: "must-not-read" },
      encoding: "utf8", timeout: 10000, windowsHide: true,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("앱 실행·쓰기 없이 종료");
    expect(result.stderr).not.toContain("never-connect-sentinel");
    expect(result.stdout).not.toContain("확인 1:");
  });
});
