import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifySession(client: SupabaseClient, sessionId: string, type: string, title: string, body: string, resourceType?: string, resourceKey?: string) {
  await client.from("user_notifications").insert({ session_id: sessionId, type, title: title.slice(0, 160), body: body.slice(0, 1000), resource_type: resourceType ?? null, resource_key: resourceKey ?? null });
}

// Intentionally a no-op until a real SMTP provider is configured. Keeping the
// boundary here means event producers do not need to change later.
export async function sendEmailNotification() { return { delivered: false, reason: "smtp_not_enabled" as const }; }
