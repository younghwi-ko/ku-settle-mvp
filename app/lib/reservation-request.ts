import type { LocalPreferences, LocalReservation } from "./local-data";
import { serverReservationToLocal } from "./remote-state";

export type PickupSchedule = Pick<LocalReservation, "pickupDate" | "pickupStartTime" | "pickupEndTime">;
export class ReservationRequestError extends Error {
  constructor(public readonly kind: "rejected" | "uncertain") { super(kind); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reservationFromResponse(value: unknown, productId: string, expectedId?: string) {
  if (!value || typeof value !== "object") throw new ReservationRequestError("uncertain");
  const row = value as Record<string, unknown>;
  const reservation = serverReservationToLocal(row);
  if (!reservation || !uuid.test(reservation.id) || reservation.productId !== productId || (expectedId && reservation.id !== expectedId)
    || !Number.isFinite(Date.parse(reservation.createdAt)) || !/^\d{4}-\d{2}-\d{2}$/.test(reservation.pickupDate)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reservation.pickupStartTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reservation.pickupEndTime)
    || reservation.pickupEndTime <= reservation.pickupStartTime) throw new ReservationRequestError("uncertain");
  // Expired active rows can be returned before the server's expiry sweep runs.
  if (reservation.status === "active") {
    if (typeof row.expires_at !== "string" || !Number.isFinite(Date.parse(row.expires_at))) throw new ReservationRequestError("uncertain");
    if (Date.parse(row.expires_at) <= Date.now()) return { ...reservation, status: "expired" as const };
  }
  return reservation;
}

async function reservationFetch(path: string, init: RequestInit = {}) {
  try {
    const response = await fetch(path, { ...init, credentials: "include", cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new ReservationRequestError(response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status) ? "rejected" : "uncertain");
    return await response.json() as { reservation?: unknown };
  } catch (error) {
    if (error instanceof ReservationRequestError) throw error;
    throw new ReservationRequestError("uncertain");
  }
}

export async function saveServerReservation(productId: string, buyerName: string, pickup: PickupSchedule, requestKey: string, existingId?: string) {
  const path = existingId ? `/api/reservations/${encodeURIComponent(existingId)}` : `/api/marketplace/listings/${encodeURIComponent(productId)}/reservations`;
  const body = await reservationFetch(path, { method: existingId ? "PATCH" : "POST", headers: { "content-type": "application/json", "x-idempotency-key": requestKey }, body: JSON.stringify({ buyerName, ...pickup }) });
  const reservation = reservationFromResponse(body.reservation, productId, existingId);
  if (reservation.status === "active" && Object.keys(pickup).some((key) => reservation[key as keyof PickupSchedule] !== pickup[key as keyof PickupSchedule])) throw new ReservationRequestError("uncertain");
  return reservation;
}

export async function checkServerReservation(productId: string, requestKey: string, existingId?: string) {
  const query = new URLSearchParams(existingId ? { reservationId: existingId } : { requestKey });
  const body = await reservationFetch(`/api/marketplace/listings/${encodeURIComponent(productId)}/reservations?${query}`);
  if (body.reservation === null) return null;
  return reservationFromResponse(body.reservation, productId, existingId);
}

export async function cancelServerReservation(reservation: LocalReservation) {
  const body = await reservationFetch(`/api/reservations/${encodeURIComponent(reservation.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
  const updated = reservationFromResponse(body.reservation, reservation.productId, reservation.id);
  if (updated.status === "active") throw new ReservationRequestError("uncertain");
  return updated;
}

export function applyServerReservation(preferences: LocalPreferences, reservation: LocalReservation): LocalPreferences {
  const reservations = [...preferences.reservations.filter((item) => item.id !== reservation.id && !(reservation.status === "active" && item.productId === reservation.productId && item.status === "active")), reservation];
  return { ...preferences, reservations, reservedProductIds: [...new Set([...preferences.reservedProductIds.filter((id) => id !== reservation.productId), ...reservations.filter((item) => item.status === "active").map((item) => item.productId)])] };
}
