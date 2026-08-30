import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/admin";
import { apiError } from "@/app/lib/server-api";

export async function GET() {
  const { client, response } = await requireAdmin(new Request("https://localhost/api/admin/overview"));
  if (response) return response;
  if (!client) return apiError("server_storage_not_configured", 503);
  const [listings, reservations, services, places, guides, reports] = await Promise.all([
    client.from("guest_listings").select("id,status,created_at,updated_at,seller_name,item_name,price_krw,session_id").neq("status", "deleted").order("updated_at", { ascending: false }),
    client.from("guest_reservations").select("*, guest_listings(item_name,seller_name)").order("updated_at", { ascending: false }),
    client.from("guest_service_requests").select("*").order("updated_at", { ascending: false }),
    client.from("admin_place_overrides").select("*").order("updated_at", { ascending: false }),
    client.from("admin_guide_overrides").select("*").order("updated_at", { ascending: false }),
    client.from("guest_reports").select("*").order("updated_at", { ascending: false }),
  ]);
  if (listings.error || reservations.error || services.error || places.error || guides.error || reports.error) return apiError("admin_load_failed", 502);
  return NextResponse.json({ listings: listings.data ?? [], reservations: reservations.data ?? [], serviceRequests: services.data ?? [], placeOverrides: places.data ?? [], guideOverrides: guides.data ?? [], reports: reports.data ?? [], counts: { listings: listings.data?.length ?? 0, reservations: reservations.data?.length ?? 0, serviceRequests: services.data?.length ?? 0, reports: reports.data?.length ?? 0 } });
}
