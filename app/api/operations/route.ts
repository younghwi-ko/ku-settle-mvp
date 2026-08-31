import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { serverClient } from "@/app/lib/server-session";

export async function GET() {
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("admin_operation_rules")
    .select("id,operation_type,title,address,cost_label,rules,duration_days,source_url,checked_at,updated_at")
    .eq("status", "active").order("updated_at", { ascending: false });
  return error ? apiError("operation_rules_load_failed", 502) : NextResponse.json({ rules: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
