import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { adminBody, audit, requireAdmin, versionOf } from "@/app/lib/admin";
import { uuid } from "@/app/lib/server-api";

const statuses = new Set(["active", "cancelled", "completed"]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { client, response } = await requireAdmin(request, true); if (response || !client) return response ?? apiError("server_storage_not_configured", 503); const { id } = await context.params; if (!uuid(id)) return apiError("invalid_reservation_id", 422); const body = await adminBody(request); if (!body || !statuses.has(String(body.status))) return apiError("invalid_reservation_status", 422);
  const { data: current } = await client.from("guest_reservations").select("*").eq("id", id).maybeSingle(); if (!current) return apiError("reservation_not_found", 404); const version = versionOf(body.version); if (version !== null && version !== current.version) return apiError("version_conflict", 409); if (current.status !== "active" && body.status !== current.status) return apiError("reservation_already_closed", 409);
  const status = String(body.status); const now = new Date().toISOString(); const updates = { status, version: current.version + 1, updated_at: now, cancelled_at: status === "cancelled" ? now : null, completed_at: status === "completed" ? now : null };
  const { data, error } = await client.from("guest_reservations").update(updates).eq("id", id).eq("version", current.version).select("*").single(); if (error || !data) return apiError("version_conflict", 409);
  if (status === "cancelled") await client.from("guest_listings").update({ status: "active", availability: "available" }).eq("id", current.listing_id).eq("status", "reserved"); if (status === "completed") await client.from("guest_listings").update({ status: "sold", availability: "available" }).eq("id", current.listing_id).eq("status", "reserved"); await audit(client, "reservation", id, status === "cancelled" ? "cancel" : status === "completed" ? "complete" : "update"); return NextResponse.json({ reservation: data });
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { const body = new Request(request, { method: "PATCH", headers: { "content-type": "application/json", origin: request.headers.get("origin") ?? "" }, body: JSON.stringify({ status: "cancelled" }) }); return PATCH(body, context); }
