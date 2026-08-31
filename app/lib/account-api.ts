"use client";

import { getSupabaseClient } from "./supabase";

async function authHeaders(): Promise<Headers> {
  const client = getSupabaseClient();
  const { data } = await client?.auth.getSession() ?? { data: { session: null } };
  const result = new Headers({ "content-type": "application/json" });
  if (data.session?.access_token) result.set("authorization", `Bearer ${data.session.access_token}`);
  return result;
}

export async function accountFetch(path: string, init: RequestInit = {}) {
  const merged = await authHeaders(); new Headers(init.headers).forEach((value, key) => merged.set(key, value));
  const response = await fetch(path, { ...init, credentials: "include", headers: merged });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : "account_request_failed");
  }
  return response.json() as Promise<Record<string, unknown>>;
}
