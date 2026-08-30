import { NextResponse } from "next/server";
import { apiError } from "@/app/lib/server-api";
import { getOrCreateServerSession, serverClient } from "@/app/lib/server-session";

export async function POST() {
  if (!serverClient()) return apiError("server_storage_not_configured", 503);
  try {
    const session = await getOrCreateServerSession();
    if (!session) return apiError("server_storage_not_configured", 503);
    return NextResponse.json({ sessionId: session.id, persistent: true });
  } catch { return apiError("session_unavailable", 503); }
}
