import type { Locale } from "../i18n";
import type { MarketProduct, ProductCategory, ProductCondition } from "../data";

export type AppMode = "guest" | "demo" | "authenticated";
export type Housing = "dorm" | "off-campus";
export type DbHousing = "dormitory" | "off_campus";

export type StoredProfile = {
  name: string;
  arrivalDate: string;
  housing: Housing;
  mode: "personalized" | "demo";
};

export type ProfileRow = {
  user_id: string;
  display_name: string | null;
  preferred_language: Locale;
  expected_arrival_date: string | null;
  housing_type: DbHousing | null;
  onboarding_completed: boolean;
  guest_data_imported_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgressRow = { task_id: string; completed: boolean };

export type MarketplaceRow = {
  id: string;
  seller_id: string;
  seller_display_name: string;
  item_name: string;
  price_krw: number;
  category: "home" | "kitchen" | "electronics" | "bedding";
  condition: "like_new" | "good" | "used" | "clean";
  pickup_location: string;
  availability: "available" | "reserved";
  status: "active" | "sold" | "hidden" | "deleted";
  guest_source_id: string | null;
  created_at: string;
  updated_at: string;
};

const localeSet = new Set(["en", "ko", "ja", "zh-CN"]);
const categoryMap: Record<ProductCategory, MarketplaceRow["category"]> = { Home: "home", Kitchen: "kitchen", Electronics: "electronics", Bedding: "bedding" };
const categoryFromDb: Record<MarketplaceRow["category"], ProductCategory> = { home: "Home", kitchen: "Kitchen", electronics: "Electronics", bedding: "Bedding" };
const conditionMap: Record<ProductCondition, MarketplaceRow["condition"]> = { likeNew: "like_new", good: "good", used: "used", clean: "clean" };
const conditionFromDb: Record<MarketplaceRow["condition"], ProductCondition> = { like_new: "likeNew", good: "good", used: "used", clean: "clean" };

export function normalizeKuEmail(value: string) { return value.trim().toLowerCase(); }
export function isKuEmail(value: string) { return /^[^@\s]+@korea\.ac\.kr$/.test(normalizeKuEmail(value)); }
export function normalizeLocale(value: unknown): Locale { return typeof value === "string" && localeSet.has(value) ? value as Locale : "en"; }
export function googleMapsSearchUrl(place: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.trim())}`; }
export function googleMapsDirectionsUrl(place: string) { return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.trim())}`; }
export function isValidImageDataUrl(value: unknown, maxLength = 3_000_000) { return typeof value === "string" && (!value || value.length <= maxLength && /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)); }
export function isOwnedMarketplaceProduct(product: Pick<MarketProduct, "userCreated" | "source" | "ownedByCurrentUser">, appMode: AppMode) {
  return appMode === "authenticated"
    ? product.source === "live" && product.ownedByCurrentUser === true
    : product.userCreated === true && product.source !== "sample";
}
export function toDbHousing(value: Housing): DbHousing { return value === "dorm" ? "dormitory" : "off_campus"; }
export function fromDbHousing(value: DbHousing | null): Housing { return value === "off_campus" ? "off-campus" : "dorm"; }

export function validateProfileInput(value: Pick<StoredProfile, "name" | "arrivalDate" | "housing">) {
  const name = value.name.trim();
  if (!name || name.length > 80) return { valid: false as const, error: "validation:nameRequired" };
  if (value.arrivalDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.arrivalDate)) return { valid: false as const, error: "validation:invalidDate" };
  return { valid: true as const, value: { ...value, name } };
}

export function validateMarketplaceInput(product: Pick<MarketProduct, "name" | "priceKrw" | "category" | "condition" | "pickup" | "status">) {
  const name = product.name?.trim() ?? "";
  const pickup = product.pickup?.trim() ?? "";
  if (!name || name.length > 120) return { valid: false as const, error: "validation:itemRequired" };
  if (!Number.isInteger(product.priceKrw) || product.priceKrw <= 0 || product.priceKrw > 100_000_000) return { valid: false as const, error: "validation:validPrice" };
  if (!pickup || pickup.length > 200) return { valid: false as const, error: "validation:pickupRequired" };
  return { valid: true as const, value: { ...product, name, pickup } };
}

export function mergeCompletedTaskIds(server: string[], guest: string[], allowed: string[]) {
  const allow = new Set(allowed);
  return [...new Set([...server, ...guest].filter((id) => allow.has(id)))];
}

export function profileRowToStored(row: ProfileRow): StoredProfile {
  return { name: row.display_name ?? "", arrivalDate: row.expected_arrival_date ?? "", housing: fromDbHousing(row.housing_type), mode: "personalized" };
}

export function marketplaceRowToProduct(row: MarketplaceRow, currentUserId?: string): MarketProduct {
  return {
    id: row.id, name: row.item_name, priceKrw: row.price_krw, category: categoryFromDb[row.category], condition: conditionFromDb[row.condition],
    pickup: row.pickup_location, seller: row.seller_display_name, status: row.status === "sold" || row.availability === "reserved" ? "Reserved" : "Available", icon: row.category === "kitchen" ? "cooking" : row.category === "electronics" ? "fan" : row.category === "bedding" ? "bed" : "box", userCreated: true, source: "live", ownedByCurrentUser: row.seller_id === currentUserId, serviceStatus: row.status
  };
}

export function productToMarketplaceInsert(product: MarketProduct, sellerId: string, sellerName: string, guestSourceId?: string) {
  const validation = validateMarketplaceInput(product);
  if (!validation.valid) throw new Error(validation.error);
  return {
    seller_id: sellerId, seller_display_name: sellerName.trim().slice(0, 80), item_name: validation.value.name, price_krw: validation.value.priceKrw,
    category: categoryMap[validation.value.category], condition: conditionMap[validation.value.condition], pickup_location: validation.value.pickup,
    availability: validation.value.status === "Reserved" ? "reserved" : "available", status: "active" as const, guest_source_id: guestSourceId ?? null
  };
}

export function mapServiceError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("rate") || message.includes("too many")) return "errors:rateLimit";
  if (message.includes("jwt") || message.includes("session")) return "errors:sessionExpired";
  if (message.includes("permission") || message.includes("row-level") || message.includes("42501")) return "errors:permissionDenied";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "errors:offline";
  return "errors:supabaseUnavailable";
}
