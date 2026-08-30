import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, text, validImage } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";

const categories: Record<string, string> = { Home: "home", Kitchen: "kitchen", Electronics: "electronics", Bedding: "bedding", home: "home", kitchen: "kitchen", electronics: "electronics", bedding: "bedding" };
const conditions: Record<string, string> = { likeNew: "like_new", like_new: "like_new", good: "good", used: "used", clean: "clean" };

export async function GET() {
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("guest_listings").select("*").in("status", ["active", "reserved", "sold"]).order("created_at", { ascending: false });
  return error ? apiError("listings_load_failed", 502) : NextResponse.json({ listings: data ?? [] });
}

export async function POST(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError();
  if (response || !session) return response ?? apiError("session_unavailable", 503);
  const body = await jsonBody(request);
  if (!record(body)) return apiError("invalid_listing", 422);
  const name = text(body.itemName, 120); const sellerName = text(body.sellerName, 80); const pickup = text(body.pickupLocation, 200);
  const description = typeof body.description === "string" && body.description.length <= 2000 ? body.description.trim() : null;
  const price = typeof body.priceKrw === "number" && Number.isInteger(body.priceKrw) ? body.priceKrw : NaN;
  if (!name || !sellerName || !pickup || description === null || !Number.isInteger(price) || price <= 0 || price > 100_000_000 || !categories[String(body.category)] || !conditions[String(body.condition)] || !validImage(body.imageDataUrl)) return apiError("invalid_listing", 422);
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const clientId = body.clientId === undefined ? null : text(body.clientId, 160);
  const { data, error } = await client.from("guest_listings").insert({ session_id: session.id, client_id: clientId, seller_name: sellerName, item_name: name, description, price_krw: price, category: categories[String(body.category)], condition: conditions[String(body.condition)], pickup_location: pickup, availability: "available", status: "active", image_data_url: body.imageDataUrl ?? null }).select("*").single();
  return error || !data ? apiError("listing_create_failed", 502) : NextResponse.json({ listing: data }, { status: 201 });
}
