import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, text, uuid, validImage } from "@/app/lib/server-api";
import { adminBody, audit, requireAdmin } from "@/app/lib/admin";

const categories: Record<string, string> = { Home: "home", Kitchen: "kitchen", Electronics: "electronics", Bedding: "bedding", home: "home", kitchen: "kitchen", electronics: "electronics", bedding: "bedding" };
const conditions: Record<string, string> = { likeNew: "like_new", like_new: "like_new", good: "good", used: "used", clean: "clean" };
export async function GET(request: Request) {
  const { client, response } = await requireAdmin(request); if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("guest_listings").select("*").order("updated_at", { ascending: false });
  return error ? apiError("admin_listings_load_failed", 502) : NextResponse.json({ listings: data ?? [] });
}

export async function POST(request: Request) {
  const { client, response } = await requireAdmin(request, true); if (response || !client) return response ?? apiError("server_storage_not_configured", 503);
  const body = await adminBody(request); if (!body) return apiError("invalid_listing", 422);
  const sellerName = text(body.sellerName, 80); const itemName = text(body.itemName, 120); const pickup = text(body.pickupLocation, 200); const description = typeof body.description === "string" && body.description.length <= 2000 ? body.description.trim() : null; const price = body.priceKrw;
  if (body.sessionId !== undefined && !uuid(body.sessionId) || !sellerName || !itemName || !pickup || description === null || !Number.isInteger(price) || Number(price) <= 0 || Number(price) > 100000000 || !categories[String(body.category)] || !conditions[String(body.condition)] || !validImage(body.imageDataUrl)) return apiError("invalid_listing", 422);
  let sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) { const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex"); const owner = await client.from("anonymous_sessions").insert({ token_hash: tokenHash }).select("id").single(); if (owner.error || !owner.data) return apiError("admin_listing_create_failed", 502); sessionId = owner.data.id; }
  const payload = { session_id: sessionId, seller_name: sellerName, item_name: itemName, description, price_krw: price, category: categories[String(body.category)], condition: conditions[String(body.condition)], pickup_location: pickup, availability: "available", status: "active", image_data_url: body.imageDataUrl ?? null };
  const { data, error } = await client.from("guest_listings").insert(payload).select("*").single();
  if (error || !data) return apiError("admin_listing_create_failed", 502); await audit(client, "listing", data.id, "create"); return NextResponse.json({ listing: data }, { status: 201 });
}
