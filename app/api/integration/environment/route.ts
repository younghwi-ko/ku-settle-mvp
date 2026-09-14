import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { integrationModeEnabled } from "@/app/lib/integration-fault";

export function projectRefFromUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "" && url.pathname !== "/")) return null;
    const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    if (match && (url.protocol !== "https:" || url.port)) return null;
    return match?.[1] ?? null;
  } catch { return null; }
}

function isAllowedLocalUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.port === "54321" && !url.username && !url.password && !url.search && !url.hash && (url.pathname === "" || url.pathname === "/");
  } catch { return false; }
}

export async function GET() {
  if (!integrationModeEnabled()) return apiError("not_available", 404);
  const configuredRef = process.env.INTEGRATION_SUPABASE_PROJECT_REF?.trim();
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredRef || !configuredUrl) return apiError("integration_environment_unverified", 503);
  const urlRef = projectRefFromUrl(configuredUrl);
  if (!urlRef && !isAllowedLocalUrl(configuredUrl)) return apiError("integration_environment_unverified", 503);
  if (urlRef && urlRef !== configuredRef) return apiError("integration_environment_mismatch", 503);
  return NextResponse.json({ isolated: true, projectRef: configuredRef }, { headers: { "Cache-Control": "no-store" } });
}
