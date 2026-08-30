import type { Place, PlaceCategory } from "../data";

export const KU_CENTER = { lat: 37.5896, lng: 127.0325 } as const;
export const KU_SCIENCE_CENTER = { lat: 37.5909, lng: 127.0338 } as const;
export const KAKAO_DEFAULT_RADIUS_METERS = 4_000;
export type CampusFilter = "all" | "main" | "science";
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) { const lat = (a.lat - b.lat) * 111_000; const lng = (a.lng - b.lng) * 88_000; return Math.sqrt(lat * lat + lng * lng); }
export function campusScopeForCoordinates(coordinates: { lat: number; lng: number }) { return distanceMeters(coordinates, KU_SCIENCE_CENTER) <= 1_200 ? "science" as const : distanceMeters(coordinates, KU_CENTER) <= 1_200 ? "main" as const : "shared" as const; }
export const KAKAO_CATEGORY_CODES: Partial<Record<PlaceCategory, string>> = { Hospital: "HP8", Pharmacy: "PM9", Food: "FD6", Cafe: "CE7", Grocery: "MT1" };
export const KAKAO_KEYWORD_CATEGORIES: Partial<Record<PlaceCategory, string>> = { "Hair Salon": "미용실", Halal: "할랄 음식점", Vegan: "비건 음식점" };
export const KAKAO_SUPPORTED_GROUP_CODES = new Set(["FD6", "CE7", "HP8", "PM9", "MT1"]);

export type KakaoCategory = PlaceCategory | "All";
export type KakaoSearchResponse = { places: Place[]; fetchedAt: string; source: "kakao"; totalCount: number };

export function isValidCoordinates(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { lat?: unknown; lng?: unknown };
  return typeof candidate.lat === "number" && Number.isFinite(candidate.lat) && candidate.lat >= -90 && candidate.lat <= 90 && typeof candidate.lng === "number" && Number.isFinite(candidate.lng) && candidate.lng >= -180 && candidate.lng <= 180;
}

export function kakaoCategoryCode(category: string) { return KAKAO_CATEGORY_CODES[category as PlaceCategory] ?? null; }
export function kakaoKeyword(category: string) { return KAKAO_KEYWORD_CATEGORIES[category as PlaceCategory] ?? null; }

/** Dietary filters only match explicit tags; a keyword result is not proof. */
export function matchesPlaceCategory(place: Pick<Place, "category" | "kind" | "halalStatus" | "veganStatus">, requestedCategory: string) {
  if (place.kind === "campus") return requestedCategory === "All";
  if (requestedCategory === "Halal") return Boolean(place.halalStatus);
  if (requestedCategory === "Vegan") return Boolean(place.veganStatus);
  return requestedCategory === "All" || place.category === requestedCategory;
}

export function isKakaoPlaceAllowed(item: unknown, requestedCategory = "All") {
  if (!item || typeof item !== "object") return false;
  const code = typeof (item as Record<string, unknown>).category_group_code === "string" ? (item as Record<string, string>).category_group_code : "";
  const requestedCode = kakaoCategoryCode(requestedCategory);
  if (requestedCode) return code === requestedCode;
  if (requestedCategory === "All") return KAKAO_SUPPORTED_GROUP_CODES.has(code);
  return Boolean(kakaoKeyword(requestedCategory));
}

export function kakaoPlaceToPlace(item: unknown, fetchedAt: string, requestedCategory = "All"): Place | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.place_name === "string" ? value.place_name.trim() : "";
  const x = Number(value.x);
  const y = Number(value.y);
  if (!id || !name || !Number.isFinite(x) || !Number.isFinite(y) || !isValidCoordinates({ lat: y, lng: x })) return null;
  const groupCode = typeof value.category_group_code === "string" ? value.category_group_code : "";
  if (requestedCategory === "All" && !KAKAO_SUPPORTED_GROUP_CODES.has(groupCode)) return null;
  if (requestedCategory && kakaoCategoryCode(requestedCategory) && groupCode !== kakaoCategoryCode(requestedCategory)) return null;
  const keywordCategory = requestedCategory === "Halal" || requestedCategory === "Vegan" || requestedCategory === "Hair Salon";
  const category: PlaceCategory = keywordCategory ? requestedCategory : groupCode === "HP8" ? "Hospital" : groupCode === "PM9" ? "Pharmacy" : groupCode === "CE7" ? "Cafe" : groupCode === "MT1" ? "Grocery" : "Food";
  const address = typeof value.road_address_name === "string" && value.road_address_name.trim() ? value.road_address_name.trim() : typeof value.address_name === "string" ? value.address_name.trim() : "";
  const phone = typeof value.phone === "string" && value.phone.trim() ? value.phone.trim() : undefined;
  const placeUrl = typeof value.place_url === "string" && value.place_url.trim() ? value.place_url.trim() : undefined;
  return { id: Number(`9${id}`), category, nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: Math.max(0, Number(value.distance) || 0), english: false, tipKey: "localGuide:places.anamClinic.tip", displayName: name, displayDescription: typeof value.category_name === "string" ? value.category_name : "", displayLocation: address, address, phone, officialUrl: placeUrl, sourceName: "카카오 장소 검색 결과", lastVerifiedAt: fetchedAt.slice(0, 10), verificationStatus: keywordCategory ? "needs_confirmation" : "verified", source: "kakao", kakaoPlaceId: id, kakaoCategoryCode: groupCode || undefined, kakaoCategoryName: typeof value.category_name === "string" ? value.category_name : undefined, kakaoCategoryGroupName: typeof value.category_group_name === "string" ? value.category_group_name : undefined, kakaoPlaceUrl: placeUrl, dataFetchedAt: fetchedAt, coordinates: { lat: y, lng: x }, campusScope: campusScopeForCoordinates({ lat: y, lng: x }) };
}

export function dedupePlaces(items: Place[]) { const seen = new Map<string, Place>(); for (const item of items) { const key = item.kakaoPlaceId ?? `local:${item.displayName ?? item.localizedName?.ko ?? item.id}|${item.address ?? item.displayLocation ?? ""}`.toLocaleLowerCase(); if (!seen.has(key)) seen.set(key, item); } return [...seen.values()]; }
