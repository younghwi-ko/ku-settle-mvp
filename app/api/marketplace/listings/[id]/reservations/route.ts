import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, text, uuid } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";
import { expireReservations } from "@/app/lib/reservation-expiry";
import { notifySession } from "@/app/lib/notifications";
import { reservationRpcError } from "@/app/lib/reservation-rpc";

function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function validTime(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
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
  const { data, error } = await client.rpc("create_guest_reservation", {
    p_listing_id: id, p_session_id: session.id, p_buyer_name: buyerName,
    p_pickup_date: body.pickupDate, p_start: body.pickupStartTime,
    p_end: body.pickupEndTime, p_key: idempotencyKey,
  });
  if (error) return reservationRpcError(error, "reservation_create_failed");
  if (!data?.reservation) return apiError("reservation_confirmation_pending", 502);
  if (data.created) await notifySession(client, session.id, "reservation_created", "상품 예약이 접수되었습니다", "24시간 안에 픽업 일정을 확인하세요.", "reservation", data.reservation.id);
  return NextResponse.json({ reservation: data.reservation }, { status: data.created ? 201 : 200, headers: { "Cache-Control": "no-store" } });
}
