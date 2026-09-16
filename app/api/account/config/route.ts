import { NextResponse } from "next/server";
import { accountSignupEnabled, emailDeliveryStatus } from "@/app/lib/server-session";

export async function GET() {
  const email = emailDeliveryStatus();
  return NextResponse.json({
    signupEnabled: accountSignupEnabled(),
    passwordAuthEnabled: false,
    emailDeliveryEnabled: email.enabled,
    emailDeliveryReason: email.reason
  }, { headers: { "Cache-Control": "no-store" } });
}
