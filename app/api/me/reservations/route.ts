import { NextResponse } from "next/server";
import { apiError, sessionOrError } from "@/app/lib/server-api";
import { serverClient } from "@/app/lib/server-session";
export async function GET() {
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("guest_reservations").select("*, guest_listings(item_name,seller_name,price_krw,pickup_location,status)").eq("buyer_session_id", session.id).order("updated_at", { ascending: false });
  return error ? apiError("reservations_load_failed", 502) : NextResponse.json({ reservations: data ?? [] });
}
