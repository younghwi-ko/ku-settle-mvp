import { NextResponse } from "next/server";
import { apiError, jsonBody, record, sessionOrError } from "@/app/lib/server-api";
import { requireSameOrigin, serverClient } from "@/app/lib/server-session";

export async function PUT(request: Request) {
  if (!await requireSameOrigin(request)) return apiError("invalid_origin", 403);
  const { session, response } = await sessionOrError(); if (response || !session) return response ?? apiError("session_unavailable", 503);
  const body = await jsonBody(request); const values = record(body) ? body : {};
  const taskId = typeof values.taskId === "string" ? values.taskId : "";
  if (!/^[a-z0-9-]{2,80}$/.test(taskId) || typeof values.completed !== "boolean") return apiError("invalid_progress", 422);
  const client = serverClient(); if (!client) return apiError("server_storage_not_configured", 503);
  const { data, error } = await client.from("guest_lifecycle_progress").upsert({ session_id: session.id, task_id: taskId, completed: values.completed, version: 1, updated_at: new Date().toISOString() }, { onConflict: "session_id,task_id" }).select("*").single();
  return error ? apiError("progress_save_failed", 502) : NextResponse.json({ progress: data });
}
