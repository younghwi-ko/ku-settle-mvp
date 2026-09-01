import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/admin";
import { adminListParams, pagination } from "@/app/lib/admin-list";
import { apiError } from "@/app/lib/server-api";

export async function GET(request: Request) {
  const { client, response } = await requireAdmin(request);
  if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const params = adminListParams(request);
  const url = new URL(request.url);
  const resource = (url.searchParams.get("resource") ?? "").trim().slice(0, 80).replace(/[%_(),]/g, "");
  const action = (url.searchParams.get("action") ?? "").trim().slice(0, 80).replace(/[%_(),]/g, "");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  let query = client.from("admin_audit_log").select("id,actor,resource_type,resource_key,action,reason,created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (params.search) query = query.or(`actor.ilike.%${params.search}%,resource_key.ilike.%${params.search}%,reason.ilike.%${params.search}%`);
  if (resource) query = query.eq("resource_type", resource);
  if (action) query = query.eq("action", action);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte("created_at", `${to}T23:59:59.999Z`);
  const { data, error, count } = await query.range((params.page - 1) * params.pageSize, params.page * params.pageSize - 1);
  return error ? apiError("admin_audit_load_failed", 502) : NextResponse.json({ auditLog: data ?? [], pagination: pagination(params, count) });
}
