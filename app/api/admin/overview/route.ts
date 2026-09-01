import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/admin";
import { apiError } from "@/app/lib/server-api";
import { lifeGuideArticles, places as staticPlaces } from "@/app/data";
import { isTicketOverdue } from "@/app/lib/business-days";

export async function GET(request: Request) {
  const { client, response } = await requireAdmin(request);
  if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const [listings, reservations, delivery, storage, places, guides, reports, tickets, operationRules, auditLog] = await Promise.all([
    client.from("guest_listings").select("id", { count: "exact", head: true }).neq("status", "deleted"),
    client.from("guest_reservations").select("id", { count: "exact", head: true }).neq("status", "soft_deleted"),
    client.from("guest_service_requests").select("id", { count: "exact", head: true }).eq("service_type", "delivery").neq("status", "soft_deleted"),
    client.from("guest_service_requests").select("id", { count: "exact", head: true }).eq("service_type", "storage").neq("status", "soft_deleted"),
    client.from("admin_place_overrides").select("id", { count: "exact", head: true }),
    client.from("admin_guide_overrides").select("id", { count: "exact", head: true }),
    client.from("guest_reports").select("id", { count: "exact", head: true }).neq("status", "deleted"),
    client.from("support_tickets").select("status,first_response_due_at,first_response_at").neq("status", "deleted"),
    client.from("admin_operation_rules").select("id", { count: "exact", head: true }).neq("status", "deleted"),
    client.from("admin_audit_log").select("id,actor,resource_type,resource_key,action,reason,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const results = [listings, reservations, delivery, storage, places, guides, reports, tickets, operationRules, auditLog];
  if (results.some((result) => result.error)) return apiError("admin_load_failed", 502);
  const ticketRows = tickets.data ?? [];
  return NextResponse.json({ auditLog: auditLog.data ?? [], catalogCounts: { places: staticPlaces.length, guides: lifeGuideArticles.length }, counts: { listings: listings.count ?? 0, reservations: reservations.count ?? 0, delivery: delivery.count ?? 0, storage: storage.count ?? 0, reports: reports.count ?? 0, tickets: ticketRows.length, overdueTickets: ticketRows.filter((ticket) => isTicketOverdue(ticket)).length, operationRules: operationRules.count ?? 0, placeOverrides: places.count ?? 0, guideOverrides: guides.count ?? 0 } }, { headers: { "Cache-Control": "no-store" } });
}
