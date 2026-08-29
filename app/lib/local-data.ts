import type { LifecycleStage, MarketProduct, Place } from "../data";
import type { StoredProfile } from "./domain";

export const LOCAL_DATA_VERSION = 8;
export type PersonalTask = { id: string; title: string; stage: LifecycleStage; dueDate: string; note: string; completed: boolean };
export type LocalReservation = { id: string; productId: string; buyerName: string; status: "active" | "cancelled" | "completed"; createdAt: string; pickupDate: string; pickupStartTime: string; pickupEndTime: string; cancelledAt?: string; completedAt?: string; updatedAt?: string };
export type MarketplaceReview = { productId: string; rating: number; text: string; createdAt: string };
export type ReportDraft = { productId: string; reason: string; detail?: string; status: "new" | "reviewed" | "resolved"; createdAt: string };
export type GuideMetadata = { contentCheckedAt: string; contentOrigin: "official-guide" | "demo"; sourceStatus: "verified" | "needs_confirmation" | "unavailable"; officialUrl?: string; officialUrls?: Partial<Record<"en" | "ko" | "ja" | "zh-CN", string>>; sourceName?: string };
export type LocalPlaceOverride = Partial<Pick<Place, "category" | "address" | "phone" | "hours" | "closedDays" | "officialUrl" | "mapUrl" | "sourceName" | "lastVerifiedAt" | "verificationStatus" | "languageSupport" | "coordinates" | "halalStatus" | "veganStatus" | "operatingStatus" | "venueType" | "usageConditions" | "visitBeforeConfirm">> & { id: number };
export type ServiceRequestMode = "pickup" | "delivery" | "storage" | "sale" | "donation" | "disposal";
export type ServiceRequestStatus = "not-selected" | "method-selected" | "consultation-ready" | "quote-viewed" | "application-ready" | "in-progress" | "completed" | "cancelled";
export type LocalServiceRequest = { id: string; productId?: string; taskId?: string; mode: ServiceRequestMode; status: ServiceRequestStatus; storageDuration?: "7" | "30" | "90"; storageLocation?: "campus" | "partner"; updatedAt: string };
export type LocalPreferences = { dueDates: Record<string, string>; notes: Record<string, string>; important: string[]; hiddenCompleted: boolean; customTasks: PersonalTask[]; guideFavorites: string[]; placeFavorites: number[]; placeOverrides: Record<string, LocalPlaceOverride>; customPlaces: Place[]; deletedPlaceIds: number[]; reports: Record<string, string>; reservedProductIds: string[]; reservations: LocalReservation[]; favoriteProductIds: string[]; reviews: MarketplaceReview[]; inquiryDrafts: Record<string, string>; reportDrafts: ReportDraft[]; progressHistory: { date: string; progress: number }[]; guideMetadata: Record<string, GuideMetadata>; serviceRequests: LocalServiceRequest[] };
export type LocalData = { version: number; profile: StoredProfile | null; done: string[]; products: MarketProduct[]; verified: boolean; preferences: LocalPreferences };

export const emptyPreferences = (): LocalPreferences => ({ dueDates: {}, notes: {}, important: [], hiddenCompleted: false, customTasks: [], guideFavorites: [], placeFavorites: [], placeOverrides: {}, customPlaces: [], deletedPlaceIds: [], reports: {}, reservedProductIds: [], reservations: [], favoriteProductIds: [], reviews: [], inquiryDrafts: {}, reportDrafts: [], progressHistory: [], guideMetadata: {}, serviceRequests: [] });
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const stringRecord = (value: unknown): Record<string, string> => { const result: Record<string, string> = {}; for (const [key, item] of Object.entries(asRecord(value))) if (typeof item === "string") result[key] = item; return result; };
const validImage = (value: unknown) => value === undefined || (typeof value === "string" && (!value || /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) && value.length <= 3_000_000);
const validProducts = (value: unknown): MarketProduct[] => Array.isArray(value) ? value.filter((item): item is MarketProduct => { const x = asRecord(item); return (typeof x.id === "string" || typeof x.id === "number") && typeof x.priceKrw === "number" && Number.isFinite(x.priceKrw) && x.priceKrw > 0 && typeof x.category === "string" && typeof x.condition === "string" && (x.status === "Available" || x.status === "Reserved") && typeof x.icon === "string" && validImage(x.imageDataUrl); }) : [];

