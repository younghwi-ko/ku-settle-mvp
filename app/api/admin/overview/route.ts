import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/admin";
import { apiError } from "@/app/lib/server-api";
import { lifeGuideArticles, places as staticPlaces } from "@/app/data";

export async function GET() {
  const { client, response } = await requireAdmin(new Request("https://localhost/api/admin/overview"));
  if (response) return response;
  if (!client) return apiError("server_storage_not_configured", 503);
  const [listings, reservations, services, places, guides, reports, auditLog] = await Promise.all([
    client.from("guest_listings").select("id,status,created_at,updated_at,seller_name,item_name,price_krw,session_id").order("updated_at", { ascending: false }),
    client.from("guest_reservations").select("*, guest_listings(item_name,seller_name)").order("updated_at", { ascending: false }),
    client.from("guest_service_requests").select("*").order("updated_at", { ascending: false }),
    client.from("admin_place_overrides").select("*").order("updated_at", { ascending: false }),
    client.from("admin_guide_overrides").select("*").order("updated_at", { ascending: false }),
    client.from("guest_reports").select("*").order("updated_at", { ascending: false }),
    client.from("admin_audit_log").select("id,actor,resource_type,resource_key,action,reason,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  if (listings.error || reservations.error || services.error || places.error || guides.error || reports.error || auditLog.error) return apiError("admin_load_failed", 502);
  const visibleListings = (listings.data ?? []).filter((row) => row.status !== "deleted" && row.status !== "soft_deleted");
  const visibleReservations = (reservations.data ?? []).filter((row) => row.status !== "soft_deleted");
  const visibleServices = (services.data ?? []).filter((row) => row.status !== "soft_deleted");
  return NextResponse.json({ listings: listings.data ?? [], reservations: reservations.data ?? [], serviceRequests: services.data ?? [], placeOverrides: places.data ?? [], guideOverrides: guides.data ?? [], reports: reports.data ?? [], auditLog: auditLog.data ?? [], catalogCounts: { places: staticPlaces.length, guides: lifeGuideArticles.length }, counts: { listings: visibleListings.length, reservations: visibleReservations.length, serviceRequests: visibleServices.length, reports: reports.data?.length ?? 0, placeOverrides: places.data?.length ?? 0, guideOverrides: guides.data?.length ?? 0 } });
}
