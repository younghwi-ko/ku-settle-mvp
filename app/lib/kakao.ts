import type { Place, PlaceCategory } from "../data";

export const KU_CENTER = { lat: 37.5896, lng: 127.0325 } as const;
export const KAKAO_CATEGORY_CODES: Partial<Record<PlaceCategory, string>> = { Hospital: "HP8", Pharmacy: "PM9", Food: "FD6", Cafe: "CE7", Grocery: "MT1" };
export const KAKAO_KEYWORD_CATEGORIES: Partial<Record<PlaceCategory, string>> = { "Hair Salon": "미용실", Halal: "할랄 음식점", Vegan: "비건 음식점" };

export type KakaoCategory = PlaceCategory | "All";
export type KakaoSearchResponse = { places: Place[]; fetchedAt: string; source: "kakao"; totalCount: number };

export function isValidCoordinates(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { lat?: unknown; lng?: unknown };
  return typeof candidate.lat === "number" && Number.isFinite(candidate.lat) && candidate.lat >= -90 && candidate.lat <= 90 && typeof candidate.lng === "number" && Number.isFinite(candidate.lng) && candidate.lng >= -180 && candidate.lng <= 180;
}

export function kakaoCategoryCode(category: string) { return KAKAO_CATEGORY_CODES[category as PlaceCategory] ?? null; }
export function kakaoKeyword(category: string) { return KAKAO_KEYWORD_CATEGORIES[category as PlaceCategory] ?? null; }

export function kakaoPlaceToPlace(item: unknown, fetchedAt: string, requestedCategory?: string): Place | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.place_name === "string" ? value.place_name.trim() : "";
  const x = Number(value.x);
  const y = Number(value.y);
  if (!id || !name || !Number.isFinite(x) || !Number.isFinite(y) || !isValidCoordinates({ lat: y, lng: x })) return null;
  const groupCode = typeof value.category_group_code === "string" ? value.category_group_code : "";
  const category: PlaceCategory = requestedCategory === "Halal" || requestedCategory === "Vegan" || requestedCategory === "Hair Salon" ? requestedCategory : groupCode === "HP8" ? "Hospital" : groupCode === "PM9" ? "Pharmacy" : groupCode === "CE7" ? "Cafe" : groupCode === "MT1" ? "Grocery" : "Food";
  const address = typeof value.road_address_name === "string" && value.road_address_name.trim() ? value.road_address_name.trim() : typeof value.address_name === "string" ? value.address_name.trim() : "";
  const phone = typeof value.phone === "string" && value.phone.trim() ? value.phone.trim() : undefined;
  const placeUrl = typeof value.place_url === "string" && value.place_url.trim() ? value.place_url.trim() : undefined;
  return { id: Number(`9${id}`), category, nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: Math.max(0, Number(value.distance) || 0), english: false, tipKey: "localGuide:places.anamClinic.tip", displayName: name, displayDescription: typeof value.category_name === "string" ? value.category_name : "", displayLocation: address, address, phone, officialUrl: placeUrl, sourceName: "카카오 장소 검색 결과", lastVerifiedAt: fetchedAt.slice(0, 10), verificationStatus: "verified", source: "kakao", kakaoPlaceId: id, kakaoCategoryCode: groupCode || undefined, kakaoCategoryName: typeof value.category_name === "string" ? value.category_name : undefined, kakaoPlaceUrl: placeUrl, dataFetchedAt: fetchedAt, coordinates: { lat: y, lng: x } };
}

export function dedupePlaces(items: Place[]) { return [...new Map(items.map((item) => [item.kakaoPlaceId ?? `local-${item.id}`, item])).values()]; }
