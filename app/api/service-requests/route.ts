import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { apiError, jsonBody, optionalText, record, sessionOrError, uuid } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";
const modes = new Set(["pickup", "delivery", "storage", "sale", "donation", "disposal"]);
const statuses = new Set(["not-selected", "method-selected", "consultation-ready", "quote-viewed", "application-ready", "in-progress", "completed", "cancelled"]);
const transitions: Record<string, string[]> = { "not-selected": ["method-selected", "cancelled"], "method-selected": ["consultation-ready", "cancelled"], "consultation-ready": ["quote-viewed", "application-ready", "cancelled"], "quote-viewed": ["application-ready", "cancelled"], "application-ready": ["in-progress", "cancelled"], "in-progress": ["completed", "cancelled"] };
export async function POST(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const body = await jsonBody(request); if (!record(body) || !modes.has(String(body.serviceType))) return apiError("invalid_service_request", 422);
  if (body.listingId !== undefined && body.listingId !== null && !uuid(body.listingId)) return apiError("invalid_listing_id", 422);
  const status = body.status === undefined ? "method-selected" : String(body.status); if (!statuses.has(status)) return apiError("invalid_service_status", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const idempotencyKey = optionalText(body.idempotencyKey, 120);
  const listingId = body.listingId ?? null; const taskId = optionalText(body.taskId, 120); const query = client.from("guest_service_requests").select("*").eq("session_id", session.id).eq("service_type", body.serviceType);
  const existingResult = listingId ? await query.eq("listing_id", listingId).maybeSingle() : taskId ? await query.is("listing_id", null).eq("task_id", taskId).maybeSingle() : { data: null };
  const existing = existingResult.data;
  const now = new Date().toISOString(); const payload = { session_id: session.id, listing_id: listingId, task_id: taskId, service_type: body.serviceType, status, delivery_method: optionalText(body.deliveryMethod, 20), origin: optionalText(body.origin, 200), destination: optionalText(body.destination, 200), storage_duration: optionalText(body.storageDuration, 10), storage_location: optionalText(body.storageLocation, 20), estimated_cost_label: optionalText(body.estimatedCostLabel, 120), terms_note: optionalText(body.termsNote, 500), idempotency_key: idempotencyKey, updated_at: now };
  if (existing) {
    const current = String(existing.status);
    const userCancellation = status === "cancelled" && ["not-selected", "method-selected", "consultation-ready", "quote-viewed", "application-ready"].includes(current);
    if (status !== current && !userCancellation) return apiError("invalid_service_transition", 409);
    const unchanged = existing.status === payload.status && existing.delivery_method === payload.delivery_method && existing.origin === payload.origin && existing.destination === payload.destination && existing.storage_duration === payload.storage_duration && existing.storage_location === payload.storage_location && existing.estimated_cost_label === payload.estimated_cost_label && existing.terms_note === payload.terms_note;
    if (idempotencyKey && existing.idempotency_key === idempotencyKey && unchanged) return NextResponse.json({ serviceRequest: existing });
    const { data, error } = await client.from("guest_service_requests").update({ ...payload, version: existing.version + 1 }).eq("id", existing.id).eq("version", existing.version).select("*").single();
    return error ? apiError("service_request_update_failed", 409) : NextResponse.json({ serviceRequest: data });
  }
  if (idempotencyKey) { const { data: duplicate } = await client.from("guest_service_requests").select("*").eq("session_id", session.id).eq("idempotency_key", idempotencyKey).maybeSingle(); if (duplicate) return NextResponse.json({ serviceRequest: duplicate }); }
  if (status !== "method-selected") return apiError("invalid_service_transition", 409);
  // The public reference must be unique independently of the request idempotency key.
  // A collision is unlikely, but retrying keeps the user-visible guarantee deterministic.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const referenceCode = `REQ-${randomBytes(5).toString("hex").toUpperCase()}`;
    const { data, error } = await client.from("guest_service_requests").insert({ ...payload, reference_code: referenceCode, created_at: now, version: 1 }).select("*").single();
    if (data && !error) return NextResponse.json({ serviceRequest: data }, { status: 201 });
    if (error?.code !== "23505") return apiError("service_request_create_failed", 502);
  }
  return apiError("service_request_reference_unavailable", 503);
}
