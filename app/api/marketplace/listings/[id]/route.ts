import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, text, uuid, validImage } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";

const statuses = new Set(["active", "sold", "hidden", "deleted"]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_listing_id", 422);
  const body = await jsonBody(request); if (!record(body)) return apiError("invalid_listing", 422);
  const updates: Record<string, unknown> = {};
  if (body.itemName !== undefined) { const value = text(body.itemName, 120); if (!value) return apiError("invalid_listing", 422); updates.item_name = value; }
  if (body.description !== undefined) { if (typeof body.description !== "string" || body.description.length > 2000) return apiError("invalid_listing", 422); updates.description = body.description.trim(); }
  if (body.pickupLocation !== undefined) { const value = text(body.pickupLocation, 200); if (!value) return apiError("invalid_listing", 422); updates.pickup_location = value; }
  if (body.priceKrw !== undefined) { if (!Number.isInteger(body.priceKrw) || Number(body.priceKrw) <= 0 || Number(body.priceKrw) > 100_000_000) return apiError("invalid_listing", 422); updates.price_krw = body.priceKrw; }
  if (body.imageDataUrl !== undefined) { if (!validImage(body.imageDataUrl)) return apiError("invalid_listing_image", 422); updates.image_data_url = body.imageDataUrl ?? null; }
  if (body.imagePath !== undefined) { if (typeof body.imagePath !== "string" || !body.imagePath.startsWith(`${session.id}/`) || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(body.imagePath)) return apiError("invalid_listing_image", 422); updates.image_path = body.imagePath; updates.image_data_url = null; }
  if (body.status !== undefined) { if (!statuses.has(String(body.status))) return apiError("invalid_listing_status", 422); updates.status = body.status; updates.availability = body.status === "active" ? "available" : body.status === "reserved" ? "reserved" : "available"; }
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const version = typeof body.version === "number" ? body.version : null;
  let query = client.from("guest_listings").update({ ...updates, version: version === null ? undefined : version + 1 }).eq("id", id).eq("session_id", session.id);
  if (version !== null) query = query.eq("version", version) as typeof query;
  const { data, error } = await query.select("*").single();
  if (error) return apiError(error.code === "PGRST116" ? "listing_conflict_or_not_found" : "listing_update_failed", error.code === "PGRST116" ? 409 : 502);
  return NextResponse.json({ listing: data });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const { id } = await context.params; if (!uuid(id)) return apiError("invalid_listing_id", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const { error } = await client.from("guest_listings").update({ status: "deleted", availability: "available", version: undefined }).eq("id", id).eq("session_id", session.id);
  if (error) return apiError("listing_delete_failed", 502);
  return NextResponse.json({ ok: true });
}
