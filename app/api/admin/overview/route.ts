import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { isAdminRequest, serverClient } from "@/app/lib/server-session";

export async function GET() {
  if (!await isAdminRequest()) return apiError("admin_required", 401);
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const [listings, reservations, services] = await Promise.all([
    client.from("guest_listings").select("id,status,created_at,updated_at,seller_name,item_name,price_krw,session_id").neq("status", "deleted").order("updated_at", { ascending: false }),
    client.from("guest_reservations").select("*, guest_listings(item_name,seller_name)").order("updated_at", { ascending: false }),
    client.from("guest_service_requests").select("*").order("updated_at", { ascending: false }),
  ]);
  if (listings.error || reservations.error || services.error) return apiError("admin_load_failed", 502);
  return NextResponse.json({ listings: listings.data ?? [], reservations: reservations.data ?? [], serviceRequests: services.data ?? [], counts: { listings: listings.data?.length ?? 0, reservations: reservations.data?.length ?? 0, serviceRequests: services.data?.length ?? 0 } });
}
