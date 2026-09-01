import { NextResponse } from "next/server";
import { adminBody, adminText, audit, requireAdmin } from "@/app/lib/admin";
import { apiError } from "@/app/lib/server-api";
import { adminListParams, pagination } from "@/app/lib/admin-list";

const statuses = new Set(["draft", "active", "inactive", "deleted"]);
function durations(value: unknown) {
  if (!Array.isArray(value) || value.length > 12) return null;
  const parsed = value.map((item) => typeof item === "number" ? item : Number(item));
  return parsed.every((item) => Number.isInteger(item) && item >= 1 && item <= 365) ? [...new Set(parsed)].sort((a, b) => a - b) : null;
}
function source(value: unknown) { if (value === undefined || value === null || value === "") return null; try { const url = new URL(String(value)); return ["https:", "http:"].includes(url.protocol) ? url.toString() : null; } catch { return null; } }
function checked(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }

export async function GET(request: Request) {
  const { client, response } = await requireAdmin(request);
  if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const params = adminListParams(request);
  let query = client.from("admin_operation_rules").select("*", { count: "exact" }).order("updated_at", { ascending: false });
  if (!params.includeDeleted) query = query.neq("status", "deleted");
  if (params.status) query = query.eq("status", params.status);
  if (params.search) query = query.or(`title.ilike.%${params.search}%,address.ilike.%${params.search}%,rules.ilike.%${params.search}%`);
  const { data, error, count } = await query.range((params.page - 1) * params.pageSize, params.page * params.pageSize - 1);
  return error ? apiError("operation_rules_load_failed", 502) : NextResponse.json({ operationRules: data ?? [], pagination: pagination(params, count) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { client, response } = await requireAdmin(request, true);
  if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const body = await adminBody(request); if (!body) return apiError("invalid_operation_rule", 422);
  const operationType = body.operationType === "delivery" || body.operationType === "storage" ? body.operationType : null;
  const title = adminText(body.title, 120, true), address = adminText(body.address, 500, true), costLabel = adminText(body.costLabel, 160, true), rules = adminText(body.rules, 3000, true), durationDays = durations(body.durationDays ?? []), checkedAt = checked(body.checkedAt), sourceUrl = source(body.sourceUrl);
  const status = statuses.has(String(body.status)) ? String(body.status) : "draft";
  if (!operationType || !title || !address || !costLabel || !rules || !durationDays || !checkedAt || (body.sourceUrl && !sourceUrl)) return apiError("invalid_operation_rule", 422);
  if (operationType === "storage" && durationDays.length === 0) return apiError("storage_duration_required", 422);
  const { data, error } = await client.from("admin_operation_rules").insert({ operation_type: operationType, title, address, cost_label: costLabel, rules, duration_days: durationDays, source_url: sourceUrl, checked_at: checkedAt, status }).select("*").single();
  if (error || !data) return apiError("operation_rule_create_failed", 502);
  await audit(client, "operation_rule", data.id, "create");
  return NextResponse.json({ operationRule: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
