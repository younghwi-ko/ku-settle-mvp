import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SESSION_COOKIE = "ku_settle_session";
const ADMIN_COOKIE = "ku_settle_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
const ADMIN_TTL_SECONDS = 60 * 60 * 8;
const ADMIN_AUTH_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_API_WINDOW_MS = 60 * 1000;
const ADMIN_AUTH_LIMIT = 10;
const ADMIN_API_LIMIT = 60;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();

export type ServerSession = { id: string; tokenHash: string };

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
  const origin = (await headers()).get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function isAdminRequest() {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;
  const jar = await cookies();
  const supplied = jar.get(ADMIN_COOKIE)?.value;
  if (!supplied || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function checkAdminRateLimit(request: Request, kind: "auth" | "api") {
  const now = Date.now();
  const windowMs = kind === "auth" ? ADMIN_AUTH_WINDOW_MS : ADMIN_API_WINDOW_MS;
  const limit = kind === "auth" ? ADMIN_AUTH_LIMIT : ADMIN_API_LIMIT;
  const supplied = kind === "auth" ? clientFingerprint(request) : fingerprint((request.headers.get("cookie") || "admin-session"));
  const key = `${kind}:${supplied}`;
  const previous = rateBuckets.get(key);
  if (!previous || now - previous.startedAt >= windowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }
  if (previous.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - previous.startedAt)) / 1000)) };
  previous.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function establishAdminSession(token: string) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return false;
  (await cookies()).set(ADMIN_COOKIE, token, cookieOptions(ADMIN_TTL_SECONDS));
  return true;
}

export { serverClient };
