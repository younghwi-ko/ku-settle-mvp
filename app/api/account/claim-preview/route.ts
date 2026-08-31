import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { authenticatedPrincipal, getOrCreateServerSession, serverClient } from "@/app/lib/server-session";

export async function GET(request: Request) {
  const principal = await authenticatedPrincipal(request); if (!principal) return apiError("account_required", 401);
  const session = await getOrCreateServerSession(); const client = serverClient(); if (!session || !client) return apiError("session_unavailable", 503);
  const { data: owner } = await client.from("anonymous_sessions").select("account_user_id").eq("id", session.id).maybeSingle();
  if (owner?.account_user_id && owner.account_user_id !== principal.userId) return apiError("anonymous_data_claimed", 409);
  const [listings, reservations, services, progress] = await Promise.all([
    client.from("guest_listings").select("id", { count: "exact", head: true }).eq("session_id", session.id), client.from("guest_reservations").select("id", { count: "exact", head: true }).eq("buyer_session_id", session.id), client.from("guest_service_requests").select("id", { count: "exact", head: true }).eq("session_id", session.id), client.from("guest_lifecycle_progress").select("task_id", { count: "exact", head: true }).eq("session_id", session.id).eq("completed", true)
  ]);
  return NextResponse.json({ claimed: Boolean(owner?.account_user_id), counts: { listings: listings.count ?? 0, reservations: reservations.count ?? 0, serviceRequests: services.count ?? 0, lifecycle: progress.count ?? 0 } }, { headers: { "Cache-Control": "no-store" } });
}
