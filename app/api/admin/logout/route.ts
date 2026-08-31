import { NextResponse } from "next/server";
import { clearAdminSession } from "@/app/lib/server-session";

export async function POST() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
