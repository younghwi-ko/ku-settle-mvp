import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";
import { handleAuthEmailRequest, type AuthEmailDependencies, type AuthEmailHookPayload } from "../supabase/functions/_shared/send-email-handler";

const secret = `whsec_${Buffer.from("ku-settle-test-webhook-secret").toString("base64")}`;

function signedRequest(payload: AuthEmailHookPayload, overrideSignature?: string) {
  const body = JSON.stringify(payload);
  const webhook = new Webhook(secret);
  const id = "msg_test_001";
  const timestamp = new Date();
  return new Request("https://example.test/send-email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": overrideSignature ?? webhook.sign(id, timestamp, body)
    },
    body
  });
}

function payload(locale: unknown = "en"): AuthEmailHookPayload {
  return {
    user: { email: "redacted-user@korea.ac.kr", user_metadata: { preferred_language: locale } },
    email_data: { token: "123456", email_action_type: "signup" }
  };
}

function dependencies() {
  const messages: unknown[] = [];
  const logs: unknown[] = [];
  const deps: AuthEmailDependencies = {
    verify: (body, headers, value) => new Webhook(value).verify(body, headers),
    send: vi.fn(async (message) => { messages.push(message); return { ok: true, status: 200 }; }),
    info: (event, context) => logs.push({ event, context }),
    error: (event) => logs.push({ event })
  };
  return { deps, messages, logs };
}

const environment = { webhookSecret: secret, apiKey: "test-api-key", from: "KU Settle <test@example.test>", replyTo: "reply@example.test" };

describe("send-email security", () => {
  it("rejects missing and forged Standard Webhooks signatures", async () => {
    const unsigned = new Request("https://example.test/send-email", { method: "POST", body: JSON.stringify(payload()) });
    expect((await handleAuthEmailRequest(unsigned, environment, dependencies().deps)).status).toBe(401);
    expect((await handleAuthEmailRequest(signedRequest(payload(), "v1,forged"), environment, dependencies().deps)).status).toBe(401);
  });

  it.each(["en", "ko", "ja", "zh-CN"] as const)("renders and accepts a valid %s request without logging sensitive values", async (locale) => {
    const { deps, messages, logs } = dependencies();
    const response = await handleAuthEmailRequest(signedRequest(payload(locale)), environment, deps);
    expect(response.status).toBe(200);
    expect(messages).toHaveLength(1);
    expect(JSON.stringify(messages[0])).toContain("123456");
    const serializedLogs = JSON.stringify(logs);
    expect(serializedLogs).not.toContain("123456");
    expect(serializedLogs).not.toContain("redacted-user@korea.ac.kr");
  });

  it("falls back to English and never reports success without provider configuration", async () => {
    const fallback = dependencies();
    expect((await handleAuthEmailRequest(signedRequest(payload("zh-TW")), environment, fallback.deps)).status).toBe(200);
    expect(JSON.stringify(fallback.messages[0])).toContain("Your KU Settle verification code");

    const missing = dependencies();
    const response = await handleAuthEmailRequest(signedRequest(payload()), { webhookSecret: secret }, missing.deps);
    expect(response.status).toBe(500);
    expect(missing.messages).toHaveLength(0);
  });

  it("returns an error when the provider rejects the request", async () => {
    const setup = dependencies();
    setup.deps.send = vi.fn(async () => ({ ok: false, status: 503 }));
    expect((await handleAuthEmailRequest(signedRequest(payload()), environment, setup.deps)).status).toBe(500);
  });
});

describe("delete-account security boundary", () => {
  const source = readFileSync(new URL("../supabase/functions/delete-account/index.ts", import.meta.url), "utf8");

  it("derives the deletion target from the verified session and never from the request body", () => {
    expect(source).toContain("scoped.auth.getUser()");
    expect(source).toContain("deleteUser(user.id, false)");
    expect(source).not.toMatch(/request\.(json|formData|text)\s*\(/);
    expect(source).not.toMatch(/body[^\n]*user_id|user_id[^\n]*body/i);
  });

  it("keeps the service role server-side and out of responses and logs", () => {
    expect(source).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(source).not.toMatch(/console\.(log|info|error|warn)/);
    expect(source).not.toMatch(/Response\.json\([^\n]*service/i);
  });
});
