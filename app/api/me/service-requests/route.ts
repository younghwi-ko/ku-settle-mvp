import { NextResponse } from "next/server";
import { apiError, sessionOrError } from "@/app/lib/server-api";
import { serverClient } from "@/app/lib/server-session";
export async function GET() {
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("guest_service_requests").select("id,reference_code,listing_id,task_id,service_type,status,delivery_method,origin,destination,storage_duration,storage_location,estimated_cost_label,terms_note,version,created_at,updated_at").eq("session_id", session.id).neq("status", "soft_deleted").order("updated_at", { ascending: false });
  return error ? apiError("service_requests_load_failed", 502) : NextResponse.json({ serviceRequests: data ?? [] });
}
