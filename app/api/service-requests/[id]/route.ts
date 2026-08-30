import { NextResponse } from "next/server";
import { apiError, jsonBody, optionalText, record, sessionOrError, uuid } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";
const allowed = new Set(["not-selected", "method-selected", "consultation-ready", "quote-viewed", "application-ready", "in-progress", "completed", "cancelled"]);
const nextStates: Record<string, string[]> = { "not-selected": ["method-selected", "cancelled"], "method-selected": ["consultation-ready", "cancelled"], "consultation-ready": ["quote-viewed", "application-ready", "cancelled"], "quote-viewed": ["application-ready", "cancelled"], "application-ready": ["in-progress", "cancelled"], "in-progress": ["completed", "cancelled"] };
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_service_request_id", 422);
  const body = await jsonBody(request); if (!record(body)) return apiError("invalid_service_request", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const { data: current } = await client.from("guest_service_requests").select("*").eq("id", id).eq("session_id", session.id).maybeSingle(); if (!current) return apiError("service_request_not_found", 404);
  const status = body.status === undefined ? current.status : String(body.status); if (!allowed.has(status) || (status !== current.status && !(nextStates[current.status] ?? []).includes(status))) return apiError("invalid_service_transition", 422);
  const updates: Record<string, unknown> = { status, version: current.version + 1, updated_at: new Date().toISOString() };
  for (const [input, column, max] of [["deliveryMethod", "delivery_method", 20], ["origin", "origin", 200], ["destination", "destination", 200], ["storageDuration", "storage_duration", 10], ["storageLocation", "storage_location", 20], ["estimatedCostLabel", "estimated_cost_label", 120], ["termsNote", "terms_note", 500]] as const) if (body[input] !== undefined) updates[column] = optionalText(body[input], max);
  const { data, error } = await client.from("guest_service_requests").update(updates).eq("id", id).eq("session_id", session.id).eq("version", current.version).select("*").single(); return error ? apiError("service_request_conflict", 409) : NextResponse.json({ serviceRequest: data });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { const body = { ...(await request.clone().json().catch(() => ({}))), status: "cancelled" }; return PATCH(new Request(request, { body: JSON.stringify(body), headers: { "content-type": "application/json", origin: request.headers.get("origin") ?? "" } }), context); }
