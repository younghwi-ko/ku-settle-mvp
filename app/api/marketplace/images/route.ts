import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";

const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
function decode(value: unknown) { if (typeof value !== "string") return null; const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value); if (!match) return null; const bytes = Buffer.from(match[2], "base64"); return bytes.length > 0 && bytes.length <= 5 * 1024 * 1024 && allowed.has(match[1]) ? { mime: match[1], bytes } : null; }

export async function POST(request: Request) { if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403); const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503); const body = await jsonBody(request); const image = record(body) ? decode(body.imageDataUrl) : null; if (!image) return apiError("invalid_marketplace_image", 422); const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503); const extension = allowed.get(image.mime)!; const path = `${session.id}/${randomUUID()}.${extension}`; const { error } = await client.storage.from("marketplace-images").upload(path, image.bytes, { contentType: image.mime, upsert: false, cacheControl: "31536000" }); return error ? apiError("image_upload_failed", 502) : NextResponse.json({ imagePath: path }, { status: 201, headers: { "Cache-Control": "no-store" } }); }
