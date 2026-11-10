import { reservationRpcError } from "@/app/lib/reservation-rpc";
import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { adminBody, audit, requireAdmin, versionOf } from "@/app/lib/admin";
import { uuid } from "@/app/lib/server-api";

const statuses = new Set(["active", "cancelled", "completed", "expired", "soft_deleted"]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { client, response } = await requireAdmin(request, true); if (response || !client) return response ?? apiError("server_storage_not_configured", 503); const { id } = await context.params; if (!uuid(id)) return apiError("invalid_reservation_id", 422); const body = await adminBody(request); if (!body || !statuses.has(String(body.status))) return apiError("invalid_reservation_status", 422);
  const { data: current } = await client.from("guest_reservations").select("*").eq("id", id).maybeSingle(); if (!current) return apiError("reservation_not_found", 404); const version = versionOf(body.version); if (version !== null && version !== current.version) return apiError("version_conflict", 409);
  const status = String(body.status);
  const { data, error } = await client.rpc("transition_guest_reservation", {
    p_id: id, p_session_id: null, p_status: status, p_version: current.version, p_mode: "admin",
    p_reason: typeof body.deletionReason === "string" ? body.deletionReason.slice(0, 500) : null,
  });
  if (error) return reservationRpcError(error, "reservation_update_failed");
  if (!data?.reservation) return apiError("reservation_update_failed", 502);
  if (data.changed) await audit(client, "reservation", id, status === "soft_deleted" ? "soft_delete" : status === "cancelled" ? "cancel" : status === "completed" ? "complete" : "update", typeof body.deletionReason === "string" ? body.deletionReason.slice(0, 500) : null);
  return NextResponse.json({ reservation: data.reservation });
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { const body = new Request(request, { method: "PATCH", headers: { "content-type": "application/json", origin: request.headers.get("origin") ?? "" }, body: JSON.stringify({ status: "soft_deleted", deletionReason: "admin cleanup" }) }); return PATCH(body, context); }
