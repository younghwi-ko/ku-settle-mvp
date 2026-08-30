import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, uuid } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_reservation_id", 422);
  const body = await jsonBody(request); if (!record(body)) return apiError("invalid_reservation", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const { data: reservation } = await client.from("guest_reservations").select("*").eq("id", id).maybeSingle();
  if (!reservation) return apiError("reservation_not_found", 404);
  const { data: listing } = await client.from("guest_listings").select("id,session_id,status").eq("id", reservation.listing_id).single();
  const isBuyer = reservation.buyer_session_id === session.id; const isSeller = listing?.session_id === session.id;
  if (!isBuyer && !isSeller) return apiError("forbidden", 403);
  if (body.status === "cancelled") {
    if (reservation.status !== "active") return NextResponse.json({ reservation });
    const { data, error } = await client.from("guest_reservations").update({ status: "cancelled", cancelled_at: new Date().toISOString(), version: reservation.version + 1 }).eq("id", id).eq("version", reservation.version).select("*").single();
    if (error) return apiError("reservation_update_failed", 409);
    await client.from("guest_listings").update({ status: "active", availability: "available" }).eq("id", reservation.listing_id).eq("status", "reserved");
    return NextResponse.json({ reservation: data });
  }
  if (!isBuyer || (body.status !== undefined && body.status !== "active")) return apiError("invalid_reservation_update", 422);
  const fields: Record<string, unknown> = {};
  for (const key of ["pickupDate", "pickupStartTime", "pickupEndTime"]) if (body[key] !== undefined) fields[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = body[key];
  const date = typeof fields.pickup_date === "string" ? fields.pickup_date : String(reservation.pickup_date ?? "").slice(0, 10);
  const start = typeof fields.pickup_start_time === "string" ? fields.pickup_start_time : String(reservation.pickup_start_time ?? "").slice(0, 5);
  const end = typeof fields.pickup_end_time === "string" ? fields.pickup_end_time : String(reservation.pickup_end_time ?? "").slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end < start) return apiError("invalid_pickup_schedule", 422);
  const { data, error } = await client.from("guest_reservations").update({ ...fields, version: reservation.version + 1 }).eq("id", id).eq("buyer_session_id", session.id).eq("status", "active").eq("version", reservation.version).select("*").single();
  return error ? apiError("reservation_update_failed", 409) : NextResponse.json({ reservation: data });
}
