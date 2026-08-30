import { NextResponse } from "next/server";
import { getOrCreateServerSession, serverClient, type ServerSession } from "./server-session";

export function apiError(code: string, status: number, details?: Record<string, unknown>) { return NextResponse.json({ error: code, ...details }, { status }); }
export async function sessionOrError() {
  if (!serverClient()) return { session: null, response: apiError("server_storage_not_configured", 503) } as const;
  try {
    const session = await getOrCreateServerSession();
    return session ? { session, response: null } as const : { session: null, response: apiError("server_storage_not_configured", 503) } as const;
  } catch { return { session: null, response: apiError("session_unavailable", 503) } as const; }
}
export async function jsonBody(request: Request) { try { return await request.json() as unknown; } catch { return null; } }
export function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
export function text(value: unknown, max: number) { return typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null; }
export function optionalText(value: unknown, max: number) { return value === undefined || value === null || value === "" ? null : text(value, max); }
export function uuid(value: unknown) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function validImage(value: unknown) { return value === null || value === undefined || (typeof value === "string" && value.length <= 1_500_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)); }
export function isSessionId(value: unknown, session: ServerSession) { return value === session.id; }
