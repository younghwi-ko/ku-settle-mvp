import { NextResponse } from "next/server";
import { apiError, jsonBody, record, text } from "@/app/lib/server-api";
import { establishAdminSession } from "@/app/lib/server-session";

export async function POST(request: Request) {
  const body = await jsonBody(request);
  const token = record(body) ? text(body.token, 512) : null;
  if (!token) return apiError("invalid_admin_token", 401);
  if (!await establishAdminSession(token)) return apiError("invalid_admin_token", 403);
  return NextResponse.json({ ok: true });
}
