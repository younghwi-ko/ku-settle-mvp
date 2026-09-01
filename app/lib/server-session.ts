import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SESSION_COOKIE = "ku_settle_session";
const ADMIN_COOKIE = "ku_settle_admin";
const ADMIN_ACTOR_COOKIE = "ku_settle_admin_actor";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
const ADMIN_TTL_SECONDS = 60 * 60 * 8;
const ADMIN_AUTH_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_API_WINDOW_MS = 60 * 1000;
const ADMIN_AUTH_LIMIT = 10;
const ADMIN_API_LIMIT = 60;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();

export type ServerSession = { id: string; tokenHash: string };
export type AccountPrincipal = { userId: string; email: string | null };

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function fingerprint(value: string) {
  const secret = process.env.ADMIN_API_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || "ku-settle-rate-limit";
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}
function clientFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return fingerprint(`${forwarded}:${userAgent}`);
}
function serverClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
function cookieOptions(maxAge: number) { return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge }; }

export function configurationReady() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
export function accountSignupEnabled() { return process.env.ACCOUNT_SIGNUP_ENABLED === "true"; }

export async function getOrCreateServerSession() {
  const client = serverClient();
  if (!client) return null;
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{40,100}$/.test(existing)) {
    const tokenHash = hashToken(existing);
    const { data } = await client.from("anonymous_sessions").select("id, token_hash").eq("token_hash", tokenHash).is("revoked_at", null).maybeSingle();
    if (data) {
      await client.from("anonymous_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
      return { id: data.id as string, tokenHash } satisfies ServerSession;
    }
  }
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const { data, error } = await client.from("anonymous_sessions").insert({ token_hash: tokenHash }).select("id").single();
  if (error || !data) {
    console.error("anonymous_session_bootstrap_failed", { code: error?.code ?? "no_data" });
    throw new Error("session_bootstrap_failed");
  }
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));
  return { id: data.id as string, tokenHash } satisfies ServerSession;
}

export async function requireSameOrigin(request: Request) {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const expectedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? new URL(request.url).host;
    const expectedProtocol = requestHeaders.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    const supplied = new URL(origin);
    return supplied.host === expectedHost && supplied.protocol === `${expectedProtocol}:`;
  } catch { return false; }
}

export async function isAdminRequest() {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;
  return Boolean(parseAdminSession((await cookies()).get(ADMIN_COOKIE)?.value, expected));
}

function actorSignature(value: string, secret = process.env.ADMIN_API_TOKEN || "") { return createHmac("sha256", secret).update(value).digest("base64url"); }
function parseAdminSession(raw: string | undefined, secret: string) {
  if (!raw) return null;
  const [issuedAt, nonce, encoded, signature] = raw.split(".");
  if (!issuedAt || !/^\d{13}$/.test(issuedAt) || !/^[A-Za-z0-9_-]{20,80}$/.test(nonce ?? "") || !encoded || !signature) return null;
  if (Date.now() - Number(issuedAt) > ADMIN_TTL_SECONDS * 1000 || Number(issuedAt) > Date.now() + 60_000) return null;
  const payload = `${issuedAt}.${nonce}.${encoded}`;
  const expected = actorSignature(payload, secret);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  const actor = Buffer.from(encoded, "base64url").toString("utf8").trim();
  return actor.length >= 1 && actor.length <= 80 ? { actor, issuedAt: Number(issuedAt) } : null;
}
export async function adminActor() {
  const secret = process.env.ADMIN_API_TOKEN;
  if (!secret) return null;
  return parseAdminSession((await cookies()).get(ADMIN_COOKIE)?.value, secret)?.actor ?? null;
}

export async function checkAdminRateLimit(request: Request, kind: "auth" | "api") {
  const windowSeconds = kind === "auth" ? ADMIN_AUTH_WINDOW_MS / 1000 : ADMIN_API_WINDOW_MS / 1000;
  const limit = kind === "auth" ? ADMIN_AUTH_LIMIT : ADMIN_API_LIMIT;
  const supplied = kind === "auth" ? clientFingerprint(request) : fingerprint((request.headers.get("cookie") || "admin-session"));
  const client = serverClient();
  if (client) {
    const { data, error } = await client.rpc("consume_admin_rate_limit", { p_key_hash: supplied, p_window_seconds: windowSeconds, p_limit: limit });
    if (!error && Array.isArray(data) && data[0]) return { allowed: data[0].allowed === true, retryAfter: Number(data[0].retry_after) || 0 };
  }
  const now = Date.now();
  const key = `${kind}:${supplied}`;
  const previous = rateBuckets.get(key);
  if (!previous || now - previous.startedAt >= windowSeconds * 1000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }
  if (previous.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowSeconds * 1000 - (now - previous.startedAt)) / 1000)) };
  previous.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function establishAdminSession(token: string, actor: string) {
  const expected = process.env.ADMIN_API_TOKEN;
  const normalizedActor = actor.trim();
  if (!expected || !normalizedActor || normalizedActor.length > 80 || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return false;
  const jar = await cookies();
  const issuedAt = String(Date.now());
  const nonce = randomBytes(24).toString("base64url");
  const encoded = Buffer.from(normalizedActor, "utf8").toString("base64url");
  const payload = `${issuedAt}.${nonce}.${encoded}`;
  jar.set(ADMIN_COOKIE, `${payload}.${actorSignature(payload, expected)}`, cookieOptions(ADMIN_TTL_SECONDS));
  // Clear the legacy actor cookie after upgrading an existing deployment.
  jar.set(ADMIN_ACTOR_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return true;
}

export async function clearAdminSession() { const jar = await cookies(); for (const name of [ADMIN_COOKIE, ADMIN_ACTOR_COOKIE]) jar.set(name, "", { ...cookieOptions(0), maxAge: 0 }); }

// The browser sends a short-lived Supabase access token only in Authorization.
// User ids in request bodies are never trusted.
export async function authenticatedPrincipal(request: Request): Promise<AccountPrincipal | null> {
  const client = serverClient();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!client || !token || token.length > 4096) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || !data.user.email?.toLowerCase().endsWith("@korea.ac.kr")) return null;
  return { userId: data.user.id, email: data.user.email };
}

export { serverClient };
