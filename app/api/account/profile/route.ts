import { NextResponse } from "next/server";
import { apiError, jsonBody, record, text } from "@/app/lib/server-api";
import { authenticatedPrincipal, requireSameOrigin, serverClient } from "@/app/lib/server-session";

const locales = new Set(["en", "ko", "ja", "zh-CN"]);

export async function PUT(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const principal = await authenticatedPrincipal(request);
  if (!principal) return apiError("account_required", 401);
  const body = await jsonBody(request);
  if (!record(body)) return apiError("invalid_profile", 422);
  const name = text(body.name, 80);
  const arrivalDate = typeof body.arrivalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.arrivalDate) ? body.arrivalDate : null;
  const housing = body.housing === "off-campus" ? "off_campus" : body.housing === "dorm" ? "dormitory" : null;
  const locale = typeof body.locale === "string" && locales.has(body.locale) ? body.locale : "en";
  if (!name || !arrivalDate || !housing) return apiError("invalid_profile", 422);
  const client = serverClient();
  if (!client) return apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("profiles").update({ display_name: name, preferred_language: locale, expected_arrival_date: arrivalDate, housing_type: housing, onboarding_completed: true }).eq("user_id", principal.userId).select("*").single();
  if (error) return apiError("profile_save_failed", 502);
  return NextResponse.json({ profile: data }, { headers: { "Cache-Control": "no-store" } });
}
