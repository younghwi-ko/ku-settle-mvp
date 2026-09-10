import { NextResponse } from "next/server";
import { accountSignupEnabled } from "@/app/lib/server-session";

export async function GET() { return NextResponse.json({ signupEnabled: accountSignupEnabled(), passwordAuthEnabled: false, emailDeliveryEnabled: process.env.EMAIL_DELIVERY_ENABLED === "true" }, { headers: { "Cache-Control": "no-store" } }); }
