import { NextResponse } from "next/server";
import { apiError, sessionOrError } from "@/app/lib/server-api";
import { serverClient } from "@/app/lib/server-session";

export async function GET(request: Request) {
  const { session, response } = await sessionOrError();
  if (response || !session) return response ?? apiError("session_unavailable", 503);
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const includeDeleted = new URL(request.url).searchParams.get("includeDeleted") === "true";
  let query = client.from("guest_listings").select("*").eq("session_id", session.id).order("updated_at", { ascending: false });
  if (!includeDeleted) query = query.neq("status", "deleted");
  const { data, error } = await query;
  return error ? apiError("my_listings_load_failed", 502) : NextResponse.json({ listings: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
