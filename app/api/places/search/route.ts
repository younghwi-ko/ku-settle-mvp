import { NextResponse } from "next/server";
import { kakaoCategoryCode, kakaoKeyword, kakaoPlaceToPlace, KU_CENTER, dedupePlaces, isKakaoPlaceAllowed } from "@/app/lib/kakao";
import { canUseKakaoCall, kakaoMonthlyLimit, recordKakaoCall } from "@/app/lib/kakao-quota";

const cache = new Map<string, { expiresAt: number; body: object }>();
const TTL_MS = 60_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "All";
  const query = (url.searchParams.get("query") ?? "").trim();
  const radius = Math.min(20_000, Math.max(100, Number(url.searchParams.get("radius") ?? 2_000)));
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
  if (!canUseKakaoCall(monthlyLimit)) return NextResponse.json({ error: "free_quota_limit", limit: monthlyLimit }, { status: 429 });
  recordKakaoCall();
  const endpoint = code ? "https://dapi.kakao.com/v2/local/search/category.json" : "https://dapi.kakao.com/v2/local/search/keyword.json";
  const params = new URLSearchParams({ x: String(KU_CENTER.lng), y: String(KU_CENTER.lat), radius: String(radius), page: String(page), size: "15", sort: "distance" });
  if (code) params.set("category_group_code", code);
  if (query || keyword || !code) params.set("query", query || keyword || "고려대학교");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${endpoint}?${params}`, { headers: { Authorization: `KakaoAK ${restKey}` }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? "rate_limited" : "upstream_error" }, { status: 502 });
    const payload = await response.json() as { documents?: unknown[]; meta?: { total_count?: number } };
    const fetchedAt = new Date().toISOString();
    const places = dedupePlaces((payload.documents ?? []).filter((item) => isKakaoPlaceAllowed(item, category)).map((item) => kakaoPlaceToPlace(item, fetchedAt, category)).filter((item): item is NonNullable<typeof item> => Boolean(item)));
    const body = { places, fetchedAt, source: "kakao" as const, totalCount: Number(payload.meta?.total_count) || places.length };
    cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, body });
    return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
