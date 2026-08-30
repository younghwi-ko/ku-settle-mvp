import { NextResponse } from "next/server";
import { jsonBody, record, text } from "@/app/lib/server-api";
import { checkAdminRateLimit, establishAdminSession } from "@/app/lib/server-session";

export async function POST(request: Request) {
  const limit = await checkAdminRateLimit(request, "auth");
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } });
  const body = await jsonBody(request);
  const token = record(body) ? text(body.token, 512) : null;
  if (!token) return NextResponse.json({ error: "invalid_admin_token" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!await establishAdminSession(token)) return NextResponse.json({ error: "invalid_admin_token" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
