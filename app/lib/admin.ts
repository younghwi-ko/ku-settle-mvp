import { NextResponse } from "next/server";
import { apiError, jsonBody, record, text } from "./server-api";
import { checkAdminRateLimit, isAdminRequest, requireSameOrigin, serverClient } from "./server-session";

export async function requireAdmin(request: Request, mutation = false) {
  const limit = checkAdminRateLimit(request, "api");
  if (!limit.allowed) return { client: null, response: NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } }) } as const;
  if (mutation && !await requireSameOrigin(request)) return { client: null, response: apiError("invalid_origin", 403) } as const;
  if (!await isAdminRequest()) return { client: null, response: apiError("admin_required", 401) } as const;
  const client = serverClient();
  return client ? { client, response: null } as const : { client: null, response: apiError("server_storage_not_configured", 503) } as const;
}

export async function adminBody(request: Request) {
  const body = await jsonBody(request);
  return record(body) ? body : null;
}

export function adminText(value: unknown, max: number, required = false) {
  if (value === undefined || value === null || value === "") return required ? null : null;
  return text(value, max);
}

export async function audit(client: NonNullable<ReturnType<typeof serverClient>>, resourceType: string, resourceKey: string, action: string, reason?: string | null) {
  await client.from("admin_audit_log").insert({ actor: "admin", resource_type: resourceType, resource_key: resourceKey, action, reason: reason ? reason.slice(0, 500) : null });
}

export function versionOf(value: unknown) { return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null; }
export function deletedMeta(body: Record<string, unknown>) { return { reason: adminText(body.deletionReason, 500) }; }
export function ok(data: Record<string, unknown>) { return NextResponse.json(data); }
