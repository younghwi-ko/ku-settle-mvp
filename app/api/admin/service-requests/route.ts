import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { requireAdmin } from "@/app/lib/admin";

export async function GET(request: Request) { const { client, response } = await requireAdmin(request); if (response || !client) return response ?? apiError("server_storage_not_configured", 503); const type = new URL(request.url).searchParams.get("type"); const query = client.from("guest_service_requests").select("*").order("updated_at", { ascending: false }); const result = type && ["pickup", "delivery", "storage", "sale", "donation", "disposal"].includes(type) ? await query.eq("service_type", type) : await query; return result.error ? apiError("admin_services_load_failed", 502) : NextResponse.json({ serviceRequests: result.data ?? [] }); }
