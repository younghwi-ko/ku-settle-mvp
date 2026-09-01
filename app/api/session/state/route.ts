import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, text, validImage } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";
import { expireReservations } from "@/app/lib/reservation-expiry";

const categories: Record<string, string> = { Home: "home", Kitchen: "kitchen", Electronics: "electronics", Bedding: "bedding" };
const conditions: Record<string, string> = { likeNew: "like_new", good: "good", used: "used", clean: "clean" };
export async function GET() {
  const { session, response } = await sessionOrError();
  if (response || !session) return response ?? apiError("session_unavailable", 503);
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  await expireReservations(client);
  const [profile, listings, ownListings, reservations, services, progress, preferences] = await Promise.all([
    client.from("guest_profiles").select("*").eq("session_id", session.id).maybeSingle(),
    client.from("guest_listings").select("*").in("status", ["active", "reserved", "sold"]).order("created_at", { ascending: false }),
    client.from("guest_listings").select("*").eq("session_id", session.id).order("updated_at", { ascending: false }),
    client.from("guest_reservations").select("*").eq("buyer_session_id", session.id).neq("status", "soft_deleted").order("updated_at", { ascending: false }),
    client.from("guest_service_requests").select("id,reference_code,listing_id,task_id,service_type,status,delivery_method,origin,destination,storage_duration,storage_location,estimated_cost_label,terms_note,version,created_at,updated_at").eq("session_id", session.id).neq("status", "soft_deleted").order("updated_at", { ascending: false }),
    client.from("guest_lifecycle_progress").select("*").eq("session_id", session.id),
    client.from("guest_preferences").select("*").eq("session_id", session.id).maybeSingle(),
  ]);
  const error = [profile, listings, ownListings, reservations, services, progress, preferences].find((item) => item.error)?.error;
  if (error) return apiError("state_load_failed", 502);
  const allListings = listings.data ?? [];
  const myListings = ownListings.data ?? [];
  const ownListingIds = myListings.map((row) => row.id);
  const sellerReservations = ownListingIds.length ? await client.from("guest_reservations").select("*").in("listing_id", ownListingIds).neq("status", "soft_deleted").order("updated_at", { ascending: false }) : { data: [], error: null };
  if (sellerReservations.error) return apiError("state_load_failed", 502);
  const reservationById = new Map<string, Record<string, unknown>>();
  for (const item of [...(reservations.data ?? []), ...(sellerReservations.data ?? [])]) reservationById.set(String(item.id), item);
  const stateResponse = NextResponse.json({ profile: profile.data, listings: allListings, myListings, reservations: [...reservationById.values()], serviceRequests: services.data ?? [], lifecycle: progress.data ?? [], preferences: preferences.data, serverVersion: Math.max(1, ...[profile.data?.version, preferences.data?.version, ...(allListings).map((row) => row.version)].filter((value): value is number => typeof value === "number")) });
  stateResponse.headers.set("Cache-Control", "no-store");
  return stateResponse;
}
export async function PUT(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const body = await jsonBody(request); if (!record(body)) return apiError("invalid_state", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const profile = record(body.profile) ? body.profile : null;
  if (profile) {
    const displayName = text(profile.name, 80) ?? "Alex";
    const housing = profile.housing === "off-campus" ? "off_campus" : "dormitory";
    const { error } = await client.from("guest_profiles").upsert({ session_id: session.id, display_name: displayName, arrival_date: typeof profile.arrivalDate === "string" && profile.arrivalDate ? profile.arrivalDate : null, housing_type: housing, locale: typeof body.locale === "string" ? body.locale : "en", version: 1 }, { onConflict: "session_id" });
    if (error) return apiError("state_import_failed", 502);
  }
  if (Array.isArray(body.done)) for (const taskId of body.done.filter((value): value is string => typeof value === "string" && /^[a-z0-9-]{2,80}$/.test(value))) await client.from("guest_lifecycle_progress").upsert({ session_id: session.id, task_id: taskId, completed: true }, { onConflict: "session_id,task_id" });
  if (record(body.preferences)) await client.from("guest_preferences").upsert({ session_id: session.id, favorite_product_ids: body.preferences.favoriteProductIds ?? [], place_favorites: body.preferences.placeFavorites ?? [], reports: body.preferences.reports ?? {}, guide_favorites: body.preferences.guideFavorites ?? [], guide_metadata: body.preferences.guideMetadata ?? {} }, { onConflict: "session_id" });
  if (Array.isArray(body.products)) for (const item of body.products) {
    if (!record(item) || !text(item.name, 120) || !Number.isInteger(item.priceKrw) || Number(item.priceKrw) <= 0 || !categories[item.category as string] || !conditions[item.condition as string] || !text(item.pickup, 200) || !validImage(item.imageDataUrl)) continue;
    await client.from("guest_listings").upsert({ session_id: session.id, client_id: item.id === undefined ? null : String(item.id).slice(0, 160), seller_name: text(profile?.name, 80) ?? "Alex", item_name: item.name, description: typeof item.description === "string" ? item.description.slice(0, 2000) : "", price_krw: item.priceKrw, category: categories[item.category as string], condition: conditions[item.condition as string], pickup_location: item.pickup, availability: "available", status: item.serviceStatus === "sold" ? "sold" : item.serviceStatus === "hidden" ? "hidden" : "active", image_data_url: item.imageDataUrl ?? null }, { onConflict: "session_id,client_id" });
  }
  return NextResponse.json({ ok: true, imported: true });
}
