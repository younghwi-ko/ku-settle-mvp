import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { accountSignupEnabled, requireSameOrigin } from "@/app/lib/server-session";

// This endpoint deliberately does not create users until a production SMTP
// provider is configured. It prevents the feature flag from being only a UI
// convention and gives a future sign-up implementation one guarded entrypoint.
export async function POST(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  if (!accountSignupEnabled()) return NextResponse.json({ error: "email_verification_preparing" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ error: "signup_provider_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
