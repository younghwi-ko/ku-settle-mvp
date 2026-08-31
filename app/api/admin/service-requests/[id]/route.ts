import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { adminBody, audit, requireAdmin, versionOf } from "@/app/lib/admin";
import { uuid } from "@/app/lib/server-api";
import { manualFulfillmentProvider } from "@/app/lib/fulfillment-provider";

const transitions: Record<string, string[]> = { "not-selected": ["method-selected", "cancelled"], "method-selected": ["consultation-ready", "cancelled"], "consultation-ready": ["quote-viewed", "application-ready", "cancelled"], "quote-viewed": ["application-ready", "cancelled"], "application-ready": ["in-progress", "cancelled"], "in-progress": ["completed", "cancelled"], completed: [], cancelled: [] };
const statuses = new Set([...Object.keys(transitions), "soft_deleted"]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { client, response } = await requireAdmin(request, true); if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_service_request_id", 422);
  const body = await adminBody(request); if (!body) return apiError("invalid_service_request", 422);
  const { data: current } = await client.from("guest_service_requests").select("*").eq("id", id).maybeSingle(); if (!current) return apiError("service_request_not_found", 404);
  const status = body.status === undefined ? current.status : String(body.status);
  if (!statuses.has(status)) return apiError("invalid_service_status", 422);
  const version = versionOf(body.version); if (version !== null && version !== current.version) return apiError("version_conflict", 409);
  if (status !== current.status && status !== "soft_deleted" && !(current.status === "soft_deleted" && status === "cancelled") && !(transitions[current.status] ?? []).includes(status)) return apiError("invalid_service_transition", 409);
  if (["completed", "cancelled"].includes(current.status) && status !== "soft_deleted") return apiError("service_request_terminal", 409);
  const adminNote = body.adminNote === undefined ? current.admin_note : typeof body.adminNote === "string" && body.adminNote.trim().length <= 2000 ? body.adminNote.trim() || null : undefined;
  const estimatedCostLabel = body.estimatedCostLabel === undefined ? current.estimated_cost_label : typeof body.estimatedCostLabel === "string" && body.estimatedCostLabel.trim().length <= 120 ? body.estimatedCostLabel.trim() || null : undefined;
  if (adminNote === undefined || estimatedCostLabel === undefined) return apiError("invalid_service_request", 422);
  const now = new Date().toISOString();
  const updates = { status, estimated_cost_label: estimatedCostLabel, admin_note: adminNote, admin_updated_at: now, admin_updated_by: "admin", version: current.version + 1, updated_at: now, deleted_at: status === "soft_deleted" ? now : null, deleted_by: status === "soft_deleted" ? "admin" : null, deletion_reason: status === "soft_deleted" ? (typeof body.deletionReason === "string" ? body.deletionReason.slice(0, 500) : "admin cleanup") : null };
  const { data, error } = await client.from("guest_service_requests").update(updates).eq("id", id).eq("version", current.version).select("*").single(); if (error || !data) return apiError("version_conflict", 409);
  await audit(client, "service_request", id, status === "soft_deleted" ? "soft_delete" : status === "cancelled" ? "cancel" : current.status === "soft_deleted" ? "restore" : "status_change");
  if (data.service_type === "delivery" || data.service_type === "storage") await manualFulfillmentProvider.notifyStatusChange({ requestId: id, serviceType: data.service_type, status, processedAt: now });
  return NextResponse.json({ serviceRequest: data });
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { const body = new Request(request, { method: "PATCH", headers: { "content-type": "application/json", origin: request.headers.get("origin") ?? "" }, body: JSON.stringify({ status: "soft_deleted", deletionReason: "admin cleanup" }) }); return PATCH(body, context); }
