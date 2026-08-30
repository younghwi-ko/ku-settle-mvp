import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { requireAdmin } from "@/app/lib/admin";

export async function GET(request: Request) {
  const { client, response } = await requireAdmin(request); if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("guest_reservations").select("*, guest_listings(item_name,seller_name,price_krw,status)").order("updated_at", { ascending: false });
  return error ? apiError("admin_reservations_load_failed", 502) : NextResponse.json({ reservations: data ?? [] });
}
