import { NextResponse } from "next/server";
import { adminBody, adminText, audit, requireAdmin, versionOf } from "@/app/lib/admin";
import { apiError } from "@/app/lib/server-api";

const statuses = new Set(["draft", "active", "inactive", "deleted"]);
function validId(value: string) { return /^[0-9a-f-]{36}$/i.test(value); }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { client, response } = await requireAdmin(request, true); if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const { id } = await context.params; if (!validId(id)) return apiError("invalid_operation_rule_id", 422);
  const body = await adminBody(request); if (!body) return apiError("invalid_operation_rule", 422);
  const { data: current } = await client.from("admin_operation_rules").select("*").eq("id", id).maybeSingle(); if (!current) return apiError("operation_rule_not_found", 404);
  const version = versionOf(body.version); if (version !== null && version !== current.version) return apiError("version_conflict", 409);
  const now = new Date().toISOString(); const updates: Record<string, unknown> = { version: current.version + 1, updated_at: now };
  if (body.status !== undefined) { const status = String(body.status); if (!statuses.has(status)) return apiError("invalid_operation_rule_status", 422); updates.status = status; }
  for (const [input, column, max] of [["title", "title", 120], ["address", "address", 500], ["costLabel", "cost_label", 160], ["rules", "rules", 3000]] as const) if (body[input] !== undefined) { const value = adminText(body[input], max, true); if (!value) return apiError("invalid_operation_rule", 422); updates[column] = value; }
  if (body.checkedAt !== undefined && !(typeof body.checkedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.checkedAt))) return apiError("invalid_checked_at", 422); else if (body.checkedAt !== undefined) updates.checked_at = body.checkedAt;
  if (body.deletionReason !== undefined) updates.deletion_reason = adminText(body.deletionReason, 500);
  const status = String(updates.status ?? current.status); if (status === "deleted") { updates.deleted_at = now; updates.deleted_by = "admin"; } else if (current.status === "deleted" && status !== "deleted") { updates.deleted_at = null; updates.deleted_by = null; updates.deletion_reason = null; }
  const { data, error } = await client.from("admin_operation_rules").update(updates).eq("id", id).eq("version", current.version).select("*").single();
  if (error || !data) return apiError("version_conflict", 409);
  await audit(client, "operation_rule", id, status === "deleted" ? "soft_delete" : current.status === "deleted" ? "restore" : "update", typeof updates.deletion_reason === "string" ? updates.deletion_reason : null);
  return NextResponse.json({ operationRule: data }, { headers: { "Cache-Control": "no-store" } });
}
