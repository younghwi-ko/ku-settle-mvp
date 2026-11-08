import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, text, uuid } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";
import { expireReservations } from "@/app/lib/reservation-expiry";
import { notifySession } from "@/app/lib/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function validTime(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function matchesRequest(row: Record<string, unknown>, id: string, body: Record<string, unknown>) {
  return row.listing_id === id && row.pickup_date === body.pickupDate && String(row.pickup_start_time).slice(0, 5) === body.pickupStartTime && String(row.pickup_end_time).slice(0, 5) === body.pickupEndTime;
}
async function confirmedResponse(client: SupabaseClient, reservation: Record<string, unknown>, status = 200) {
  if (reservation.status === "active") {
    const { data: listing, error } = await client.from("guest_listings").select("status").eq("id", reservation.listing_id).maybeSingle();
    if (error || !listing || !["active", "reserved"].includes(listing.status)) return apiError("reservation_confirmation_pending", 502);
    if (listing.status === "active") {
      const updated = await client.from("guest_listings").update({ status: "reserved", availability: "reserved" }).eq("id", reservation.listing_id).eq("status", "active").select("id").maybeSingle();
      if (updated.error || !updated.data) return apiError("reservation_confirmation_pending", 502);
    }
  }
  return NextResponse.json({ reservation }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_listing_id", 422);
  const params = new URL(request.url).searchParams;
  const requestKey = params.get("requestKey"); const reservationId = params.get("reservationId");
  if ((!requestKey && !reservationId) || (requestKey && requestKey.length > 120) || (reservationId && !uuid(reservationId))) return apiError("invalid_reservation_lookup", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  await expireReservations(client);
  let query = client.from("guest_reservations").select("*").eq("listing_id", id).eq("buyer_session_id", session.id);
  query = reservationId ? query.eq("id", reservationId) : query.eq("idempotency_key", requestKey!);
  const { data, error } = await query.maybeSingle();
  if (error) return apiError("reservation_load_failed", 502);
  if (data?.status === "active") {
    const listing = await client.from("guest_listings").select("status").eq("id", id).maybeSingle();
    if (listing.error || listing.data?.status !== "reserved") return apiError("reservation_confirmation_pending", 502);
  }
  return NextResponse.json({ reservation: data }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_listing_id", 422);
  const body = await jsonBody(request); if (!record(body)) return apiError("invalid_reservation", 422);
  const buyerName = text(body.buyerName, 80); if (!buyerName || !validDate(body.pickupDate) || !validTime(body.pickupStartTime) || !validTime(body.pickupEndTime) || String(body.pickupEndTime) <= String(body.pickupStartTime)) return apiError("invalid_pickup_schedule", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  await expireReservations(client);
  const idempotencyKey = request.headers.get("x-idempotency-key")?.slice(0, 120) || null;
  const replay = async () => {
    if (!idempotencyKey) return null;
    const { data: existing, error } = await client.from("guest_reservations").select("*").eq("buyer_session_id", session.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error) return apiError("reservation_load_failed", 502);
    if (existing) {
      if (!matchesRequest(existing, id, body)) return apiError("idempotency_conflict", 409);
      return confirmedResponse(client, existing);
    }
    return null;
  };
  const previous = await replay(); if (previous) return previous;
  const { data: listing, error: listingError } = await client.from("guest_listings").select("id,session_id,status").eq("id", id).maybeSingle();
  if (listingError) return apiError("listing_load_failed", 502);
  // Another copy of this request may have committed between our two reads.
  if (!listing || listing.status !== "active") return await replay() ?? apiError("listing_unavailable", 409);
  if (listing.session_id === session.id) return apiError("cannot_reserve_own_listing", 409);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client.from("guest_reservations").insert({ listing_id: id, buyer_session_id: session.id, buyer_name: buyerName, status: "active", pickup_date: body.pickupDate, pickup_start_time: body.pickupStartTime, pickup_end_time: body.pickupEndTime, expires_at: expiresAt, idempotency_key: idempotencyKey, version: 1 }).select("*").single();
  if (error) {
    if (error.code === "23505" && idempotencyKey) {
      const repeated = await replay(); if (repeated) return repeated;
    }
    return apiError(error.code === "23505" ? "listing_already_reserved" : "reservation_create_failed", error.code === "23505" ? 409 : 502);
  }
  const confirmed = await confirmedResponse(client, data, 201);
  if (confirmed.status !== 201) return confirmed;
  await notifySession(client, session.id, "reservation_created", "상품 예약이 접수되었습니다", "24시간 안에 픽업 일정을 확인하세요.", "reservation", data.id);
  return confirmed;
}