export function migrateLocalData(raw: unknown): LocalData {
  const source = asRecord(raw);
  const preferences = asRecord(source.preferences);
  const customTasks = Array.isArray(preferences.customTasks) ? preferences.customTasks.filter((item): item is PersonalTask => {
    const x = asRecord(item); return typeof x.id === "string" && typeof x.title === "string" && typeof x.stage === "string" && typeof x.dueDate === "string" && typeof x.note === "string" && typeof x.completed === "boolean";
  }) : [];
  const reservations = Array.isArray(preferences.reservations) ? preferences.reservations.filter((item): item is LocalReservation => { const x = asRecord(item); return typeof x.id === "string" && typeof x.productId === "string" && typeof x.buyerName === "string" && (x.status === "active" || x.status === "cancelled" || x.status === "completed") && typeof x.createdAt === "string"; }).map((item) => ({ ...item, pickupDate: item.pickupDate ?? "", pickupStartTime: item.pickupStartTime ?? "", pickupEndTime: item.pickupEndTime ?? "" })) : [];
  const reservedProductIds = [...new Set([...strings(preferences.reservedProductIds), ...reservations.filter((item) => item.status === "active").map((item) => item.productId)])];
  const serviceRequests = Array.isArray(preferences.serviceRequests) ? preferences.serviceRequests.filter((item): item is LocalServiceRequest => { const x = asRecord(item); return typeof x.id === "string" && (x.productId === undefined || typeof x.productId === "string") && (x.taskId === undefined || typeof x.taskId === "string") && ["pickup", "delivery", "storage", "sale", "donation", "disposal"].includes(String(x.mode)) && ["not-selected", "method-selected", "consultation-ready", "quote-viewed", "application-ready", "in-progress", "completed", "cancelled"].includes(String(x.status)) && typeof x.updatedAt === "string" && (x.storageDuration === undefined || ["7", "30", "90"].includes(String(x.storageDuration))) && (x.storageLocation === undefined || ["campus", "partner"].includes(String(x.storageLocation))); }) : [];
  return { version: LOCAL_DATA_VERSION, profile: source.profile as StoredProfile | null ?? null, done: strings(source.done), products: validProducts(source.products), verified: source.verified === true, preferences: {
    dueDates: stringRecord(preferences.dueDates),
    notes: stringRecord(preferences.notes),
    important: strings(preferences.important), hiddenCompleted: preferences.hiddenCompleted === true, customTasks,
    guideFavorites: strings(preferences.guideFavorites), placeFavorites: Array.isArray(preferences.placeFavorites) ? preferences.placeFavorites.filter((x): x is number => typeof x === "number") : [],
    placeOverrides: Object.fromEntries(Object.entries(asRecord(preferences.placeOverrides)).flatMap(([id, value]) => { const x = asRecord(value); return typeof x.id === "number" ? [[id, { ...x, id: x.id } as LocalPlaceOverride]] : []; })),
    customPlaces: Array.isArray(preferences.customPlaces) ? preferences.customPlaces.filter((item): item is Place => { const x = asRecord(item); return typeof x.id === "number" && typeof x.nameKey === "string" && typeof x.category === "string" && typeof x.locationKey === "string" && typeof x.descriptionKey === "string" && typeof x.tipKey === "string" && typeof x.distanceMeters === "number" && typeof x.displayName === "string"; }) : [],
    deletedPlaceIds: Array.isArray(preferences.deletedPlaceIds) ? preferences.deletedPlaceIds.filter((x): x is number => typeof x === "number") : [],
    reports: stringRecord(preferences.reports), reservedProductIds, reservations, favoriteProductIds: strings(preferences.favoriteProductIds),
    reviews: Array.isArray(preferences.reviews) ? preferences.reviews.filter((item): item is MarketplaceReview => { const x = asRecord(item); return typeof x.productId === "string" && typeof x.rating === "number" && typeof x.text === "string" && typeof x.createdAt === "string"; }) : [],
    inquiryDrafts: stringRecord(preferences.inquiryDrafts),
    reportDrafts: Array.isArray(preferences.reportDrafts) ? preferences.reportDrafts.filter((item): item is ReportDraft => { const x = asRecord(item); return typeof x.productId === "string" && typeof x.reason === "string" && (x.status === "new" || x.status === "reviewed" || x.status === "resolved") && typeof x.createdAt === "string" && (x.detail === undefined || typeof x.detail === "string"); }).map((item) => ({ ...item, detail: item.detail ?? "" })) : [],
    progressHistory: Array.isArray(preferences.progressHistory) ? preferences.progressHistory.filter((item): item is { date: string; progress: number } => { const x = asRecord(item); return typeof x.date === "string" && typeof x.progress === "number"; }) : [],
    guideMetadata: Object.fromEntries(Object.entries(asRecord(preferences.guideMetadata)).flatMap(([id, value]) => { const x = asRecord(value); const sourceStatus = x.sourceStatus; const contentOrigin = x.contentOrigin === "demo" ? "demo" : "official-guide"; if (typeof x.contentCheckedAt !== "string" || !["verified", "needs_confirmation", "unavailable"].includes(String(sourceStatus))) return []; const officialUrls = Object.fromEntries(Object.entries(asRecord(x.officialUrls)).filter(([, url]) => typeof url === "string")) as GuideMetadata["officialUrls"]; return [[id, { contentCheckedAt: x.contentCheckedAt, contentOrigin, sourceStatus: sourceStatus as GuideMetadata["sourceStatus"], officialUrl: typeof x.officialUrl === "string" ? x.officialUrl : undefined, officialUrls, sourceName: typeof x.sourceName === "string" ? x.sourceName : undefined } satisfies GuideMetadata]]; })),
    serviceRequests
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
