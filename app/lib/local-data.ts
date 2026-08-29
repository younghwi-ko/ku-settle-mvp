import type { LifecycleStage, MarketProduct } from "../data";
import type { StoredProfile } from "./domain";

export const LOCAL_DATA_VERSION = 4;
export type PersonalTask = { id: string; title: string; stage: LifecycleStage; dueDate: string; note: string; completed: boolean };
export type MarketplaceReview = { productId: string; rating: number; text: string; createdAt: string };
export type ReportDraft = { productId: string; reason: string; status: "new" | "reviewed" | "resolved"; createdAt: string };
export type LocalPreferences = { dueDates: Record<string, string>; notes: Record<string, string>; important: string[]; hiddenCompleted: boolean; customTasks: PersonalTask[]; guideFavorites: string[]; placeFavorites: number[]; reports: Record<string, string>; reservedProductIds: string[]; favoriteProductIds: string[]; reviews: MarketplaceReview[]; inquiryDrafts: Record<string, string>; reportDrafts: ReportDraft[]; progressHistory: { date: string; progress: number }[] };
export type LocalData = { version: number; profile: StoredProfile | null; done: string[]; products: MarketProduct[]; verified: boolean; preferences: LocalPreferences };

export const emptyPreferences = (): LocalPreferences => ({ dueDates: {}, notes: {}, important: [], hiddenCompleted: false, customTasks: [], guideFavorites: [], placeFavorites: [], reports: {}, reservedProductIds: [], favoriteProductIds: [], reviews: [], inquiryDrafts: {}, reportDrafts: [], progressHistory: [] });
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const stringRecord = (value: unknown): Record<string, string> => { const result: Record<string, string> = {}; for (const [key, item] of Object.entries(asRecord(value))) if (typeof item === "string") result[key] = item; return result; };

export function migrateLocalData(raw: unknown): LocalData {
  const source = asRecord(raw);
  const preferences = asRecord(source.preferences);
  const customTasks = Array.isArray(preferences.customTasks) ? preferences.customTasks.filter((item): item is PersonalTask => {
    const x = asRecord(item); return typeof x.id === "string" && typeof x.title === "string" && typeof x.stage === "string" && typeof x.dueDate === "string" && typeof x.note === "string" && typeof x.completed === "boolean";
  }) : [];
  return { version: LOCAL_DATA_VERSION, profile: source.profile as StoredProfile | null ?? null, done: strings(source.done), products: Array.isArray(source.products) ? source.products as MarketProduct[] : [], verified: source.verified === true, preferences: {
    dueDates: stringRecord(preferences.dueDates),
    notes: stringRecord(preferences.notes),
    important: strings(preferences.important), hiddenCompleted: preferences.hiddenCompleted === true, customTasks,
    guideFavorites: strings(preferences.guideFavorites), placeFavorites: Array.isArray(preferences.placeFavorites) ? preferences.placeFavorites.filter((x): x is number => typeof x === "number") : [],
    reports: stringRecord(preferences.reports), reservedProductIds: strings(preferences.reservedProductIds), favoriteProductIds: strings(preferences.favoriteProductIds),
    reviews: Array.isArray(preferences.reviews) ? preferences.reviews.filter((item): item is MarketplaceReview => { const x = asRecord(item); return typeof x.productId === "string" && typeof x.rating === "number" && typeof x.text === "string" && typeof x.createdAt === "string"; }) : [],
    inquiryDrafts: stringRecord(preferences.inquiryDrafts),
    reportDrafts: Array.isArray(preferences.reportDrafts) ? preferences.reportDrafts.filter((item): item is ReportDraft => { const x = asRecord(item); return typeof x.productId === "string" && typeof x.reason === "string" && (x.status === "new" || x.status === "reviewed" || x.status === "resolved") && typeof x.createdAt === "string"; }) : [],
    progressHistory: Array.isArray(preferences.progressHistory) ? preferences.progressHistory.filter((item): item is { date: string; progress: number } => { const x = asRecord(item); return typeof x.date === "string" && typeof x.progress === "number"; }) : []
  } };
}

export function readLocalData(storage: Storage, keys: { profile: string; checklist: string; verified: string; userProducts: string; data: string }): LocalData {
  try {
    const bundled = storage.getItem(keys.data); if (bundled) return migrateLocalData(JSON.parse(bundled));
    return migrateLocalData({ profile: JSON.parse(storage.getItem(keys.profile) || "null"), done: JSON.parse(storage.getItem(keys.checklist) || "[]"), verified: storage.getItem(keys.verified) === "true", products: JSON.parse(storage.getItem(keys.userProducts) || "[]") });
  } catch { return migrateLocalData(null); }
}

export function writeLocalData(storage: Storage, key: string, data: LocalData) { storage.setItem(key, JSON.stringify({ ...data, version: LOCAL_DATA_VERSION })); }
export function isStaleVerification(lastVerifiedAt: string | undefined, now = new Date(), maxAgeDays = 180) {
  if (!lastVerifiedAt) return true;
  const verifiedAt = Date.parse(lastVerifiedAt);
  if (Number.isNaN(verifiedAt)) return true;
  return now.getTime() - verifiedAt > maxAgeDays * 24 * 60 * 60 * 1000;
}
