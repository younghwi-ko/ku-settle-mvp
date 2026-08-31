import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { authenticatedPrincipal, getOrCreateServerSession, requireSameOrigin, serverClient } from "@/app/lib/server-session";

export async function POST(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const principal = await authenticatedPrincipal(request); if (!principal) return apiError("account_required", 401);
  const session = await getOrCreateServerSession(); const client = serverClient(); if (!session || !client) return apiError("session_unavailable", 503);
  const { data, error } = await client.rpc("claim_anonymous_session", { p_session_id: session.id, p_user_id: principal.userId });
  if (error) return apiError("anonymous_data_claim_failed", 502); if (data !== true) return apiError("anonymous_data_claimed", 409);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
