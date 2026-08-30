import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { requireAdmin } from "@/app/lib/admin";
export async function GET(request: Request) { const { client, response } = await requireAdmin(request); if (response || !client) return response ?? apiError("server_storage_not_configured", 503); const result = await client.from("guest_reports").select("*").order("updated_at", { ascending: false }); return result.error ? apiError("admin_reports_load_failed", 502) : NextResponse.json({ reports: result.data ?? [] }); }
