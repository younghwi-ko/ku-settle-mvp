import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { requireAdmin } from "@/app/lib/admin";
import { adminListParams, pagination } from "@/app/lib/admin-list";

export async function GET(request: Request) { const { client, response } = await requireAdmin(request); if (response || !client) return response ?? apiError("server_storage_not_configured", 503); const params = adminListParams(request); let query = client.from("support_tickets").select("*", { count: "exact" }).order("updated_at", { ascending: false }); if (!params.includeDeleted) query = query.neq("status", "deleted"); if (params.status) query = query.eq("status", params.status); if (params.search) query = query.or(`subject.ilike.%${params.search}%,body.ilike.%${params.search}%`); const { data, error, count } = await query.range((params.page - 1) * params.pageSize, params.page * params.pageSize - 1); return error ? apiError("admin_tickets_load_failed", 502) : NextResponse.json({ tickets: data ?? [], pagination: pagination(params, count) }); }
