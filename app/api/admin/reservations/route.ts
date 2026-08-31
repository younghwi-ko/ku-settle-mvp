import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { requireAdmin } from "@/app/lib/admin";
import { adminListParams, pagination } from "@/app/lib/admin-list";

export async function GET(request: Request) {
  const { client, response } = await requireAdmin(request); if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const params = adminListParams(request);
  let query = client.from("guest_reservations").select("*, guest_listings(item_name,seller_name,price_krw,status)", { count: "exact" }).order("updated_at", { ascending: false });
  if (!params.includeDeleted) query = query.neq("status", "soft_deleted");
  if (params.status) query = query.eq("status", params.status);
  if (params.search) query = query.ilike("buyer_name", `%${params.search}%`);
  const { data, error, count } = await query.range((params.page - 1) * params.pageSize, params.page * params.pageSize - 1);
  return error ? apiError("admin_reservations_load_failed", 502) : NextResponse.json({ reservations: data ?? [], pagination: pagination(params, count) });
}
