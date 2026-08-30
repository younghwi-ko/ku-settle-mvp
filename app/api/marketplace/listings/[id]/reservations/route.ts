import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, text, uuid } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";

function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function validTime(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_listing_id", 422);
  const body = await jsonBody(request); if (!record(body)) return apiError("invalid_reservation", 422);
  const buyerName = text(body.buyerName, 80); if (!buyerName || !validDate(body.pickupDate) || !validTime(body.pickupStartTime) || !validTime(body.pickupEndTime) || String(body.pickupEndTime) < String(body.pickupStartTime)) return apiError("invalid_pickup_schedule", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const idempotencyKey = request.headers.get("x-idempotency-key")?.slice(0, 120) || null;
  if (idempotencyKey) {
    const { data: existing } = await client.from("guest_reservations").select("*").eq("buyer_session_id", session.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return NextResponse.json({ reservation: existing });
  }
  const { data: listing, error: listingError } = await client.from("guest_listings").select("id,session_id,status").eq("id", id).maybeSingle();
  if (listingError) return apiError("listing_load_failed", 502);
  if (!listing || listing.status !== "active") return apiError("listing_unavailable", 409);
  if (listing.session_id === session.id) return apiError("cannot_reserve_own_listing", 409);
  const { data, error } = await client.from("guest_reservations").insert({ listing_id: id, buyer_session_id: session.id, buyer_name: buyerName, status: "active", pickup_date: body.pickupDate, pickup_start_time: body.pickupStartTime, pickup_end_time: body.pickupEndTime, idempotency_key: idempotencyKey, version: 1 }).select("*").single();
  if (error) return apiError(error.code === "23505" ? "listing_already_reserved" : "reservation_create_failed", error.code === "23505" ? 409 : 502);
  const { error: updateError } = await client.from("guest_listings").update({ status: "reserved", availability: "reserved" }).eq("id", id).eq("status", "active");
  if (updateError) { await client.from("guest_reservations").delete().eq("id", data.id); return apiError("reservation_create_failed", 502); }
  return NextResponse.json({ reservation: data }, { status: 201 });
}
