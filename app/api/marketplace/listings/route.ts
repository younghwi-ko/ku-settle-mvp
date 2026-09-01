import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError, text, validImage } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";

const categories: Record<string, string> = { Home: "home", Kitchen: "kitchen", Electronics: "electronics", Bedding: "bedding", home: "home", kitchen: "kitchen", electronics: "electronics", bedding: "bedding" };
const conditions: Record<string, string> = { likeNew: "like_new", like_new: "like_new", good: "good", used: "used", clean: "clean" };

export async function GET(request: Request) {
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120).replace(/[%_(),]/g, "");
  const category = categories[url.searchParams.get("category") ?? ""];
  const requestedStatus = url.searchParams.get("status");
  const statuses = requestedStatus && ["active", "reserved", "sold"].includes(requestedStatus) ? [requestedStatus] : ["active", "reserved", "sold"];
  const sort = url.searchParams.get("sort");
  let query = client.from("guest_listings").select("*", { count: "exact" }).in("status", statuses);
  if (search) query = query.or(`item_name.ilike.%${search}%,description.ilike.%${search}%,pickup_location.ilike.%${search}%`);
  if (category) query = query.eq("category", category);
  if (sort === "price_asc") query = query.order("price_krw", { ascending: true }).order("created_at", { ascending: false });
  else if (sort === "price_desc") query = query.order("price_krw", { ascending: false }).order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  const total = count ?? 0;
  return error ? apiError("listings_load_failed", 502) : NextResponse.json({ listings: data ?? [], pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } }, { headers: { "Cache-Control": "no-store" } });
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
  const imagePath = typeof body.imagePath === "string" && body.imagePath.startsWith(`${session.id}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(body.imagePath) ? body.imagePath : null;
  if (!name || !sellerName || !pickup || description === null || !Number.isInteger(price) || price <= 0 || price > 100_000_000 || !categories[String(body.category)] || !conditions[String(body.condition)] || !validImage(body.imageDataUrl) || (body.imagePath !== undefined && !imagePath)) return apiError("invalid_listing", 422);
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const clientId = body.clientId === undefined ? null : text(body.clientId, 160);
  const { data, error } = await client.from("guest_listings").insert({ session_id: session.id, client_id: clientId, seller_name: sellerName, item_name: name, description, price_krw: price, category: categories[String(body.category)], condition: conditions[String(body.condition)], pickup_location: pickup, availability: "available", status: "active", image_data_url: imagePath ? null : body.imageDataUrl ?? null, image_path: imagePath }).select("*").single();
  return error || !data ? apiError("listing_create_failed", 502) : NextResponse.json({ listing: data }, { status: 201 });
}
