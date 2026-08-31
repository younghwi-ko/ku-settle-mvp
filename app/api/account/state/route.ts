import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { authenticatedPrincipal, serverClient } from "@/app/lib/server-session";

// Cross-device account view of anonymous data claimed by this account. Internal
// operations notes remain excluded exactly as in /api/session/state.
export async function GET(request: Request) {
  const principal = await authenticatedPrincipal(request); if (!principal) return apiError("account_required", 401);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const { data: sessions, error: sessionsError } = await client.from("anonymous_sessions").select("id,claimed_at").eq("account_user_id", principal.userId).order("claimed_at", { ascending: false });
  if (sessionsError) return apiError("account_state_load_failed", 502);
  const ids = (sessions ?? []).map((row) => row.id as string); if (!ids.length) return NextResponse.json({ sessions: [], listings: [], reservations: [], serviceRequests: [], lifecycle: [] }, { headers: { "Cache-Control": "no-store" } });
  const [listings, reservations, services, lifecycle] = await Promise.all([
    client.from("guest_listings").select("*").in("session_id", ids).neq("status", "deleted").order("updated_at", { ascending: false }),
    client.from("guest_reservations").select("*").in("buyer_session_id", ids).neq("status", "soft_deleted").order("updated_at", { ascending: false }),
    client.from("guest_service_requests").select("id,reference_code,listing_id,task_id,service_type,status,delivery_method,origin,destination,storage_duration,storage_location,estimated_cost_label,terms_note,version,created_at,updated_at").in("session_id", ids).neq("status", "soft_deleted").order("updated_at", { ascending: false }),
    client.from("guest_lifecycle_progress").select("session_id,task_id,completed,updated_at").in("session_id", ids).eq("completed", true),
  ]);
  if ([listings, reservations, services, lifecycle].some((result) => result.error)) return apiError("account_state_load_failed", 502);
  return NextResponse.json({ sessions: sessions ?? [], listings: listings.data ?? [], reservations: reservations.data ?? [], serviceRequests: services.data ?? [], lifecycle: lifecycle.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
