import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { accountListingReportPrefix } from "@/app/lib/domain";
import { apiError, jsonBody, record, sessionOrError, text, uuid } from "@/app/lib/server-api";
import { authenticatedPrincipal, requireSameOrigin, serverClient } from "@/app/lib/server-session";

export async function POST(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const body = await jsonBody(request);
  if (!record(body)) return apiError("invalid_report", 422);

  const reason = text(body.reason, 80);
  const detail = typeof body.detail === "string" && body.detail.length <= 2000 ? body.detail.trim() : null;
  const listingId = body.listingId ?? null;
  const accountListingId = body.accountListingId ?? null;
  let placeKey = text(body.placeKey, 120);
  if (!reason || detail === null || (listingId === null && accountListingId === null && placeKey === null)
    || (listingId !== null && !uuid(listingId))
    || (body.placeKey != null && (!placeKey || placeKey.startsWith(accountListingReportPrefix)))
    || (accountListingId !== null && (!uuid(accountListingId) || listingId !== null || placeKey !== null))) {
    return apiError("invalid_report", 422);
  }

  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  if (accountListingId !== null) {
    const authorization = request.headers.get("authorization");
    if (!authorization || !await authenticatedPrincipal(request)) return apiError("account_required", 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return apiError("account_storage_not_configured", 503);
    const account = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await account.from("marketplace_items").select("id").eq("id", accountListingId).in("status", ["active", "sold"]).maybeSingle();
    if (error) return apiError("report_target_lookup_failed", 502);
    if (!data) return apiError("report_target_not_found", 404);
    // The listing FK points only to guest listings. Keep account targets in the existing text reference.
    placeKey = accountListingReportPrefix + accountListingId;
  }

  const { session, response } = await sessionOrError();
  if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { data, error } = await client.from("guest_reports")
    .insert({ session_id: session.id, listing_id: listingId, place_key: placeKey, reason, detail })
    .select("id,listing_id,place_key,reason,detail,status,created_at").single();
  if (error?.code === "23503" && listingId !== null) return apiError("report_target_not_found", 404);
  return error || !data ? apiError("report_create_failed", 502) : NextResponse.json({ report: data }, { status: 201 });
}
