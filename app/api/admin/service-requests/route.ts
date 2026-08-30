import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { requireAdmin } from "@/app/lib/admin";

export async function GET(request: Request) { const { client, response } = await requireAdmin(request); if (response || !client) return response ?? apiError("server_storage_not_configured", 503); const url = new URL(request.url); const type = url.searchParams.get("type"); const includeDeleted = url.searchParams.get("includeDeleted") === "true"; let query = client.from("guest_service_requests").select("*").order("updated_at", { ascending: false }); if (type && ["pickup", "delivery", "storage", "sale", "donation", "disposal"].includes(type)) query = query.eq("service_type", type); if (!includeDeleted) query = query.neq("status", "soft_deleted"); const result = await query; return result.error ? apiError("admin_services_load_failed", 502) : NextResponse.json({ serviceRequests: result.data ?? [] }); }
