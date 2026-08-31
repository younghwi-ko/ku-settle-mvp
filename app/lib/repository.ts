import type { User } from "@supabase/supabase-js";
import type { Locale } from "../i18n";
import type { MarketProduct } from "../data";
import { getSupabaseClient } from "./supabase";
import { marketplaceRowToProduct, normalizeKuEmail, productToMarketplaceInsert, toDbHousing, type MarketplaceRow, type ProfileRow, type StoredProfile } from "./domain";

function requiredClient() { const client = getSupabaseClient(); if (!client) throw new Error("Supabase is not configured"); return client; }

export async function sendEmailOtp(email: string, locale: Locale) {
  const normalized = normalizeKuEmail(email);
  const { error } = await requiredClient().auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: true, data: { preferred_language: locale }, emailRedirectTo: `${location.origin}/?lang=${encodeURIComponent(locale)}` } });
  if (error) throw error;
  return normalized;
}

export function validAccountPassword(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export async function signInWithPassword(email: string, password: string) {
  const normalized = normalizeKuEmail(email);
  if (!isKuEmailValue(normalized) || !password) throw new Error("invalid_credentials");
  const { data, error } = await requiredClient().auth.signInWithPassword({ email: normalized, password });
  if (error || !data.user) throw error ?? new Error("invalid_credentials");
  return data.user;
}

function isKuEmailValue(email: string) { return /^[^@\s]+@korea\.ac\.kr$/.test(email); }

export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await requiredClient().auth.verifyOtp({ email: normalizeKuEmail(email), token, type: "email" });
  if (error) throw error;
  return data.user;
}

export async function loadAccount(user: User) {
  const client = requiredClient();
  const [{ data: profile, error: profileError }, { data: progress, error: progressError }, { data: items, error: itemsError }] = await Promise.all([
    client.from("profiles").select("*").eq("user_id", user.id).single(),
    client.from("lifecycle_progress").select("task_id,completed").eq("user_id", user.id),
    client.from("marketplace_items").select("*").order("created_at", { ascending: false })
  ]);
  if (profileError) throw profileError; if (progressError) throw progressError; if (itemsError) throw itemsError;
  return { profile: profile as ProfileRow, done: (progress ?? []).filter((row) => row.completed).map((row) => row.task_id as string), products: (items as MarketplaceRow[]).filter((row) => row.status === "active" || row.status === "sold").map((row) => marketplaceRowToProduct(row, user.id)) };
}

export async function saveProfile(userId: string, profile: StoredProfile, locale: Locale) {
  const { data, error } = await requiredClient().from("profiles").update({ display_name: profile.name.trim(), preferred_language: locale, expected_arrival_date: profile.arrivalDate || null, housing_type: toDbHousing(profile.housing), onboarding_completed: true }).eq("user_id", userId).select("*").single();
  if (error) throw error;
  await requiredClient().auth.updateUser({ data: { preferred_language: locale } });
  return data as ProfileRow;
}

export async function saveProgress(userId: string, taskId: string, completed: boolean) {
  const { error } = await requiredClient().from("lifecycle_progress").upsert({ user_id: userId, task_id: taskId, completed }, { onConflict: "user_id,task_id" });
  if (error) throw error;
}

export async function createMarketplaceItem(product: MarketProduct, userId: string, sellerName: string, guestSourceId?: string) {
  const { data, error } = await requiredClient().from("marketplace_items").insert(productToMarketplaceInsert(product, userId, sellerName, guestSourceId)).select("*").single();
  if (error) throw error;
  return marketplaceRowToProduct(data as MarketplaceRow, userId);
}

export async function updateMarketplaceItemStatus(itemId: string, status: "active" | "sold" | "hidden" | "deleted", userId: string) {
  const { data, error } = await requiredClient().from("marketplace_items").update({ status }).eq("id", itemId).eq("seller_id", userId).select("*").single();
  if (error) throw error;
  return marketplaceRowToProduct(data as MarketplaceRow, userId);
}

export async function importGuestData(userId: string, serverProfile: ProfileRow, profile: StoredProfile, done: string[], products: MarketProduct[], allowedTaskIds: string[], locale: Locale) {
  const client = requiredClient();
  if (!serverProfile.onboarding_completed) await saveProfile(userId, profile, locale);
  const validDone = [...new Set(done.filter((id) => allowedTaskIds.includes(id)))];
  if (validDone.length) {
    const { error } = await client.from("lifecycle_progress").upsert(validDone.map((taskId) => ({ user_id: userId, task_id: taskId, completed: true })), { onConflict: "user_id,task_id" });
    if (error) throw error;
  }
  const imported: string[] = [];
  for (const product of products) {
    const sourceId = `legacy:${String(product.id)}`;
    const { error } = await client.from("marketplace_items").upsert(productToMarketplaceInsert(product, userId, profile.name, sourceId), { onConflict: "seller_id,guest_source_id", ignoreDuplicates: true });
    if (error) throw Object.assign(error, { imported });
    imported.push(String(product.id));
  }
  const { error } = await client.from("profiles").update({ guest_data_imported_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw Object.assign(error, { imported });
  return imported;
}

export async function signOut() { const { error } = await requiredClient().auth.signOut(); if (error) throw error; }
export async function deleteAccount() { const { data, error } = await requiredClient().functions.invoke("delete-account", { body: {} }); if (error) throw error; return data; }
