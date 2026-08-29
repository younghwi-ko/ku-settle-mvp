import { NextResponse } from "next/server";
import { kakaoCategoryCode, kakaoKeyword, kakaoPlaceToPlace, KU_CENTER, dedupePlaces, isKakaoPlaceAllowed, KAKAO_SUPPORTED_GROUP_CODES, KAKAO_DEFAULT_RADIUS_METERS } from "@/app/lib/kakao";
import { canUseKakaoCall, kakaoMonthlyLimit, recordKakaoCall } from "@/app/lib/kakao-quota";

const cache = new Map<string, { expiresAt: number; body: object }>();
const TTL_MS = 60_000;
const ALL_CATEGORY_CODES = ["FD6", "CE7", "HP8", "PM9", "MT1"] as const;
type KakaoPayload = { documents?: unknown[]; meta?: { total_count?: number } };

async function fetchKakao(endpoint: string, params: URLSearchParams, restKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${endpoint}?${params}`, { headers: { Authorization: `KakaoAK ${restKey}` }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { ok: false as const, status: response.status, payload: null };
    return { ok: true as const, status: response.status, payload: await response.json() as KakaoPayload };
  } catch {
    return { ok: false as const, status: 0, payload: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "All";
  const query = (url.searchParams.get("query") ?? "").trim();
  const radius = Math.min(20_000, Math.max(100, Number(url.searchParams.get("radius") ?? KAKAO_DEFAULT_RADIUS_METERS)));
  const page = Math.min(45, Math.max(1, Number(url.searchParams.get("page") ?? 1)));
  if (!Number.isInteger(radius) || !Number.isInteger(page) || query.length > 80 || !/^[\p{L}\p{N}\s.,&'()\-]*$/u.test(query)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const code = kakaoCategoryCode(category);
  const keyword = kakaoKeyword(category);
  if (category !== "All" && !code && !keyword && !["Halal", "Vegan", "Food", "Cafe", "Grocery", "Hospital", "Pharmacy", "Hair Salon"].includes(category)) return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  const restKey = process.env.KAKAO_REST_API_KEY;
  if (!restKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const cacheKey = JSON.stringify({ category, query, radius, page });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.body);
  const monthlyLimit = kakaoMonthlyLimit();
  const endpoint = code || category === "All" ? "https://dapi.kakao.com/v2/local/search/category.json" : "https://dapi.kakao.com/v2/local/search/keyword.json";
  const categoryCodes = category === "All" ? ALL_CATEGORY_CODES : code ? [code] : [];
  const documents: unknown[] = [];
  let totalCount = 0;
  let successfulCalls = 0;
  let rateLimited = false;
  for (const categoryCode of categoryCodes) {
    if (!canUseKakaoCall(monthlyLimit)) { rateLimited = true; break; }
    recordKakaoCall();
    const params = new URLSearchParams({ x: String(KU_CENTER.lng), y: String(KU_CENTER.lat), radius: String(radius), page: String(page), size: "15", sort: "distance", category_group_code: categoryCode });
    if (query) params.set("query", query);
    const result = await fetchKakao(endpoint, params, restKey);
    if (!result.ok) { if (result.status === 429) rateLimited = true; continue; }
    successfulCalls += 1;
    documents.push(...(result.payload.documents ?? []));
    totalCount += Number(result.payload.meta?.total_count) || 0;
  }
  if (!categoryCodes.length) {
    if (!canUseKakaoCall(monthlyLimit)) return NextResponse.json({ error: "free_quota_limit", limit: monthlyLimit }, { status: 429 });
    recordKakaoCall();
    const params = new URLSearchParams({ x: String(KU_CENTER.lng), y: String(KU_CENTER.lat), radius: String(radius), page: String(page), size: "15", sort: "distance", query: query || keyword || "고려대학교" });
    const result = await fetchKakao(endpoint, params, restKey);
    if (!result.ok) return NextResponse.json({ error: result.status === 429 ? "rate_limited" : "upstream_unavailable" }, { status: 502 });
    successfulCalls = 1;
    documents.push(...(result.payload.documents ?? []));
    totalCount = Number(result.payload.meta?.total_count) || 0;
  }
  if (!successfulCalls && (rateLimited || category === "All")) return NextResponse.json({ error: rateLimited ? "rate_limited" : "upstream_unavailable" }, { status: 502 });
  const fetchedAt = new Date().toISOString();
  const places = dedupePlaces(documents.filter((item) => isKakaoPlaceAllowed(item, category)).map((item) => kakaoPlaceToPlace(item, fetchedAt, category)).filter((item): item is NonNullable<typeof item> => Boolean(item)));
  const body = { places, fetchedAt, source: "kakao" as const, totalCount: totalCount || places.length, partial: rateLimited || successfulCalls < categoryCodes.length, supportedCategoryCount: KAKAO_SUPPORTED_GROUP_CODES.size };
  cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, body });
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=30" } });
}
