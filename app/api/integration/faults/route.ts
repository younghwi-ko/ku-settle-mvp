import { NextResponse } from "next/server";
import { apiError, jsonBody, record, text } from "@/app/lib/server-api";
import { armSupportRefetchFailure, integrationModeEnabled } from "@/app/lib/integration-fault";
import { getOrCreateServerSession, requireSameOrigin } from "@/app/lib/server-session";

export async function POST(request: Request) {
  if (!integrationModeEnabled()) return apiError("not_available", 404);
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const expected = process.env.INTEGRATION_TEST_SECRET;
  const supplied = request.headers.get("x-integration-test-secret") ?? "";
  if (!expected || supplied !== expected) return apiError("integration_forbidden", 403);
  const body = await jsonBody(request);
  const fault = record(body) ? text(body.fault, 40) : null;
  if (fault !== "support_refetch") return apiError("invalid_fault", 422);
  const session = await getOrCreateServerSession();
  if (!session || !armSupportRefetchFailure(session.id)) return apiError("session_unavailable", 503);
  return NextResponse.json({ armed: true }, { headers: { "Cache-Control": "no-store" } });
}
