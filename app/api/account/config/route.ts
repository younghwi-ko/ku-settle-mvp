import { NextResponse } from "next/server";
import { accountSignupEnabled } from "@/app/lib/server-session";

export async function GET() { return NextResponse.json({ signupEnabled: accountSignupEnabled(), passwordAuthEnabled: true, emailDeliveryEnabled: false }, { headers: { "Cache-Control": "no-store" } }); }
