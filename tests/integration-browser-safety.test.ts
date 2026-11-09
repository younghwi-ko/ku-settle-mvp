import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function listen(server: Server) {
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("대역 서버 주소 없음");
  return `http://127.0.0.1:${address.port}`;
}
const close = (server: Server) => new Promise<void>((done) => { server.closeAllConnections(); server.close(() => done()); });

describe("브라우저 통합 러너의 격리 사전 차단 (로컬 HTTP 대역, 실제 DB 아님)", () => {
  it.each(["wrong-ref", "not-isolated", "failure", "invalid-json", "same-origin-redirect", "other-origin-redirect", "verified"])("격리 확인 %s의 앱 진입·차단 순서를 실제 러너로 검사한다", async (kind) => {
    const requests: string[] = []; let redirected = 0; let sensitiveHeaderSeen = false; let preflightOrigin: string | undefined;
    const sink = createServer((_req, res) => { redirected++; res.writeHead(503); res.end("{}"); });
    const sinkUrl = await listen(sink);
    const server = createServer((req, res) => {
      requests.push(`${req.method} ${req.url}`);
      if (req.url?.startsWith("/api/integration/environment")) {
        sensitiveHeaderSeen ||= Boolean(req.headers.authorization || req.headers.cookie);
        preflightOrigin = req.headers.origin;
        if (kind.endsWith("redirect")) { res.writeHead(307, { location: kind === "same-origin-redirect" ? "/redirected" : sinkUrl }); res.end(); return; }
        res.writeHead(kind === "failure" ? 503 : 200, { "content-type": "application/json" });
        res.end(kind === "invalid-json" ? "invalid" : JSON.stringify({ isolated: kind !== "not-isolated", projectRef: kind === "wrong-ref" ? "different-ref" : "isolated-fixture" })); return;
      }
      if (req.url === "/redirected") { res.writeHead(503); res.end("{}"); return; }
      if (req.url?.startsWith("/api/")) { res.writeHead(503); res.end("{}"); return; }
      if (kind === "verified") {
        // 사전 확인 성공 뒤에만 화면 진입을 허용한다. 지원 API 대역은 503으로 종료시킨다.
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end('<html><h1>운영 문의</h1><button onclick="fetch(\'/api/support-tickets\')">운영 문의</button></html>'); return;
      }
      // 잘못된 러너가 먼저 앱을 열면 초기화 요청까지 기록하는 대역 페이지다.
      res.writeHead(200, { "content-type": "text/html" }); res.end('<html><script>fetch("/api/session/bootstrap",{method:"POST"})</script></html>');
    });
    const base = await listen(server);
    let child: ReturnType<typeof spawn> | undefined;
    try {
      child = spawn(process.execPath, [resolve("scripts/integration-support-browser.mjs")], { env: { ...process.env, TEST_BASE_URL: base, TEST_SUPABASE_PROJECT_REF: "isolated-fixture", TEST_ADMIN_API_TOKEN: "test-only-admin", TEST_INTEGRATION_SECRET: "test-only-fault" }, stdio: ["ignore", "pipe", "pipe"] });
      let output = ""; child.stdout!.on("data", (data) => { output += data; }); child.stderr!.on("data", (data) => { output += data; });
      const [code] = await once(child, "close");
      if (kind === "verified") {
        expect(code).toBe(1); expect(output).toContain("browser integration result: FAIL");
        expect(requests[0]).toBe("GET /api/integration/environment/");
        expect(requests).toContain("GET /?lang=ko");
        expect(requests.every((request) => request.startsWith("GET "))).toBe(true);
      } else {
        expect(code).toBe(2); expect(output).toContain("preflight");
        expect(requests).toEqual(["GET /api/integration/environment/"]);
      }
      expect(redirected).toBe(0);
      expect(sensitiveHeaderSeen).toBe(false);
      expect(preflightOrigin).toBe(base);
      expect(output).not.toContain("test-only-admin"); expect(output).not.toContain("test-only-fault");
    } finally { child?.kill(); await close(server); await close(sink); }
  }, 30000);
});
