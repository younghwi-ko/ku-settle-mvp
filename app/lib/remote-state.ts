import type { MarketProduct } from "../data";
import type { LocalPreferences, LocalReservation, LocalServiceRequest } from "./local-data";
import { authHeaders } from "./account-api";
import { accountListingReportPrefix } from "./domain";

type ServerListing = { id: string; client_id?: string | null; seller_name: string; item_name: string; description?: string; price_krw: number; category: "home" | "kitchen" | "electronics" | "bedding"; condition: "like_new" | "good" | "used" | "clean"; pickup_location: string; status: "active" | "reserved" | "sold" | "hidden" | "deleted"; image_data_url?: string | null; image_path?: string | null; updated_at?: string };
type ServerState = { listings: ServerListing[]; myListings?: ServerListing[]; reservations: Array<Record<string, unknown>>; serviceRequests: Array<Record<string, unknown>>; lifecycle: Array<{ task_id: string; completed: boolean }>; preferences?: Record<string, unknown> | null; serverVersion?: number };
export class MarketplaceRequestError extends Error {
  constructor(public readonly kind: "rejected" | "uncertain") { super(kind); }
}
export function marketplaceFailure(status: number) {
  return new MarketplaceRequestError(status >= 400 && status < 500 && ![408, 429].includes(status) ? "rejected" : "uncertain");
}
export async function marketplaceRequest<T>(path: string, init: RequestInit = {}, expectedStatus?: number): Promise<T> {
  try {
    const response = await fetch(path, { ...init, credentials: "include", cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw marketplaceFailure(response.status);
    if (expectedStatus !== undefined && response.status !== expectedStatus) throw new MarketplaceRequestError("uncertain");
    return await response.json() as T;
  } catch (error) {
    if (error instanceof MarketplaceRequestError) throw error;
    throw new MarketplaceRequestError("uncertain");
  }
}
export async function createRemoteReport(product: Pick<MarketProduct, "id" | "accountListing">, reason: string, detail: string) {
  const id = String(product.id);
  const subject = product.accountListing ? { accountListingId: id } : { listingId: id };
  const { report } = await marketplaceRequest<{ report?: Record<string, unknown> }>("/api/reports", {
    method: "POST",
    headers: product.accountListing ? await authHeaders() : { "content-type": "application/json" },
    body: JSON.stringify({ ...subject, reason, detail }),
  }, 201) ?? {};
  if (!report || typeof report.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(report.id)
    || report.listing_id !== (product.accountListing ? null : id) || report.place_key !== (product.accountListing ? accountListingReportPrefix + id : null)
    || report.status !== "new" || report.reason !== reason || report.detail !== detail
    || typeof report.created_at !== "string" || !Number.isFinite(Date.parse(report.created_at))) {
    throw new MarketplaceRequestError("uncertain");
  }
}
const category: Record<ServerListing["category"], MarketProduct["category"]> = { home: "Home", kitchen: "Kitchen", electronics: "Electronics", bedding: "Bedding" };
const condition: Record<ServerListing["condition"], MarketProduct["condition"]> = { like_new: "likeNew", good: "good", used: "used", clean: "clean" };
function storedImageUrl(path?: string | null) { const base = process.env.NEXT_PUBLIC_SUPABASE_URL; return path && base ? `${base}/storage/v1/object/public/marketplace-images/${path.split("/").map(encodeURIComponent).join("/")}` : undefined; }
export function serverListingToProduct(item: ServerListing): MarketProduct { return { id: item.id, name: item.item_name, description: item.description ?? "", priceKrw: item.price_krw, category: category[item.category], condition: condition[item.condition], pickup: item.pickup_location, seller: item.seller_name, status: item.status === "reserved" ? "Reserved" : "Available", icon: "box", source: "live", userCreated: true, ownedByCurrentUser: true, serviceStatus: item.status === "reserved" ? "active" : item.status, imageDataUrl: item.image_data_url ?? storedImageUrl(item.image_path) }; }
export async function bootstrapRemote() { const response = await fetch("/api/session/bootstrap", { method: "POST", credentials: "include" }); return response.ok; }
export async function fetchRemoteState() { const response = await fetch("/api/session/state", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(12000) }); if (!response.ok) throw new Error("remote_state_unavailable"); return await response.json() as ServerState; }
export async function fetchRemoteListings(params: { search?: string; category?: string; sort?: "latest" | "price_asc"; page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams({ page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 20) });
  if (params.search) query.set("search", params.search);
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.sort) query.set("sort", params.sort);
  const response = await fetch(`/api/marketplace/listings?${query}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("remote_listings_unavailable");
  const body = await response.json() as { listings: ServerListing[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
  return { products: body.listings.map((item) => ({ ...serverListingToProduct(item), ownedByCurrentUser: false })), pagination: body.pagination };
}
export function serverReservationToLocal(item: Record<string, unknown>): LocalReservation | null { if (typeof item.id !== "string" || typeof item.listing_id !== "string" || typeof item.buyer_name !== "string" || !["active", "cancelled", "completed", "expired"].includes(String(item.status)) || typeof item.created_at !== "string") return null; return { id: item.id, productId: item.listing_id, buyerName: item.buyer_name, status: item.status as LocalReservation["status"], createdAt: item.created_at, pickupDate: typeof item.pickup_date === "string" ? item.pickup_date : "", pickupStartTime: typeof item.pickup_start_time === "string" ? item.pickup_start_time.slice(0, 5) : "", pickupEndTime: typeof item.pickup_end_time === "string" ? item.pickup_end_time.slice(0, 5) : "", ...(typeof item.cancelled_at === "string" ? { cancelledAt: item.cancelled_at } : {}), ...(typeof item.completed_at === "string" ? { completedAt: item.completed_at } : {}) }; }
export function serverServiceToLocal(item: Record<string, unknown>): LocalServiceRequest | null { if (typeof item.id !== "string" || typeof item.service_type !== "string" || typeof item.status !== "string" || typeof item.updated_at !== "string") return null; return { id: item.id, referenceCode: typeof item.reference_code === "string" ? item.reference_code : undefined, productId: typeof item.listing_id === "string" ? item.listing_id : undefined, taskId: typeof item.task_id === "string" ? item.task_id : undefined, mode: item.service_type as LocalServiceRequest["mode"], status: item.status as LocalServiceRequest["status"], deliveryMethod: typeof item.delivery_method === "string" ? item.delivery_method as LocalServiceRequest["deliveryMethod"] : undefined, origin: typeof item.origin === "string" ? item.origin : undefined, destination: typeof item.destination === "string" ? item.destination : undefined, storageDuration: typeof item.storage_duration === "string" ? item.storage_duration as LocalServiceRequest["storageDuration"] : undefined, storageLocation: typeof item.storage_location === "string" ? item.storage_location as LocalServiceRequest["storageLocation"] : undefined, estimatedCostLabel: typeof item.estimated_cost_label === "string" ? item.estimated_cost_label : undefined, termsNote: typeof item.terms_note === "string" ? item.terms_note : undefined, createdAt: typeof item.created_at === "string" ? item.created_at : item.updated_at, updatedAt: item.updated_at }; }
export async function importRemoteState(data: { profile?: unknown; done?: string[]; products: MarketProduct[]; preferences?: LocalPreferences; sellerName?: string; locale: string }) { const response = await fetch("/api/session/state", { method: "PUT", credentials: "include", headers: { "content-type": "application/json", "x-idempotency-key": `migration-${Date.now()}` }, body: JSON.stringify(data) }); if (!response.ok) throw new Error("remote_import_failed"); }
async function uploadRemoteImage(imageDataUrl: string) { const response = await fetch("/api/marketplace/images", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageDataUrl }) }); if (!response.ok) throw new Error("remote_image_upload_failed"); return String((await response.json()).imagePath); }
export async function createRemoteListing(product: MarketProduct, sellerName: string) { const imagePath = product.imageDataUrl ? await uploadRemoteImage(product.imageDataUrl) : null; const response = await fetch("/api/marketplace/listings", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-idempotency-key": `listing-${product.id}` }, body: JSON.stringify({ clientId: String(product.id), sellerName, itemName: product.name ?? product.nameKey?.split(".").pop() ?? "Item", description: product.description ?? "", priceKrw: product.priceKrw, category: product.category, condition: product.condition, pickupLocation: product.pickup ?? "KU campus", imageDataUrl: imagePath ? null : product.imageDataUrl || null, imagePath: imagePath ?? undefined }) }); if (!response.ok) throw new Error("remote_listing_create_failed"); return serverListingToProduct((await response.json()).listing); }
export async function updateRemoteListing(product: MarketProduct, status?: MarketProduct["serviceStatus"]) {
  const path = `/api/marketplace/listings/${encodeURIComponent(String(product.id))}`;
  const fields = status ? { status } : {
    itemName: product.name, description: product.description, priceKrw: product.priceKrw, pickupLocation: product.pickup,
    imageDataUrl: product.imageDataUrl?.startsWith("data:image/") ? product.imageDataUrl : product.imageDataUrl ? undefined : null,
  };
  const body = await marketplaceRequest<{ listing?: ServerListing }>(path, status === "deleted" ? { method: "DELETE" } : {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(fields),
  });
  const row = body?.listing;
  if (row?.id !== product.id || (status && row.status !== status && !(status === "active" && row.status === "reserved"))
    || !["active", "reserved", "sold", "hidden", "deleted"].includes(row.status)
    || typeof row.item_name !== "string" || !Number.isInteger(row.price_krw) || typeof row.pickup_location !== "string"
    || !Object.hasOwn(category, row.category) || !Object.hasOwn(condition, row.condition)) throw new MarketplaceRequestError("uncertain");
  return serverListingToProduct(row);
}
export async function upsertRemoteService(request: LocalServiceRequest) { const response = await fetch("/api/service-requests", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-idempotency-key": request.id }, body: JSON.stringify({ idempotencyKey: request.id, listingId: request.productId, taskId: request.taskId, serviceType: request.mode, status: request.status, storageDuration: request.storageDuration, storageLocation: request.storageLocation, deliveryMethod: request.deliveryMethod, origin: request.origin, destination: request.destination, estimatedCostLabel: request.estimatedCostLabel, termsNote: request.termsNote }) }); if (!response.ok) throw new Error("remote_service_request_failed"); return (await response.json()).serviceRequest as Record<string, unknown>; }
export async function cancelRemoteService(id: string) { const response = await fetch(`/api/service-requests/${encodeURIComponent(id)}/cancel`, { method: "POST", credentials: "include" }); if (!response.ok) throw new Error("remote_service_cancel_failed"); return (await response.json()).serviceRequest as Record<string, unknown>; }
export async function updateRemoteLifecycle(taskId: string, completed: boolean) { const response = await fetch("/api/lifecycle/progress", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId, completed }) }); if (!response.ok) throw new Error("remote_lifecycle_failed"); }
