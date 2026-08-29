"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import type { TFunction } from "i18next";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Banknote, BedDouble, Box, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleUserRound, Clock3, CookingPot, FileCheck2, GraduationCap, HeartPulse, Hospital, House, Languages, LampDesk,
  Lightbulb, MapPin, Menu, MessageCircle, PackageCheck, RotateCcw, Search, ShieldCheck, ShoppingBag, Sparkles, Store, BookOpen,
  Tag, Trash2, Utensils, Vegan, X, Zap
} from "lucide-react";
import {
  lifecycleStages, places, products, tasks, lifeGuideArticles, type LifecycleStage, type MarketProduct, type PlaceCategory,
  type ProductCategory, type ProductCondition, type ProductIcon, type ProductStatus, type Task, type TaskAction,
  type TranslationKey
} from "./data";
import { expandedLifeGuideArticles, getGuideLocaleCopy } from "./guide-content";
import {
  formatCurrency, formatDate, formatDistance, formatNumber, formatPercent, localeNames, supportedLocales,
  useAppI18n, type Locale
} from "./i18n";
import { getSupabaseClient, isSupabaseConfigured } from "./lib/supabase";
import { createMarketplaceItem, deleteAccount, importGuestData, loadAccount, saveProfile, saveProgress, sendEmailOtp, signOut, updateMarketplaceItemStatus } from "./lib/repository";
import { googleMapsDirectionsUrl, googleMapsSearchUrl, isKuEmail, isOwnedMarketplaceProduct, isPickupPast, isValidImageDataUrl, isValidPickupSchedule, mapServiceError, profileRowToStored, validateMarketplaceInput, type AppMode, type ProfileRow, type StoredProfile } from "./lib/domain";
import { shouldShowVerifiedBadge } from "./lib/verification";
import { emptyPreferences, migrateLocalData, readLocalData, writeLocalData, type LocalPreferences, type LocalReservation, type ReportDraft } from "./lib/local-data";
import KakaoMap from "./components/kakao-map";
import { dedupePlaces, type KakaoSearchResponse } from "./lib/kakao";

type Page = "home" | "onboarding" | "marketplace" | "guide" | "life-guide" | "admin";
type Housing = "dorm" | "off-campus";
type UserProfile = StoredProfile;
type MarketMode = "incoming" | "leaving";
type ProductModalMode = "buyer" | "seller";
type PickupSchedule = Pick<LocalReservation, "pickupDate" | "pickupStartTime" | "pickupEndTime">;
type PendingReservation = { product: MarketProduct; reservation?: LocalReservation };
type ReportReason = "false_info" | "price_mismatch" | "scam" | "inappropriate" | "schedule_issue" | "other";
type StageStat = { stage: (typeof lifecycleStages)[number]; completed: number; total: number; progress: number };
type NavigationIntent = { stage?: LifecycleStage; taskId?: string; highlight?: boolean; marketMode?: MarketMode; guideCategory?: string };

const storageKeys = {
  language: "ku-settle-language",
  checklist: "ku-settle-checklist",
  verified: "ku-settle-verified",
  profile: "ku-settle-profile",
  userProducts: "ku-settle-user-products"
  , importState: "ku-settle-guest-import-state", data: "ku-settle-local-data-v6"
} as const;
const demoProfile: UserProfile = { name: "Alex", arrivalDate: "", housing: "dorm", mode: "demo" };
const demoDone = ["housing-reserve", "sim-compare", "airport-route", "arrival-essentials", "dorm", "account", "courses"];
const productCategories: ProductCategory[] = ["Home", "Kitchen", "Electronics", "Bedding"];
const productConditions: ProductCondition[] = ["likeNew", "good", "used", "clean"];
const productIcons: Record<ProductIcon, typeof Box> = { cooking: CookingPot, lamp: LampDesk, bed: BedDouble, kettle: Zap, fan: Sparkles, box: Box };
const categoryIcons: Partial<Record<PlaceCategory, typeof Hospital>> = { Hospital, Halal: Utensils, Vegan, Pharmacy: HeartPulse, Cafe: Store, Grocery: ShoppingBag, Food: Utensils };
const categoryProductIcons: Record<ProductCategory, ProductIcon> = { Home: "box", Kitchen: "cooking", Electronics: "fan", Bedding: "bed" };

function tr(t: TFunction, key: string, options?: Record<string, unknown>) {
  return String(t(key.replace(/^marketplace\./, "marketplace:"), options));
}
function ui(locale: Locale, key: string) { const copy: Record<string, Record<Locale, string>> = { due: { en: "Due date", ko: "예정일", ja: "予定日", "zh-CN": "预定日期" }, note: { en: "Note", ko: "메모", ja: "メモ", "zh-CN": "备注" }, important: { en: "Important", ko: "중요", ja: "重要", "zh-CN": "重要" }, personal: { en: "Personal task", ko: "개인 작업", ja: "個人タスク", "zh-CN": "个人任务" }, add: { en: "Add personal task", ko: "개인 작업 추가", ja: "個人タスクを追加", "zh-CN": "添加个人任务" }, delete: { en: "Delete", ko: "삭제", ja: "削除", "zh-CN": "删除" }, hide: { en: "Hide completed", ko: "완료 작업 숨기기", ja: "完了済みを隠す", "zh-CN": "隐藏已完成" }, show: { en: "Show completed", ko: "완료 작업 보기", ja: "完了済みを表示", "zh-CN": "显示已完成" }, allDates: { en: "All dates", ko: "전체 날짜", ja: "すべての日付", "zh-CN": "所有日期" }, today: { en: "Today", ko: "오늘", ja: "今日", "zh-CN": "今天" }, week: { en: "This week", ko: "이번 주", ja: "今週", "zh-CN": "本周" }, none: { en: "No date", ko: "예정 없음", ja: "予定なし", "zh-CN": "无日期" } }; return copy[key]?.[locale] ?? key; }
function guideUi(locale: Locale, key: string) { const copy: Record<string, Record<Locale, string>> = {
  checklist: { en: "Preparation", ko: "준비물", ja: "準備するもの", "zh-CN": "准备事项" }, steps: { en: "Steps", ko: "진행 순서", ja: "進め方", "zh-CN": "步骤" }, cautions: { en: "Cautions", ko: "주의사항", ja: "注意事項", "zh-CN": "注意事项" }, duration: { en: "Estimated time", ko: "예상 소요시간", ja: "所要時間", "zh-CN": "预计用时" }, officialOrigin: { en: "Official-source guide", ko: "공식 출처 기반 안내", ja: "公式出典に基づく案内", "zh-CN": "基于官方来源的指南" }, demoOrigin: { en: "Demo content", ko: "데모 콘텐츠", ja: "デモコンテンツ", "zh-CN": "演示内容" }, sourceVerified: { en: "Verified source", ko: "확인된 공식 출처", ja: "確認済みの公式出典", "zh-CN": "已确认的官方来源" }, sourceUnavailable: { en: "No official source available", ko: "공식 출처 없음", ja: "公式出典なし", "zh-CN": "暂无官方来源" }, sourceNeedsConfirmation: { en: "Official source needs confirmation", ko: "공식 출처 확인 필요", ja: "公式出典の確認が必要", "zh-CN": "需要确认官方来源" }, officialSource: { en: "Open official source", ko: "공식 출처 열기", ja: "公式出典を開く", "zh-CN": "打开官方来源" }, sourceName: { en: "Source name", ko: "출처명", ja: "出典名", "zh-CN": "来源名称" }, sourceUrl: { en: "Official URL", ko: "공식 URL", ja: "公式URL", "zh-CN": "官方URL" }, checked: { en: "Content checked", ko: "콘텐츠 확인일", ja: "コンテンツ確認日", "zh-CN": "内容确认日期" }, checkedNote: { en: "This is the content review date, not an official update date.", ko: "콘텐츠를 점검한 날짜이며 공식 정보 갱신일과 다를 수 있습니다.", ja: "コンテンツの確認日であり、公式情報の更新日とは異なる場合があります。", "zh-CN": "这是内容检查日期，可能不同于官方信息更新日期。" }, changing: { en: "Administrative, healthcare, finance, and telecom conditions may change. Check the latest official notice.", ko: "행정·의료·금융·통신 조건은 바뀔 수 있으므로 최신 공식 안내를 확인하세요.", ja: "行政・医療・金融・通信の条件は変わることがあるため、最新の公式案内を確認してください。", "zh-CN": "行政、医疗、金融和通信条件可能变化，请确认最新官方通知。" }
}; return copy[key]?.[locale] ?? key; }

function guideDuration(locale: Locale, min: number, max: number) {
  const unit = locale === "ko" ? "분" : locale === "ja" ? "分" : locale === "zh-CN" ? "分钟" : " min";
  return `${min}–${max}${unit}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyBilingual(value: unknown): value is { en: string; ko: string } {
  return isRecord(value) && typeof value.en === "string" && typeof value.ko === "string";
}

function normalizeProfile(value: unknown): UserProfile | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.arrivalDate !== "string") return null;
  if (value.housing !== "dorm" && value.housing !== "off-campus") return null;
  if (value.mode !== "personalized" && value.mode !== "demo") return null;
  const name = value.name.trim();
  return name ? { name, arrivalDate: value.arrivalDate, housing: value.housing, mode: value.mode } : null;
}

function getActiveTasks(housing: Housing) {
  const excluded = new Set(housing === "dorm" ? ["residence", "move-out"] : ["dorm", "dorm-checkout"]);
  return tasks.filter((task) => !excluded.has(task.id));
}

function normalizeDone(value: unknown, activeTasks: Task[], fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const allowed = new Set(activeTasks.map((task) => task.id));
  return [...new Set(value.filter((id): id is string => typeof id === "string" && allowed.has(id)))];
}

function conditionFromLegacy(value: string): ProductCondition {
  const normalized = value.toLowerCase();
  if (normalized.includes("like") || normalized.includes("새")) return "likeNew";
  if (normalized.includes("clean") || normalized.includes("세탁")) return "clean";
  if (normalized.includes("used") || normalized.includes("사용")) return "used";
  return "good";
}

function normalizeUserProducts(value: unknown): MarketProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || (typeof item.id !== "string" && typeof item.id !== "number")) return [];
    if (!productCategories.includes(item.category as ProductCategory) || !Object.hasOwn(productIcons, String(item.icon))) return [];
    if (item.status !== "Available" && item.status !== "Reserved") return [];
    const category = item.category as ProductCategory;
    const icon = item.icon as ProductIcon;
    const status = item.status as ProductStatus;

    if (typeof item.name === "string" && typeof item.pickup === "string" && typeof item.priceKrw === "number" && item.priceKrw > 0 && productConditions.includes(item.condition as ProductCondition)) {
      return [{ id: item.id, name: item.name, pickup: item.pickup, priceKrw: Math.round(item.priceKrw), category, condition: item.condition as ProductCondition, status, icon, userCreated: true, ownedByCurrentUser: true }];
    }

    if (isLegacyBilingual(item.name) && isLegacyBilingual(item.pickup) && isLegacyBilingual(item.condition) && typeof item.price === "string") {
      const priceKrw = Number(item.price.replace(/[^0-9]/g, ""));
      if (!priceKrw) return [];
      return [{ id: item.id, name: item.name.en || item.name.ko, pickup: item.pickup.en || item.pickup.ko, priceKrw, category, condition: conditionFromLegacy(item.condition.en || item.condition.ko), status, icon, userCreated: true, ownedByCurrentUser: true }];
    }
    return [];
  });
}

function getStageStats(activeTasks: Task[], done: string[]): StageStat[] {
  return lifecycleStages.map((stage) => {
    const stageTasks = activeTasks.filter((task) => task.stage === stage.id);
    const completed = stageTasks.filter((task) => done.includes(task.id)).length;
    return { stage, completed, total: stageTasks.length, progress: stageTasks.length ? Math.round((completed / stageTasks.length) * 100) : 0 };
  });
}

function productName(product: MarketProduct, t: TFunction) {
  return product.name ?? tr(t, product.nameKey as TranslationKey);
}

function productPickup(product: MarketProduct, t: TFunction) {
  return product.pickup ?? tr(t, product.pickupKey as TranslationKey);
}

function productSeller(product: MarketProduct, t: TFunction, profile: UserProfile) {
  return product.seller ?? (product.userCreated ? tr(t, "marketplace:userSeller", { name: profile.name }) : tr(t, product.sellerKey as TranslationKey));
}

function localIsoDate(date = new Date()) { return date.toLocaleDateString("en-CA"); }
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.size > 8_000_000) { reject(new Error("errors:imageInvalid")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("errors:imageInvalid"));
    reader.onload = () => {
      const image = new Image(); image.onerror = () => reject(new Error("errors:imageInvalid"));
      image.onload = () => { const scale = Math.min(1, 1200 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); const context = canvas.getContext("2d"); if (!context) { reject(new Error("errors:imageInvalid")); return; } context.drawImage(image, 0, 0, canvas.width, canvas.height); const data = canvas.toDataURL("image/jpeg", 0.82); if (!isValidImageDataUrl(data)) reject(new Error("errors:imageInvalid")); else resolve(data); };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const { t, locale, localeReady, changeLocale } = useAppI18n();
  const [page, setPage] = useState<Page>("home");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [userProducts, setUserProducts] = useState<MarketProduct[]>([]);
  const [localPreferences, setLocalPreferences] = useState<LocalPreferences>(() => emptyPreferences());
  const [hydrated, setHydrated] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [infoPage, setInfoPage] = useState<"about" | "terms" | "privacy" | "safety" | "sources" | "disclaimer" | null>(null);
  const [selectedStage, setSelectedStage] = useState<LifecycleStage>("before-arrival");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MarketProduct | null>(null);
  const [selectedProductMode, setSelectedProductMode] = useState<ProductModalMode>("buyer");
  const [editingProduct, setEditingProduct] = useState<MarketProduct | null>(null);
  const [reportProduct, setReportProduct] = useState<MarketProduct | null>(null);
  const [pendingReservation, setPendingReservation] = useState<PendingReservation | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [marketMode, setMarketMode] = useState<MarketMode>("incoming");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketCategory, setMarketCategory] = useState("All");
  const [guideCategory, setGuideCategory] = useState("All");
  const [guideSearch, setGuideSearch] = useState("");
  const [lifeGuideSearch, setLifeGuideSearch] = useState("");
  const [lifeGuideCategory, setLifeGuideCategory] = useState("All");
  const [email, setEmail] = useState("student@korea.ac.kr");
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("guest");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [serverProfile, setServerProfile] = useState<ProfileRow | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [guestCandidate, setGuestCandidate] = useState<{ profile: UserProfile; done: string[]; products: MarketProduct[] } | null>(null);
  const guestCandidateRef = useRef<{ profile: UserProfile; done: string[]; products: MarketProduct[] } | null>(null);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);

  const applyAuthenticatedAccount = useCallback(async (user: User, candidate?: { profile: UserProfile; done: string[]; products: MarketProduct[] } | null) => {
    setServerBusy(true);
    try {
      const account = await loadAccount(user);
      setAuthUser(user); setServerProfile(account.profile); setProfile(profileRowToStored(account.profile)); setDone(account.done); setUserProducts(account.products); setAppMode("authenticated");
      setSetupOpen(!account.profile.onboarding_completed);
      if (candidate?.profile.mode === "personalized" && !account.profile.guest_data_imported_at && (candidate.done.length || candidate.products.length || !account.profile.onboarding_completed)) {
        setGuestCandidate(candidate); guestCandidateRef.current = candidate; setImportOpen(true);
      }
    } catch (error) { setServiceMessage(mapServiceError(error)); }
    finally { setServerBusy(false); }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const hydrationTimer = window.setTimeout(() => {
      const migrated = readLocalData(localStorage, storageKeys);
      const savedProfile = migrated.profile ? JSON.stringify(migrated.profile) : null;
      const savedDone = JSON.stringify(migrated.done);
      const savedProducts = JSON.stringify(migrated.products);
      const loadedProfile = savedProfile ? (() => { try { return normalizeProfile(JSON.parse(savedProfile)); } catch { return null; } })() : null;
      let candidate: { profile: UserProfile; done: string[]; products: MarketProduct[] } | null = null;
      let loadedDone: string[] = []; let loadedProducts: MarketProduct[] = [];
      if (loadedProfile) {
        setProfile(loadedProfile);
        const fallback = loadedProfile.mode === "demo" ? demoDone : [];
        try { loadedDone = normalizeDone(savedDone ? JSON.parse(savedDone) : null, getActiveTasks(loadedProfile.housing), fallback); } catch { loadedDone = fallback; }
        setDone(loadedDone); setAppMode(loadedProfile.mode === "demo" ? "demo" : "guest");
      } else {
        setDone([]);
        setSetupOpen(true);
      }
      if (savedProducts) { try { loadedProducts = normalizeUserProducts(JSON.parse(savedProducts)).map((product) => ({ ...product, source: "demo", ownedByCurrentUser: true })); } catch { loadedProducts = []; } }
      setUserProducts(loadedProducts);
      if (loadedProfile?.mode === "personalized") {
        candidate = { profile: loadedProfile, done: loadedDone, products: loadedProducts };
        setGuestCandidate(candidate);
        guestCandidateRef.current = candidate;
      }
      setVerified(migrated.verified); setLocalPreferences(migrated.preferences); writeLocalData(localStorage, storageKeys.data, migrated);
      setHydrated(true);
      if (supabase) void supabase.auth.getSession().then(async ({ data }) => {
        if (!data.session) return;
        const { data: verifiedSession, error } = await supabase.auth.getUser();
        if (!error && verifiedSession.user) await applyAuthenticatedAccount(verifiedSession.user, candidate);
      });
    }, 0);
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { setAuthUser(null); setServerProfile(null); setAppMode("guest"); setProfile(null); setDone([]); setUserProducts([]); setSetupOpen(false); }
      else if (session?.user && event !== "INITIAL_SESSION") void applyAuthenticatedAccount(session.user, guestCandidateRef.current);
    }).data.subscription;
    return () => { window.clearTimeout(hydrationTimer); subscription?.unsubscribe(); };
  }, [applyAuthenticatedAccount]);

  useEffect(() => { if (hydrated && appMode !== "authenticated") localStorage.setItem(storageKeys.checklist, JSON.stringify(done)); }, [done, hydrated, appMode]);
  useEffect(() => { if (hydrated && appMode !== "authenticated") localStorage.setItem(storageKeys.verified, String(verified)); }, [verified, hydrated, appMode]);
  useEffect(() => { if (hydrated && appMode !== "authenticated") localStorage.setItem(storageKeys.userProducts, JSON.stringify(userProducts)); }, [userProducts, hydrated, appMode]);
  useEffect(() => {
    if (!hydrated) return;
    if (appMode === "authenticated") return;
    if (profile) localStorage.setItem(storageKeys.profile, JSON.stringify(profile));
    else localStorage.removeItem(storageKeys.profile);
  }, [profile, hydrated, appMode]);
  useEffect(() => {
    if (!hydrated || appMode === "authenticated") return;
    try { writeLocalData(localStorage, storageKeys.data, { version: 6, profile, done, products: userProducts, verified, preferences: localPreferences }); } catch { window.setTimeout(() => setServiceMessage("errors:storageQuota"), 0); }
  }, [done, hydrated, localPreferences, profile, userProducts, verified, appMode]);
  useEffect(() => {
    if (!highlightTaskId) return;
    const timer = window.setTimeout(() => setHighlightTaskId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightTaskId]);
  useEffect(() => {
    if (!selectedProduct) return;
    const key = `ku-settle-market-report-${selectedProduct.id}`;
    const timer = window.setInterval(() => { if (localStorage.getItem(key) === "draft") { localStorage.removeItem(key); setReportProduct(selectedProduct); } }, 100);
    return () => window.clearInterval(timer);
  }, [selectedProduct]);
  useEffect(() => {
    if (localeReady && hydrated) document.title = `KU Settle — ${tr(t, "navigation:brandTagline")}`;
  }, [hydrated, locale, localeReady, t]);

  const currentProfile = profile ?? { ...demoProfile, name: tr(t, "profile:guestName"), mode: "personalized" as const };
  const openProduct = (product: MarketProduct) => { setSelectedProductMode(isOwnedMarketplaceProduct(product, appMode) ? "seller" : "buyer"); setSelectedProduct(product); };
  const openSellerProduct = (product: MarketProduct) => { setSelectedProductMode("seller"); setSelectedProduct(product); };
  const actualVerified = Boolean(authUser?.email_confirmed_at && authUser.email && isKuEmail(authUser.email));
  const showVerifiedBadge = shouldShowVerifiedBadge(appMode, actualVerified, verified);
  const activeTasks = useMemo(() => getActiveTasks(currentProfile.housing), [currentProfile.housing]);
  const completedCount = activeTasks.filter((task) => done.includes(task.id)).length;
  const progress = activeTasks.length ? Math.round((completedCount / activeTasks.length) * 100) : 0;
  const recommendedTask = activeTasks.find((task) => !done.includes(task.id)) ?? null;
  const stageStats = useMemo(() => getStageStats(activeTasks, done), [activeTasks, done]);
  const marketplaceProducts = useMemo(() => [...userProducts.filter((product) => product.serviceStatus !== "deleted"), ...products].map((product) => localPreferences.reservedProductIds.includes(String(product.id)) && product.serviceStatus !== "sold" ? { ...product, status: "Reserved" as const } : product), [userProducts, products, localPreferences.reservedProductIds]);
  const localPlaces = useMemo(() => [...places.filter((place) => !localPreferences.deletedPlaceIds.includes(place.id)), ...localPreferences.customPlaces].map((place) => ({ ...place, ...(localPreferences.placeOverrides[String(place.id)] ?? {}) })), [localPreferences.customPlaces, localPreferences.deletedPlaceIds, localPreferences.placeOverrides]);
  const navItems: { key: Page; icon: typeof GraduationCap; labelKey: string }[] = [
    { key: "home", icon: GraduationCap, labelKey: "navigation:home" },
    { key: "onboarding", icon: FileCheck2, labelKey: "navigation:onboarding" },
    { key: "life-guide", icon: BookOpen, labelKey: "navigation:lifeGuide" },
    { key: "marketplace", icon: ShoppingBag, labelKey: "navigation:marketplace" },
    { key: "guide", icon: MapPin, labelKey: "navigation:localGuide" },
    ...(appMode === "demo" ? [{ key: "admin" as const, icon: ShieldCheck, labelKey: "navigation:admin" }] : [])
  ];

  const go = (target: Page, intent: NavigationIntent = {}) => {
    if (target === "onboarding") {
      const targetStage = intent.stage ?? recommendedTask?.stage ?? selectedStage;
      setSelectedStage(targetStage);
      setFocusTaskId(intent.taskId ?? null);
      setHighlightTaskId(intent.highlight ? intent.taskId ?? null : null);
    }
    if (target === "marketplace" && intent.marketMode) {
      setMarketMode(intent.marketMode);
      setMarketSearch("");
      setMarketCategory("All");
    }
    if (target === "guide" && intent.guideCategory) setGuideCategory(intent.guideCategory);
    setPage(target);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openTaskAction = (action: TaskAction) => {
    if (action.kind === "external") return;
    if (action.target === "marketplace") go("marketplace", { marketMode: action.marketMode });
    else go("guide", { guideCategory: action.guideCategory });
  };
  const toggleTask = (id: string) => {
    const wasDone = done.includes(id); const next = wasDone ? done.filter((item) => item !== id) : [...done, id]; setDone(next);
    setLocalPreferences((current) => ({ ...current, progressHistory: [...current.progressHistory, { date: new Date().toLocaleDateString("en-CA"), progress: activeTasks.length ? Math.round((activeTasks.filter((task) => next.includes(task.id)).length / activeTasks.length) * 100) : 0 }].slice(-100) }));
    if (appMode === "authenticated" && authUser) void saveProgress(authUser.id, id, !wasDone).catch((error) => { setDone(done); setServiceMessage(mapServiceError(error)); });
  };
  const startPersonalizedPlan = (nextProfile: UserProfile) => {
    if (appMode === "authenticated" && authUser) {
      setServerBusy(true); void saveProfile(authUser.id, nextProfile, locale).then((row) => { setServerProfile(row); setProfile(profileRowToStored(row)); setSetupOpen(false); }).catch((error) => setServiceMessage(mapServiceError(error))).finally(() => setServerBusy(false)); return;
    }
    setProfile(nextProfile); setAppMode("guest"); setDone([]); setVerified(false); setSelectedStage("before-arrival"); setFocusTaskId(null); setHighlightTaskId(null); setSetupOpen(false);
  };
  const skipForDemo = () => { setProfile(demoProfile); setAppMode("demo"); setDone(demoDone); setVerified(false); setSelectedStage("first-weeks"); setSetupOpen(false); };
  const resetDemo = () => {
    [storageKeys.profile, storageKeys.checklist, storageKeys.verified, storageKeys.userProducts, storageKeys.data].forEach((key) => localStorage.removeItem(key));
    setProfile(demoProfile); setDone(demoDone); setVerified(false); setUserProducts([]); setLocalPreferences(emptyPreferences()); setGuestCandidate(null); guestCandidateRef.current = null; setAppMode("demo"); setMarketSearch(""); setMarketCategory("All"); setMarketMode("incoming");
    setSelectedProduct(null); setContactOpen(false); setGuideCategory("All"); setSelectedStage("before-arrival"); setFocusTaskId(null); setHighlightTaskId(null);
    setResetOpen(false); setProfileOpen(false); setPage("home"); setSetupOpen(false); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeMarketplaceStatus = async (product: MarketProduct, status: "active" | "sold" | "hidden" | "deleted") => {
    if (appMode !== "authenticated" && product.userCreated && product.ownedByCurrentUser) {
      setUserProducts((current) => status === "deleted"
        ? current.filter((item) => item.id !== product.id)
        : current.map((item) => item.id === product.id ? { ...item, serviceStatus: status, status: status === "sold" ? "Reserved" : "Available" } : item));
      if (status === "sold") setLocalPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.map((item) => item.productId === String(product.id) && item.status === "active" ? { ...item, status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item) }));
      if (status === "deleted") setLocalPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.filter((item) => item.productId !== String(product.id)), reportDrafts: current.reportDrafts.filter((item) => item.productId !== String(product.id)) }));
      if (status === "deleted") setSelectedProduct(null);
      else setSelectedProduct((current) => current?.id === product.id ? { ...current, serviceStatus: status, status: status === "sold" ? "Reserved" : "Available" } : current);
      setServiceMessage("common:saved");
      return;
    }
    if (!authUser || product.source !== "live" || !product.ownedByCurrentUser) return;
    setServerBusy(true);
    try {
      const updated = await updateMarketplaceItemStatus(String(product.id), status, authUser.id);
      setUserProducts((current) => status === "deleted" ? current.filter((item) => item.id !== product.id) : current.map((item) => item.id === product.id ? updated : item));
      if (status === "deleted") setSelectedProduct(null);
      else setSelectedProduct((current) => current?.id === product.id ? { ...current, ...updated } : current);
      setServiceMessage("common:saved");
    } catch (error) { setServiceMessage(mapServiceError(error)); }
    finally { setServerBusy(false); }
  };

  const addMarketplaceProduct = async (product: MarketProduct) => {
    if (appMode === "authenticated" && authUser) {
      setServerBusy(true);
      try { const created = await createMarketplaceItem(product, authUser.id, currentProfile.name); setUserProducts((current) => [created, ...current]); setServiceMessage("common:saved"); }
      catch (error) { setServiceMessage(mapServiceError(error)); throw error; }
      finally { setServerBusy(false); }
      return;
    }
    if (appMode === "demo" || appMode === "guest") { setUserProducts((current) => [{ ...product, source: "demo", ownedByCurrentUser: true, serviceStatus: "active" }, ...current]); setServiceMessage("common:saved"); return; }
    setAuthOpen(true); throw new Error("Authentication required");
  };
  const reserveMarketplaceProduct = (product: MarketProduct) => {
    if (product.serviceStatus === "sold" || product.status === "Reserved") { setServiceMessage("marketplace:soldUnavailable"); return; }
    setPendingReservation({ product });
  };
  const completeMarketplaceReservation = (product: MarketProduct, pickup: PickupSchedule, existingId?: string) => {
    const productId = String(product.id);
    if (!isValidPickupSchedule(pickup)) { setServiceMessage("validation:pickupScheduleRequired"); return; }
    const now = new Date().toISOString();
    setLocalPreferences((current) => ({ ...current, reservedProductIds: [...new Set([...current.reservedProductIds, productId])], reservations: [...current.reservations.filter((item) => !(item.productId === productId && item.status === "active")), { id: existingId ?? `reservation-${Date.now()}`, productId, buyerName: currentProfile.name, status: "active", createdAt: existingId ? (current.reservations.find((item) => item.id === existingId)?.createdAt ?? now) : now, updatedAt: now, ...pickup }] }));
    setPendingReservation(null);
    setSelectedProduct((current) => current?.id === product.id ? { ...current, status: "Reserved" } : current);
    setServiceMessage("common:saved");
  };
  const cancelMarketplaceReservation = (product: MarketProduct) => {
    const productId = String(product.id);
    setLocalPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== productId), reservations: current.reservations.map((item) => item.productId === productId && item.status === "active" ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString() } : item) }));
    setSelectedProduct((current) => current?.id === product.id ? { ...current, status: "Available" } : current); setServiceMessage("common:saved");
  };
  const editMarketplaceReservation = (product: MarketProduct, reservation: LocalReservation) => setPendingReservation({ product, reservation });
  const submitReport = (product: MarketProduct, report: Omit<ReportDraft, "productId" | "createdAt" | "status">) => {
    const productId = String(product.id);
    if (localPreferences.reportDrafts.some((item) => item.productId === productId)) { setServiceMessage("marketplace:duplicateReport"); return; }
    setLocalPreferences((current) => ({ ...current, reportDrafts: [...current.reportDrafts, { productId, ...report, status: "new", createdAt: new Date().toISOString() }] }));
    setReportProduct(null); setServiceMessage("marketplace:reportSubmitted");
  };
  const updateLocalProduct = (product: MarketProduct) => {
    const validation = validateMarketplaceInput(product);
    if (!validation.valid) { setServiceMessage(validation.error); return; }
    setUserProducts((current) => current.map((item) => item.id === product.id ? { ...item, ...product, source: "demo", ownedByCurrentUser: true } : item));
    setEditingProduct(null); setSelectedProduct(null); setServiceMessage("common:saved");
  };
  const toggleProductFavorite = (product: MarketProduct) => {
    const id = String(product.id);
    setLocalPreferences((current) => ({ ...current, favoriteProductIds: current.favoriteProductIds.includes(id) ? current.favoriteProductIds.filter((item) => item !== id) : [...current.favoriteProductIds, id] }));
  };

  const completeGuestImport = async () => {
    if (!authUser || !serverProfile || !guestCandidate) return;
    setServerBusy(true);
    try {
      const imported = await importGuestData(authUser.id, serverProfile, guestCandidate.profile, guestCandidate.done, guestCandidate.products, getActiveTasks(guestCandidate.profile.housing).map((task) => task.id), locale);
      localStorage.setItem(storageKeys.importState, JSON.stringify({ imported, completedAt: new Date().toISOString() }));
      [storageKeys.profile, storageKeys.checklist, storageKeys.verified, storageKeys.userProducts].forEach((key) => localStorage.removeItem(key));
      setImportOpen(false); setGuestCandidate(null); guestCandidateRef.current = null; await applyAuthenticatedAccount(authUser, null); setServiceMessage("profile:importSuccess");
    } catch (error) {
      const imported = isRecord(error) && Array.isArray(error.imported) ? error.imported.filter((id): id is string => typeof id === "string") : [];
      if (imported.length) localStorage.setItem(storageKeys.importState, JSON.stringify({ imported, partial: true, updatedAt: new Date().toISOString() }));
      setServiceMessage(mapServiceError(error));
    }
    finally { setServerBusy(false); }
  };
  const exportDemoData = () => {
    const blob = new Blob([JSON.stringify({ version: 6, profile, done, products: userProducts, verified, preferences: localPreferences }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ku-settle-demo-data.json"; anchor.click(); URL.revokeObjectURL(url);
  };
  const importDemoData = (file: File) => {
    const reader = new FileReader(); reader.onload = () => { try { const parsed: unknown = JSON.parse(String(reader.result)); if (!isRecord(parsed) || !("profile" in parsed) || !("done" in parsed) || !("products" in parsed) || !("preferences" in parsed)) throw new Error("invalid data"); const data = migrateLocalData(parsed); const importedProducts = normalizeUserProducts(data.products); const active = data.profile ? getActiveTasks(data.profile.housing) : getActiveTasks("dorm"); const importedDone = normalizeDone(data.done, active, data.profile?.mode === "demo" ? demoDone : []); setProfile(data.profile); setDone(importedDone); setUserProducts(importedProducts.map((product) => ({ ...product, source: "demo", userCreated: true, ownedByCurrentUser: true }))); setVerified(data.verified); setLocalPreferences(data.preferences); setServiceMessage("common:saved"); } catch { setServiceMessage("errors:generic"); } }; reader.readAsText(file);
  };

  if (!localeReady || !hydrated) return <InitialLoading/>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go("home")} aria-label={tr(t, "accessibility:brandHome")}>
          <span className="brand-mark">KU</span><span><strong>KU Settle</strong><small>{tr(t, "navigation:brandTagline")}</small></span>
        </button>
        <nav className="desktop-nav" aria-label={tr(t, "navigation:primaryLabel")}>
          {navItems.map(({ key, labelKey }) => <button key={key} onClick={() => go(key)} className={page === key ? "active" : ""}>{tr(t, labelKey)}</button>)}
        </nav>
        <div className="header-actions">
          <LanguageSelector locale={locale} changeLocale={changeLocale} t={t}/>
          {appMode !== "guest" && <button className="profile-button" onClick={() => appMode === "authenticated" ? setAccountOpen(true) : setProfileOpen(true)} aria-label={tr(t, "accessibility:profile")}>
            {showVerifiedBadge ? <BadgeCheck size={20} className="verified-icon"/> : <CircleUserRound size={20}/>}<span>{currentProfile.name}</span>
          </button>}
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={tr(t, menuOpen ? "navigation:closeMenu" : "navigation:openMenu")} aria-expanded={menuOpen}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label={tr(t, "navigation:mobileLabel")}>{navItems.map(({ key, labelKey, icon: Icon }) => <button key={key} onClick={() => { go(key); setMenuOpen(false); }} className={page === key ? "active" : ""}><Icon size={18}/>{tr(t, labelKey)}</button>)}</nav>}

      <main>
        {page === "home" && <Dashboard locale={locale} t={t} profile={currentProfile} activeTasks={activeTasks} stageStats={stageStats} progress={progress} completedCount={completedCount} recommendedTask={recommendedTask} go={go}/>}
        {page === "onboarding" && <Onboarding locale={locale} t={t} activeTasks={activeTasks} stageStats={stageStats} progress={progress} done={done} recommendedTask={recommendedTask} selectedStage={selectedStage} setSelectedStage={setSelectedStage} focusTaskId={focusTaskId} highlightTaskId={highlightTaskId} go={go} openTaskAction={openTaskAction} toggleTask={toggleTask} preferences={localPreferences} setPreferences={setLocalPreferences}/>}
        {page === "marketplace" && <Marketplace locale={locale} t={t} profile={currentProfile} appMode={appMode} products={marketplaceProducts} search={marketSearch} setSearch={setMarketSearch} category={marketCategory} setCategory={setMarketCategory} mode={marketMode} setMode={setMarketMode} addProduct={addMarketplaceProduct} selectProduct={openProduct} selectSellerProduct={openSellerProduct} preferences={localPreferences} setPreferences={setLocalPreferences} toggleFavorite={toggleProductFavorite}/>}
        {page === "life-guide" && <LifeGuide locale={locale} search={lifeGuideSearch} setSearch={setLifeGuideSearch} category={lifeGuideCategory} setCategory={setLifeGuideCategory} go={go} preferences={localPreferences}/>}
        {page === "guide" && <LocalGuide locale={locale} t={t} category={guideCategory} setCategory={setGuideCategory} search={guideSearch} setSearch={setGuideSearch} places={localPlaces} preferences={localPreferences} setPreferences={setLocalPreferences}/>}
        {page === "admin" && appMode === "demo" && <AdminPanel locale={locale} t={t} products={userProducts} places={localPlaces} preferences={localPreferences} tasks={activeTasks} done={done} setProducts={setUserProducts} setPreferences={setLocalPreferences} reset={resetDemo} exportData={exportDemoData} importData={importDemoData}/>}
      </main>
      {page === "marketplace" && <MyReservations locale={locale} t={t} products={marketplaceProducts} preferences={localPreferences} cancelReservation={cancelMarketplaceReservation} selectReservation={(product) => openProduct(product)} editReservation={editMarketplaceReservation}/>}
      {page === "marketplace" && marketMode === "leaving" && <ListingReports locale={locale} t={t} products={userProducts} reports={localPreferences.reportDrafts}/>}
      {page === "home" && <LifecycleSummary t={t} activeTasks={activeTasks} done={done} preferences={localPreferences} products={marketplaceProducts} go={go}/>}

      <footer><div className="footer-brand"><span className="brand-mark small">KU</span><span><strong>KU Settle</strong><small>{tr(t, "common:copyright", { year: formatNumber(locale, new Date().getFullYear(), { useGrouping: false }) })}</small></span></div><div className="footer-actions"><span className="footer-notice">{tr(t, "navigation:footerNotice")}</span>{(["about", "terms", "privacy", "safety", "sources", "disclaimer"] as const).map((item) => <button key={item} onClick={() => setInfoPage(item)}>{item}</button>)}{appMode !== "authenticated" && <><button className="reset-demo" onClick={exportDemoData}>{locale === "ko" ? "내보내기" : locale === "ja" ? "エクスポート" : locale === "zh-CN" ? "导出" : "Export"}</button><label className="reset-demo">{locale === "ko" ? "가져오기" : locale === "ja" ? "インポート" : locale === "zh-CN" ? "导入" : "Import"}<input type="file" accept="application/json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) importDemoData(file); }}/></label><button className="reset-demo" onClick={() => setResetOpen(true)}><RotateCcw size={13}/>{tr(t, "reset:button")}</button></>}</div></footer>

      {(serverBusy || serviceMessage) && <div className={`service-status ${serviceMessage?.startsWith("errors:") ? "error" : ""}`} role="status">{serverBusy ? tr(t, "common:saving") : serviceMessage ? tr(t, serviceMessage) : ""}{serviceMessage && <button onClick={() => setServiceMessage(null)} aria-label={tr(t, "common:close")}><X size={14}/></button>}</div>}

      {setupOpen && (
        <SetupModal t={t} submit={startPersonalizedPlan} skip={skipForDemo}/>
      )}
      {resetOpen && <ResetModal t={t} close={() => setResetOpen(false)} confirm={resetDemo}/>}
      {infoPage && <PublicInfoModal page={infoPage} close={() => setInfoPage(null)}/>}
      {profileOpen && (
        <VerificationModal locale={locale} t={t} profile={currentProfile} email={email} setEmail={setEmail} verified={verified} verifyError={verifyError} close={() => setProfileOpen(false)} verify={() => { const ok = /^[^@\s]+@korea\.ac\.kr$/i.test(email); setVerifyError(!ok); if (ok) setVerified(true); }}/>
      )}
      {authOpen && <AuthModal locale={locale} t={t} close={() => setAuthOpen(false)} configured={isSupabaseConfigured()} />}
      {accountOpen && authUser && (
        <AccountModal t={t} user={authUser} profile={currentProfile} taskCount={completedCount} listingCount={userProducts.filter((product) => product.ownedByCurrentUser).length} close={() => setAccountOpen(false)} save={(next) => startPersonalizedPlan(next)} signout={() => { setServerBusy(true); void signOut().catch((error) => setServiceMessage(mapServiceError(error))).finally(() => { setServerBusy(false); setAccountOpen(false); }); }} openDelete={() => { setAccountOpen(false); setDeleteOpen(true); }}/>
      )}
      {deleteOpen && authUser && (
        <DeleteAccountModal t={t} email={authUser.email ?? ""} close={() => setDeleteOpen(false)} confirm={() => { setServerBusy(true); void deleteAccount().then(async () => { await getSupabaseClient()?.auth.signOut({ scope: "local" }); [storageKeys.profile, storageKeys.checklist, storageKeys.verified, storageKeys.userProducts, storageKeys.importState].forEach((key) => localStorage.removeItem(key)); setDeleteOpen(false); setServiceMessage("profile:deleteSuccess"); }).catch((error) => setServiceMessage(mapServiceError(error))).finally(() => setServerBusy(false)); }}/>
      )}
      {importOpen && guestCandidate && (
        <GuestImportModal t={t} candidate={guestCandidate} close={() => setImportOpen(false)} confirm={() => void completeGuestImport()}/>
      )}
      {selectedProduct && (
        <ProductModal locale={locale} t={t} profile={currentProfile} mode={selectedProductMode} product={selectedProduct} reservation={localPreferences.reservations.find((item) => item.productId === String(selectedProduct.id) && item.status === "active")} close={() => setSelectedProduct(null)} contact={() => { setSelectedProduct(null); setContactOpen(true); }} reserve={() => reserveMarketplaceProduct(selectedProduct)} cancelReservation={() => cancelMarketplaceReservation(selectedProduct)} edit={() => { setEditingProduct(selectedProduct); setSelectedProduct(null); }} changeStatus={(status) => void changeMarketplaceStatus(selectedProduct, status)}/>
      )}
      {pendingReservation && <PickupScheduleModal t={t} product={pendingReservation.product} initial={pendingReservation.reservation} close={() => setPendingReservation(null)} reserve={(pickup) => completeMarketplaceReservation(pendingReservation.product, pickup, pendingReservation.reservation?.id)}/>}
      {reportProduct && <ReportModal t={t} product={reportProduct} reports={localPreferences.reportDrafts} close={() => setReportProduct(null)} submit={(report) => submitReport(reportProduct, report)}/>}
      {selectedProduct && productPickup(selectedProduct, t) && <MapActionBar t={t} place={productPickup(selectedProduct, t)}/>}
      {editingProduct && <ProductEditModal locale={locale} t={t} product={editingProduct} close={() => setEditingProduct(null)} save={updateLocalProduct}/>}
      {contactOpen && <ContactModal t={t} close={() => setContactOpen(false)}/>}
    </div>
  );
}

function InitialLoading() {
  return <div className="initial-loading" aria-busy="true"><span className="brand-mark">KU</span><strong>KU Settle</strong><i aria-hidden="true"/></div>;
}

function LanguageSelector({ locale, changeLocale, t }: { locale: Locale; changeLocale: (locale: Locale) => Promise<void>; t: TFunction }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => optionRefs.current[supportedLocales.indexOf(locale)]?.focus());
    const onPointerDown = (event: PointerEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); containerRef.current?.querySelector<HTMLButtonElement>(".language-trigger")?.focus(); } };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("keydown", onKeyDown); };
  }, [open, locale]);

  const onOptionKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? supportedLocales.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + supportedLocales.length) % supportedLocales.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return <div className="language-picker" ref={containerRef}>
    <button className="language-trigger" onClick={() => setOpen((value) => !value)} aria-haspopup="listbox" aria-expanded={open} aria-label={tr(t, "navigation:currentLanguage", { language: localeNames[locale] })}><Languages size={17}/><span>{localeNames[locale]}</span><ChevronDown size={15}/></button>
    {open && <div className="language-popover" role="listbox" aria-label={tr(t, "navigation:selectLanguage")}>
      {supportedLocales.map((item, index) => <button key={item} ref={(element) => { optionRefs.current[index] = element; }} role="option" aria-selected={locale === item} tabIndex={locale === item ? 0 : -1} onKeyDown={(event) => onOptionKeyDown(event, index)} onClick={() => { void changeLocale(item); setOpen(false); }}><span>{localeNames[item]}</span>{locale === item && <Check size={16}/>}</button>)}
    </div>}
  </div>;
}

function Dashboard({ locale, t, profile, activeTasks, stageStats, progress, completedCount, recommendedTask, go }: { locale: Locale; t: TFunction; profile: UserProfile; activeTasks: Task[]; stageStats: StageStat[]; progress: number; completedCount: number; recommendedTask: Task | null; go: (page: Page, intent?: NavigationIntent) => void }) {
  const recommendedIndex = recommendedTask ? activeTasks.findIndex((task) => task.id === recommendedTask.id) : -1;
  const recommendedStage = recommendedTask ? lifecycleStages.find((stage) => stage.id === recommendedTask.stage) : null;
  return <>
    <section className="hero section-pad">
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={14}/>{tr(t, "home:eyebrow")}</span>
        <h1>{tr(t, "home:greeting", { name: profile.name })}</h1><p className="hero-lead">{tr(t, "home:lead")}</p><p className="hero-body">{tr(t, "home:body")}</p>
        <div className="hero-actions"><button className="primary" onClick={() => go("onboarding")}>{tr(t, "home:primaryAction")}<ArrowRight size={18}/></button><button className="secondary" onClick={() => go("marketplace")}>{tr(t, "home:secondaryAction")}</button></div>
        <div className="trust-row">{["account", "languages", "journey"].map((item) => <span key={item}><Check size={14}/>{tr(t, `home:trust.${item}`)}</span>)}</div>
      </div>
      <div className="setup-card">
        <div className="setup-top"><div><span>{tr(t, "home:progressTitle")}</span><strong>{formatPercent(locale, progress)}</strong></div><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{formatPercent(locale, progress)}</span></div></div>
        <div className="progress-track"><i style={{ width: `${progress}%` }}/></div>
        <div className="setup-label"><span>{tr(t, "home:progressSummary", { completed: formatNumber(locale, completedCount), total: formatNumber(locale, activeTasks.length) })}</span><b>{formatPercent(locale, progress)}</b></div>
        <div className="home-lifecycle" aria-label={tr(t, "home:lifecycleLabel")}>{stageStats.map(({ stage, completed, total, progress: stageProgress }) => {
          const stageLabel = tr(t, stage.labelKey);
          const percent = formatPercent(locale, stageProgress);
          return <button key={stage.id} onClick={() => go("onboarding", { stage: stage.id })} aria-label={tr(t, "accessibility:stageProgress", { stage: stageLabel, completed: formatNumber(locale, completed), total: formatNumber(locale, total), progress: percent })}><span className="lifecycle-number">{stage.number}</span><span><strong>{stageLabel}</strong><small>{tr(t, "common:countOfTotal", { completed: formatNumber(locale, completed), total: formatNumber(locale, total) })} · {percent}</small></span><ChevronRight size={15}/></button>;
        })}</div>
        <button className="text-button" onClick={() => go("onboarding")}>{tr(t, "home:openPlan")}<ChevronRight size={16}/></button>
      </div>
    </section>
    <section className="dashboard-grid single section-pad compact">
      <button className={`next-card next-card-button ${recommendedTask ? "" : "all-complete"}`} onClick={() => go("onboarding", recommendedTask ? { stage: recommendedTask.stage, taskId: recommendedTask.id, highlight: true } : { stage: "departure" })}>
        <span className="next-icon">{recommendedTask ? <FileCheck2/> : <CheckCircle2/>}</span><span className="next-content"><span className="label">{tr(t, "home:recommended")}{recommendedStage ? ` · ${tr(t, recommendedStage.labelKey)}` : ""}</span><strong className="next-title">{recommendedTask ? tr(t, recommendedTask.titleKey) : tr(t, "home:allCompletedTitle")}</strong><span className="next-description">{recommendedTask ? tr(t, recommendedTask.descriptionKey) : tr(t, "home:allCompletedBody")}</span><span className="next-link">{tr(t, recommendedTask ? "home:viewRecommended" : "home:reviewCompleted")}<ArrowRight size={17}/></span></span>
        <span className="step-badge">{recommendedTask ? String(recommendedIndex + 1).padStart(2, "0") : "✓"}</span>
      </button>
    </section>
    <section className="feature-section section-pad compact"><div className="section-title"><span className="eyebrow">{tr(t, "home:informationToAction")}</span><h2>{tr(t, "home:connectedJourney")}</h2></div><div className="feature-grid">{([
      ["onboarding", FileCheck2, "navigation:onboarding", "home:features.onboarding", "01"], ["marketplace", ShoppingBag, "navigation:marketplace", "home:features.marketplace", "02"], ["guide", MapPin, "navigation:localGuide", "home:features.localGuide", "03"]
    ] as const).map(([target, Icon, titleKey, bodyKey, number]) => <button className="feature-card" key={target} onClick={() => go(target)}><span className="feature-number">{number}</span><span className="feature-icon"><Icon/></span><h3>{tr(t, titleKey)}</h3><p>{tr(t, bodyKey)}</p><span className="learn">{tr(t, "home:explore")}<ArrowRight size={17}/></span></button>)}</div></section>
  </>;
}

function Onboarding({ locale, t, activeTasks, stageStats, progress, done, recommendedTask, selectedStage, setSelectedStage, focusTaskId, highlightTaskId, go, openTaskAction, toggleTask, preferences, setPreferences }: { locale: Locale; t: TFunction; activeTasks: Task[]; stageStats: StageStat[]; progress: number; done: string[]; recommendedTask: Task | null; selectedStage: LifecycleStage; setSelectedStage: (stage: LifecycleStage) => void; focusTaskId: string | null; highlightTaskId: string | null; go: (page: Page, intent?: NavigationIntent) => void; openTaskAction: (action: TaskAction) => void; toggleTask: (id: string) => void; preferences: import("./lib/local-data").LocalPreferences; setPreferences: Dispatch<SetStateAction<import("./lib/local-data").LocalPreferences>> }) {
  const taskRef = useRef<HTMLElement | null>(null);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "none">("all");
  const [taskSearch, setTaskSearch] = useState(""); const [taskSort, setTaskSort] = useState<"default" | "due" | "status">("default");
  const [customTitle, setCustomTitle] = useState(""); const [customDate, setCustomDate] = useState(""); const [customNote, setCustomNote] = useState("");
  const selectedTasks = useMemo(() => activeTasks.filter((task) => task.stage === selectedStage), [activeTasks, selectedStage]);
  const visibleTasks = [...selectedTasks.filter((task) => { const due = preferences.dueDates[task.id] ?? ""; if (!tr(t, task.titleKey).toLocaleLowerCase(locale).includes(taskSearch.toLocaleLowerCase(locale))) return false; if (preferences.hiddenCompleted && done.includes(task.id)) return false; if (dateFilter === "none") return !due; const today = new Date().toLocaleDateString("en-CA"); if (dateFilter === "today") return due === today; if (dateFilter === "week") { const end = new Date(); end.setDate(end.getDate() + 7); return Boolean(due && due >= today && due <= end.toLocaleDateString("en-CA")); } return true; })].sort((a, b) => taskSort === "due" ? (preferences.dueDates[a.id] || "9999").localeCompare(preferences.dueDates[b.id] || "9999") : taskSort === "status" ? Number(done.includes(a.id)) - Number(done.includes(b.id)) : 0);
  const selectedStat = stageStats.find(({ stage }) => stage.id === selectedStage) ?? stageStats[0];
  const overallCompleted = activeTasks.filter((task) => done.includes(task.id)).length;
  useEffect(() => {
    if (!focusTaskId || !selectedTasks.some((task) => task.id === focusTaskId)) return;
    const frame = requestAnimationFrame(() => taskRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [focusTaskId, selectedStage, selectedTasks]);

  return <section className="page section-pad">
    <div className="page-hero lifecycle-hero"><div><span className="eyebrow"><FileCheck2 size={14}/>{tr(t, "onboarding:eyebrow")}</span><h1>{tr(t, "onboarding:title")}</h1><p>{tr(t, "onboarding:body")}</p></div><div className="progress-panels"><div className="progress-summary"><div><span>{tr(t, "onboarding:overallProgress")}</span><strong>{formatPercent(locale, progress)}</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }}/></div><small><CheckCircle2 size={14}/>{tr(t, "onboarding:taskCount", { count: overallCompleted })}</small></div><div className="progress-summary selected"><div><span>{tr(t, "onboarding:selectedStage")}</span><strong>{formatPercent(locale, selectedStat.progress)}</strong></div><div className="progress-track"><i style={{ width: `${selectedStat.progress}%` }}/></div><small>{tr(t, selectedStat.stage.labelKey)} · {tr(t, "common:countOfTotal", { completed: formatNumber(locale, selectedStat.completed), total: formatNumber(locale, selectedStat.total) })}</small></div></div></div>
    <div className="lifecycle-tabs" role="tablist" aria-label={tr(t, "accessibility:lifecycleTabs")}>{stageStats.map(({ stage, completed, total, progress: stageProgress }) => <button role="tab" aria-selected={selectedStage === stage.id} className={selectedStage === stage.id ? "active" : ""} key={stage.id} onClick={() => setSelectedStage(stage.id)}><span>{stage.number}</span><strong>{tr(t, stage.labelKey)}</strong><small>{tr(t, "common:countOfTotal", { completed: formatNumber(locale, completed), total: formatNumber(locale, total) })} · {formatPercent(locale, stageProgress)}</small><i><b style={{ width: `${stageProgress}%` }}/></i></button>)}</div>
    <div className="filters"><label className="search-field"><Search size={17}/><input value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} placeholder={locale === "ko" ? "작업 검색" : "Search tasks"}/></label><label className="sort-control"><span>{locale === "ko" ? "정렬" : "Sort"}</span><select value={taskSort} onChange={(e) => setTaskSort(e.target.value as "default" | "due" | "status")}><option value="default">{locale === "ko" ? "기본" : "Default"}</option><option value="due">{locale === "ko" ? "예정일순" : "Due date"}</option><option value="status">{locale === "ko" ? "미완료 우선" : "Incomplete first"}</option></select></label></div><div className="chips"><button aria-pressed={preferences.hiddenCompleted} onClick={() => setPreferences((p) => ({ ...p, hiddenCompleted: !p.hiddenCompleted }))}>{preferences.hiddenCompleted ? ui(locale, "show") : ui(locale, "hide")}</button>{(["all", "today", "week", "none"] as const).map((item) => <button key={item} aria-pressed={dateFilter === item} onClick={() => setDateFilter(item)}>{ui(locale, item === "all" ? "allDates" : item)}</button>)}</div>
    <div className="timeline-note"><Lightbulb size={20}/><span>{tr(t, "onboarding:recommendationHint")}</span>{recommendedTask && recommendedTask.stage !== selectedStage && <button onClick={() => go("onboarding", { stage: recommendedTask.stage, taskId: recommendedTask.id, highlight: true })}>{tr(t, "onboarding:viewNext")}<ArrowRight size={15}/></button>}</div>
    <div className="task-list">{visibleTasks.map((task, index) => {
      const isDone = done.includes(task.id); const isRecommended = !isDone && task.id === recommendedTask?.id; const isHighlighted = task.id === highlightTaskId; const title = tr(t, task.titleKey);
      const note = preferences.notes[task.id] ?? ""; const dueDate = preferences.dueDates[task.id] ?? ""; const important = preferences.important.includes(task.id); const update = (change: Partial<typeof preferences>) => setPreferences((current) => ({ ...current, ...change }));
      return <article ref={task.id === focusTaskId ? taskRef : undefined} data-task-id={task.id} aria-current={isRecommended ? "step" : undefined} className={`task-card ${isRecommended ? "featured recommended" : ""} ${isHighlighted ? "attention-flash" : ""} ${isDone ? "is-done" : ""}`} key={task.id}>
        <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={tr(t, isDone ? "onboarding:markIncomplete" : "onboarding:markComplete", { task: title })}>{isDone && <Check size={18}/>}</button>
        <div className="task-main"><div className="task-title-row"><div><span className="task-category">{String(index + 1).padStart(2, "0")} · {tr(t, task.categoryKey)}</span><h2>{title}</h2></div><span className={`status ${isDone ? "complete" : isRecommended ? "progress" : ""}`}>{tr(t, isDone ? "common:completed" : isRecommended ? "common:inProgress" : "common:notStarted")}</span></div><p>{tr(t, task.descriptionKey)}</p>
          <div className="task-details"><div><span className="detail-label"><PackageCheck size={16}/>{tr(t, "onboarding:prepare")}</span><ul>{task.preparationKeys.map((key) => <li key={key}>{tr(t, key)}</li>)}</ul></div><div><span className="detail-label"><Clock3 size={16}/>{tr(t, "onboarding:estimatedTime")}</span><strong>{tr(t, "common:durationMinutes", { min: formatNumber(locale, task.estimatedMinutes[0]), max: formatNumber(locale, task.estimatedMinutes[1]) })}</strong></div><div className="tip"><span className="detail-label"><Lightbulb size={16}/>{tr(t, "onboarding:practicalNote")}</span><p>{tr(t, task.practicalNoteKey)}</p></div></div>
      <div className="personal-task-tools"><label>{ui(locale, "due")} <input type="date" value={dueDate} onChange={(e) => update({ dueDates: { ...preferences.dueDates, [task.id]: e.target.value } })}/></label><label>{ui(locale, "note")} <input value={note} onChange={(e) => update({ notes: { ...preferences.notes, [task.id]: e.target.value } })}/></label><button type="button" aria-pressed={important} onClick={() => update({ important: important ? preferences.important.filter((id) => id !== task.id) : [...preferences.important, task.id] })}>{important ? `★ ${ui(locale, "important")}` : `☆ ${ui(locale, "important")}`}</button></div>
          {task.officialGuidance ? <div className="official-guidance"><div><span className="detail-label"><ShieldCheck size={16}/>{tr(t, "onboarding:officialGuidance")}</span><p>{tr(t, task.officialGuidance.messageKey)}</p></div><a href={task.officialGuidance.href} target="_blank" rel="noopener noreferrer">{tr(t, task.officialGuidance.actionLabelKey)}<ArrowRight size={14}/></a></div> : task.action && (task.action.kind === "external" ? <a className="task-action" href={task.action.href} target="_blank" rel="noopener noreferrer">{tr(t, task.action.actionLabelKey)}<ArrowRight size={15}/></a> : <button className="task-action" onClick={() => openTaskAction(task.action as TaskAction)}>{tr(t, task.action.actionLabelKey)}<ArrowRight size={15}/></button>)}
        </div>
      </article>;
    })}</div>
    <article className="listing-form"><h2>{ui(locale, "personal")}</h2><form className="listing-grid" onSubmit={(e) => { e.preventDefault(); if (!customTitle.trim()) return; setPreferences((p) => ({ ...p, customTasks: [...p.customTasks, { id: `personal-${Date.now()}`, title: customTitle.trim(), stage: selectedStage, dueDate: customDate, note: customNote, completed: false }] })); setCustomTitle(""); setCustomDate(""); setCustomNote(""); }}><label className="field"><span>{locale === "ko" ? "작업명" : "Task name"}</span><input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}/></label><label className="field"><span>{ui(locale, "due")}</span><input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}/></label><label className="field field-wide"><span>{ui(locale, "note")}</span><input value={customNote} onChange={(e) => setCustomNote(e.target.value)}/></label><button className="primary" type="submit">{ui(locale, "add")}</button></form>{preferences.customTasks.filter((task) => task.stage === selectedStage).map((task) => <div className="personal-task-tools" key={task.id}><button onClick={() => setPreferences((p) => ({ ...p, customTasks: p.customTasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item) }))}>{task.completed ? "✓" : "○"}</button><strong>{task.title}</strong><span>{task.dueDate || ui(locale, "none")}</span><button onClick={() => setPreferences((p) => ({ ...p, customTasks: p.customTasks.filter((item) => item.id !== task.id) }))}>{ui(locale, "delete")}</button></div>)}</article>
  </section>;
}

function MyReservations({ locale, t, products, preferences, cancelReservation, selectReservation, editReservation }: { locale: Locale; t: TFunction; products: MarketProduct[]; preferences: LocalPreferences; cancelReservation: (product: MarketProduct) => void; selectReservation: (product: MarketProduct) => void; editReservation: (product: MarketProduct, reservation: LocalReservation) => void }) {
  const reservations = preferences.reservations;
  const [now] = useState(() => new Date());
  return <section className="reservation-list section-pad" aria-label={tr(t, "marketplace:myReservations")}><div className="section-title"><span className="eyebrow"><CalendarClock size={14}/>{tr(t, "marketplace:myReservations")}</span><h2>{tr(t, "marketplace:reservationSummary")}</h2></div>{reservations.length ? <div className="reservation-cards">{reservations.map((reservation) => { const product = products.find((item) => String(item.id) === reservation.productId); if (!product) return null; const past = reservation.status === "active" && isPickupPast(reservation, now); const status = reservation.status === "completed" ? tr(t, "marketplace:reservationCompleted") : reservation.status === "cancelled" ? tr(t, "marketplace:reservationCancelled") : past ? tr(t, "marketplace:pickupPast") : tr(t, "marketplace:reservationActive"); return <article className={`reservation-card ${past ? "is-past" : ""}`} key={reservation.id}><button className="reservation-card-main" onClick={() => selectReservation(product)}><strong>{productName(product, t)}</strong><span>{formatCurrency(locale, product.priceKrw)} · {status}</span><span>{tr(t, "marketplace:seller")}: {product.seller ?? "—"}</span><span><CalendarDays size={14}/>{reservation.pickupDate ? `${reservation.pickupDate} ${reservation.pickupStartTime}–${reservation.pickupEndTime}` : tr(t, "marketplace:pickupNotSet")}</span><span><MapPin size={14}/>{productPickup(product, t)}</span></button>{reservation.status === "active" && <div className="reservation-card-actions"><button className="secondary" onClick={() => editReservation(product, reservation)}>{tr(t, "marketplace:changePickup")}</button><button className="secondary" onClick={() => cancelReservation(product)}>{tr(t, "marketplace:cancelReservation")}</button></div>}</article>; })}</div> : <EmptyState icon={CalendarClock} text={locale === "ko" ? "예약한 상품이 없습니다." : locale === "ja" ? "予約した商品はありません。" : locale === "zh-CN" ? "暂无预约商品。" : "You have no reservations yet."}/>}</section>;
}

function PickupScheduleModal({ t, product, initial, close, reserve }: { t: TFunction; product: MarketProduct; initial?: LocalReservation; close: () => void; reserve: (pickup: PickupSchedule) => void }) {
  const [error, setError] = useState(false);
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const values = new FormData(event.currentTarget); const pickup = { pickupDate: String(values.get("pickupDate") || ""), pickupStartTime: String(values.get("pickupStartTime") || ""), pickupEndTime: String(values.get("pickupEndTime") || "") }; if (!pickup.pickupDate || !pickup.pickupStartTime || !pickup.pickupEndTime || pickup.pickupEndTime <= pickup.pickupStartTime) { setError(true); return; } reserve(pickup); };
  return <Modal close={close} label={tr(t, "marketplace:pickupScheduleTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><form onSubmit={submit}><h2>{tr(t, "marketplace:pickupScheduleTitle")}</h2><p>{product.name ? product.name : tr(t, product.nameKey as TranslationKey)}</p><label className="field"><span>{tr(t, "marketplace:pickupDate")}</span><input name="pickupDate" type="date" min={localIsoDate()} defaultValue={initial?.pickupDate ?? ""} required/></label><div className="time-fields"><label className="field"><span>{tr(t, "marketplace:pickupStart")}</span><input name="pickupStartTime" type="time" defaultValue={initial?.pickupStartTime ?? ""} required/></label><label className="field"><span>{tr(t, "marketplace:pickupEnd")}</span><input name="pickupEndTime" type="time" defaultValue={initial?.pickupEndTime ?? ""} required/></label></div>{error && <p className="error-text" role="alert">{tr(t, "validation:pickupScheduleRequired")}</p>}<button className="primary full" type="submit">{tr(t, initial ? "marketplace:savePickup" : "marketplace:confirmReservation")}</button></form></Modal>;
}

function ReportModal({ t, product, reports, close, submit }: { t: TFunction; product: MarketProduct; reports: ReportDraft[]; close: () => void; submit: (report: Omit<ReportDraft, "productId" | "createdAt" | "status">) => void }) {
  const [reason, setReason] = useState<ReportReason | "">(""); const [detail, setDetail] = useState(""); const duplicate = reports.some((item) => item.productId === String(product.id));
  const reasons: ReportReason[] = ["false_info", "price_mismatch", "scam", "inappropriate", "schedule_issue", "other"];
  return <Modal close={close} label={tr(t, "marketplace:reportTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon reset"><AlertTriangle/></div><h2>{tr(t, "marketplace:reportTitle")}</h2><p>{productName(product, t)}</p>{duplicate ? <p className="error-text" role="alert">{tr(t, "marketplace:duplicateReport")}</p> : <><label className="field"><span>{tr(t, "marketplace:reportReason")}</span><select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}><option value="">{tr(t, "marketplace:chooseReportReason")}</option>{reasons.map((item) => <option key={item} value={item}>{tr(t, `marketplace.reportReasons.${item}`)}</option>)}</select></label>{reason === "other" && <label className="field"><span>{tr(t, "marketplace:reportDetail")}</span><textarea value={detail} onChange={(event) => setDetail(event.target.value)}/></label>}<button className="primary full" disabled={!reason} onClick={() => submit({ reason, detail })}>{tr(t, "marketplace:submitReport")}</button></>}</Modal>;
}

function MapActionBar({ t, place }: { t: TFunction; place: string }) {
  return <div className="map-action-bar"><span><MapPin size={15}/>{place}</span><a href={googleMapsSearchUrl(place)} target="_blank" rel="noopener noreferrer">{tr(t, "marketplace:mapsView")}</a><a href={googleMapsDirectionsUrl(place)} target="_blank" rel="noopener noreferrer">{tr(t, "marketplace:mapsDirections")}</a></div>;
}

function ListingReports({ locale, t, products, reports }: { locale: Locale; t: TFunction; products: MarketProduct[]; reports: ReportDraft[] }) {
  const mine = reports.filter((report) => products.some((product) => String(product.id) === report.productId));
  if (!mine.length) return null;
  return <section className="listing-reports section-pad"><div className="section-title"><span className="eyebrow"><AlertTriangle size={14}/>{tr(t, "marketplace:reportHistory")}</span><h2>{tr(t, "marketplace:reportHistory")}</h2></div>{mine.map((report) => <article key={`${report.productId}-${report.createdAt}`}><strong>{products.find((product) => String(product.id) === report.productId)?.name ?? report.productId}</strong><span>{tr(t, `marketplace.reportReasons.${report.reason}`)} · {tr(t, "marketplace:reportReceived")}</span><small>{new Date(report.createdAt).toLocaleString(locale)}</small></article>)}</section>;
}

function LifecycleSummary({ t, activeTasks, done, preferences, products, go }: { t: TFunction; activeTasks: Task[]; done: string[]; preferences: LocalPreferences; products: MarketProduct[]; go: (page: Page, intent?: NavigationIntent) => void }) {
  const [now] = useState(() => new Date()); const today = localIsoDate(now); const limit = new Date(now); limit.setDate(limit.getDate() + 3); const limitDate = localIsoDate(limit);
  const due = activeTasks.map((task) => ({ task, due: preferences.dueDates[task.id] ?? "" })).filter(({ task, due }) => !done.includes(task.id) && due && due <= limitDate).sort((a, b) => a.due.localeCompare(b.due));
  const reservations = preferences.reservations.filter((item) => item.status === "active");
  const hasItems = due.length || reservations.length;
  return <section className="lifecycle-summary section-pad" aria-label={tr(t, "home:todaySummary")}><div className="section-title"><span className="eyebrow"><CalendarClock size={14}/>{tr(t, "home:todaySummary")}</span><h2>{hasItems ? tr(t, "home:urgentItems") : tr(t, "home:noUpcoming")}</h2></div><div className="summary-metrics"><span>{tr(t, "home:incompleteCount", { count: activeTasks.filter((task) => !done.includes(task.id)).length })}</span><span>{tr(t, "home:progressSummaryShort", { progress: Math.round((done.length / Math.max(1, activeTasks.length)) * 100) })}</span></div>{hasItems ? <div className="summary-items">{due.slice(0, 4).map(({ task, due }) => <button key={task.id} onClick={() => go("onboarding", { stage: task.stage, taskId: task.id, highlight: true })}><strong>{due < today ? tr(t, "home:overdue") : due === today ? tr(t, "home:dueToday") : tr(t, "home:dueSoon")}</strong><span>{tr(t, task.titleKey)}</span></button>)}{reservations.slice(0, 3).map((reservation) => { const product = products.find((item) => String(item.id) === reservation.productId); return product ? <button key={reservation.id} onClick={() => go("marketplace")}><strong>{tr(t, "marketplace:myReservations")}</strong><span>{productName(product, t)}</span></button> : null; })}</div> : <p className="empty-copy">{tr(t, "home:noUpcoming")}</p>}</section>;
}

function AdminPanel({ locale, t, products, places: localPlaces, preferences, tasks: activeTasks, done, setProducts, setPreferences, reset, exportData, importData }: { locale: Locale; t: TFunction; products: MarketProduct[]; places: import("./data").Place[]; preferences: LocalPreferences; tasks: Task[]; done: string[]; setProducts: Dispatch<SetStateAction<MarketProduct[]>>; setPreferences: Dispatch<SetStateAction<LocalPreferences>>; reset: () => void; exportData: () => void; importData: (file: File) => void }) {
  const [search, setSearch] = useState(""); const [category, setCategory] = useState("All"); const [newPlaceName, setNewPlaceName] = useState(""); const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const visible = products.filter((product) => product.serviceStatus !== "deleted" && (category === "All" || product.category === category) && productName(product, t).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  const updateReservation = (productId: string) => setPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== productId), reservations: current.reservations.map((item) => item.productId === productId && item.status === "active" ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item) }));
  const updateProduct = (product: MarketProduct, status: "active" | "sold" | "hidden" | "deleted") => { if (status === "deleted" && !window.confirm(tr(t, "admin:confirmDelete"))) return; if (status === "deleted") { setProducts((current) => current.filter((item) => item.id !== product.id)); setPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.filter((item) => item.productId !== String(product.id)), reportDrafts: current.reportDrafts.filter((item) => item.productId !== String(product.id)) })); return; } setProducts((current) => current.map((item) => item.id === product.id ? { ...item, serviceStatus: status, status: status === "sold" ? "Reserved" : "Available" } : item)); if (status === "sold") updateReservation(String(product.id)); };
  const updateReport = (productId: string, status: ReportDraft["status"]) => setPreferences((current) => ({ ...current, reportDrafts: current.reportDrafts.map((item) => item.productId === productId ? { ...item, status } : item) }));
  const updatePlace = (place: import("./data").Place, field: "phone" | "hours" | "closedDays" | "address" | "officialUrl" | "sourceName" | "lastVerifiedAt" | "verificationStatus", value: string) => setPreferences((current) => ({ ...current, placeOverrides: { ...current.placeOverrides, [place.id]: { ...current.placeOverrides[String(place.id)], id: place.id, [field]: value || undefined } } }));
  const updatePlaceCoordinates = (place: import("./data").Place, field: "lat" | "lng", value: string) => { const numeric = Number(value); if (value && !Number.isFinite(numeric)) return; const coordinates = { lat: place.coordinates?.lat ?? 0, lng: place.coordinates?.lng ?? 0, [field]: numeric }; setPreferences((current) => ({ ...current, placeOverrides: { ...current.placeOverrides, [place.id]: { ...current.placeOverrides[String(place.id)], id: place.id, coordinates } } })); };
  const deletePlace = (place: import("./data").Place) => { if (!window.confirm(locale === "ko" ? "이 장소를 삭제할까요?" : locale === "ja" ? "この場所を削除しますか？" : locale === "zh-CN" ? "要删除此地点吗？" : "Delete this place?")) return; setPreferences((current) => ({ ...current, deletedPlaceIds: places.includes(place) ? [...new Set([...current.deletedPlaceIds, place.id])] : current.deletedPlaceIds, customPlaces: current.customPlaces.filter((item) => item.id !== place.id) })); };
  const addPlace = () => { const name = newPlaceName.trim(); if (!name) return; const id = Date.now(); const place = { id, category: "Food" as const, nameKey: "localGuide:places.anamClinic.name" as const, descriptionKey: "localGuide:places.anamClinic.description" as const, locationKey: "localGuide:places.anamClinic.location" as const, tipKey: "localGuide:places.anamClinic.tip" as const, distanceMeters: 0, english: false, displayName: name, displayDescription: "", displayLocation: newPlaceAddress.trim(), verificationStatus: "needs_confirmation" as const }; setPreferences((current) => ({ ...current, customPlaces: [place, ...current.customPlaces] })); setNewPlaceName(""); setNewPlaceAddress(""); };
  const guideArticles = [...lifeGuideArticles, ...expandedLifeGuideArticles];
  return <section className="page section-pad admin-page"><div className="page-hero"><div><span className="eyebrow"><ShieldCheck size={14}/>{tr(t, "admin:eyebrow")}</span><h1>{tr(t, "admin:title")}</h1><p>{tr(t, "admin:demoNotice")}</p></div></div><div className="admin-metrics"><span><strong>{products.length}</strong>{tr(t, "admin:products")}</span><span><strong>{preferences.reservations.length}</strong>{tr(t, "admin:reservations")}</span><span><strong>{preferences.reportDrafts.length}</strong>{tr(t, "admin:reports")}</span><span><strong>{activeTasks.length}</strong>{tr(t, "admin:tasks")}</span></div><div className="admin-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr(t, "marketplace:search")}/><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="All">{tr(t, "marketplace:all")}</option>{productCategories.map((item) => <option key={item} value={item}>{tr(t, `marketplace:categories.${item}`)}</option>)}</select><button className="secondary" onClick={exportData}>{tr(t, "admin:export")}</button><label className="secondary">{tr(t, "admin:import")}<input type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importData(file); }}/></label><button className="danger-link" onClick={() => { if (window.confirm(tr(t, "admin:confirmReset"))) reset(); }}>{tr(t, "admin:reset")}</button></div><div className="admin-grid"><section><h2>{tr(t, "admin:productSection")}</h2>{visible.length ? visible.map((product) => <article className="admin-card" key={product.id}><div><strong>{productName(product, t)}</strong><span>{formatCurrency(locale, product.priceKrw)} · {product.category}</span><small>{product.serviceStatus ?? "active"} · {product.status}</small></div><div className="admin-card-actions"><button onClick={() => updateProduct(product, product.serviceStatus === "hidden" ? "active" : "hidden")}>{tr(t, product.serviceStatus === "hidden" ? "marketplace:showListing" : "marketplace:hideListing")}</button><button onClick={() => updateProduct(product, product.serviceStatus === "sold" ? "active" : "sold")}>{tr(t, product.serviceStatus === "sold" ? "marketplace:cancelSold" : "marketplace:markSold")}</button><button className="danger-link" onClick={() => updateProduct(product, "deleted")}>{tr(t, "marketplace:deleteListing")}</button></div></article>) : <p className="empty-copy">{tr(t, "admin:noData")}</p>}</section><section><h2>{tr(t, "admin:reservationSection")}</h2>{preferences.reservations.length ? preferences.reservations.map((reservation) => { const product = products.find((item) => String(item.id) === reservation.productId); return <article className="admin-card" key={reservation.id}><div><strong>{product ? productName(product, t) : reservation.productId}</strong><span>{reservation.buyerName} · {reservation.status}</span><small>{reservation.pickupDate ? `${reservation.pickupDate} ${reservation.pickupStartTime}–${reservation.pickupEndTime}` : tr(t, "marketplace:pickupNotSet")}</small></div>{reservation.status === "active" && product && <button onClick={() => updateReservation(String(product.id))}>{tr(t, "marketplace:cancelReservation")}</button>}</article>; }) : <p className="empty-copy">{tr(t, "admin:noData")}</p>}</section><section><h2>{tr(t, "admin:reportSection")}</h2>{preferences.reportDrafts.length ? preferences.reportDrafts.map((report) => <article className="admin-card" key={`${report.productId}-${report.createdAt}`}><div><strong>{report.productId}</strong><span>{report.reason} · {report.detail}</span><small>{new Date(report.createdAt).toLocaleString(locale)}</small></div><select value={report.status} onChange={(event) => updateReport(report.productId, event.target.value as ReportDraft["status"])}><option value="new">{tr(t, "admin:reportNew")}</option><option value="reviewed">{tr(t, "admin:reportReviewed")}</option><option value="resolved">{tr(t, "admin:reportResolved")}</option></select></article>) : <p className="empty-copy">{tr(t, "admin:noData")}</p>}</section><section><h2>{tr(t, "admin:lifecycleSection")}</h2><div className="admin-card"><span>{tr(t, "admin:completedTasks", { count: done.length })}</span><span>{tr(t, "admin:trackedTasks", { count: activeTasks.length })}</span><span>{tr(t, "admin:progress", { progress: Math.round(done.length / Math.max(1, activeTasks.length) * 100) })}</span></div></section><section><h2>{locale === "ko" ? "가이드 출처 관리" : locale === "ja" ? "ガイド出典管理" : locale === "zh-CN" ? "指南来源管理" : "Guide source management"}</h2>{guideArticles.map((guide) => { const metadata = preferences.guideMetadata[guide.id] ?? { contentCheckedAt: guide.contentCheckedAt ?? guide.lastVerifiedAt ?? "2026-08-29", contentOrigin: guide.contentOrigin ?? (guide.officialUrl ? "official-guide" : "demo"), sourceStatus: guide.sourceStatus ?? (guide.officialUrl ? "verified" : "unavailable"), officialUrl: guide.officialUrl, sourceName: guide.sourceName }; return <article className="admin-card" key={guide.id}><strong>{getGuideLocaleCopy(guide, locale).title}</strong><label>{locale === "ko" ? "콘텐츠 성격" : locale === "ja" ? "コンテンツ種別" : locale === "zh-CN" ? "内容类型" : "Content origin"}<select value={metadata.contentOrigin} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, contentOrigin: event.target.value as "official-guide" | "demo" } } }))}><option value="official-guide">{guideUi(locale, "officialOrigin")}</option><option value="demo">{guideUi(locale, "demoOrigin")}</option></select></label><input type="date" value={metadata.contentCheckedAt} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, contentCheckedAt: event.target.value } } }))}/><select value={metadata.sourceStatus} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, sourceStatus: event.target.value as "verified" | "needs_confirmation" | "unavailable" } } }))}><option value="verified">{guideUi(locale, "sourceVerified")}</option><option value="needs_confirmation">{guideUi(locale, "sourceNeedsConfirmation")}</option><option value="unavailable">{guideUi(locale, "sourceUnavailable")}</option></select><input placeholder={guideUi(locale, "sourceName")} value={metadata.sourceName ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, sourceName: event.target.value } } }))}/><input placeholder={guideUi(locale, "sourceUrl")} value={metadata.officialUrl ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, officialUrl: event.target.value } } }))}/>{(["en", "ko", "ja", "zh-CN"] as const).map((language) => <input key={language} placeholder={`${language} official URL`} value={metadata.officialUrls?.[language] ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, officialUrls: { ...metadata.officialUrls, [language]: event.target.value } } } }))}/>) }</article>; })}</section><section><h2>{locale === "ko" ? "장소 관리" : locale === "ja" ? "場所管理" : locale === "zh-CN" ? "地点管理" : "Place management"}</h2><div className="admin-card-actions"><input aria-label="장소명" placeholder={locale === "ko" ? "장소명" : "Place name"} value={newPlaceName} onChange={(event) => setNewPlaceName(event.target.value)}/><input aria-label="주소" placeholder={locale === "ko" ? "주소" : "Address"} value={newPlaceAddress} onChange={(event) => setNewPlaceAddress(event.target.value)}/><button className="primary" onClick={addPlace}>{locale === "ko" ? "장소 추가" : locale === "ja" ? "場所を追加" : locale === "zh-CN" ? "添加地点" : "Add place"}</button></div>{localPlaces.map((place) => <article className="admin-card" key={place.id}><div><strong>{place.displayName ?? place.localizedName?.[locale] ?? tr(t, place.nameKey)}</strong><span>{place.verificationStatus === "official" || place.verificationStatus === "verified" ? (locale === "ko" ? "확인된 정보" : "Verified information") : (locale === "ko" ? "확인 필요" : "Needs confirmation")}</span></div><div className="admin-card-actions"><input aria-label="전화번호" placeholder="전화번호" value={place.phone ?? ""} onChange={(event) => updatePlace(place, "phone", event.target.value)}/><input aria-label="영업시간" placeholder="영업시간" value={place.hours ?? ""} onChange={(event) => updatePlace(place, "hours", event.target.value)}/><input aria-label="휴무일" placeholder="휴무일" value={place.closedDays ?? ""} onChange={(event) => updatePlace(place, "closedDays", event.target.value)}/><input aria-label="위도" inputMode="decimal" placeholder="위도" value={place.coordinates?.lat ?? ""} onChange={(event) => updatePlaceCoordinates(place, "lat", event.target.value)}/><input aria-label="경도" inputMode="decimal" placeholder="경도" value={place.coordinates?.lng ?? ""} onChange={(event) => updatePlaceCoordinates(place, "lng", event.target.value)}/><input aria-label="확인일" type="date" value={place.lastVerifiedAt ?? ""} onChange={(event) => updatePlace(place, "lastVerifiedAt", event.target.value)}/><select aria-label="정보 상태" value={place.verificationStatus ?? "needs_confirmation"} onChange={(event) => updatePlace(place, "verificationStatus", event.target.value)}><option value="official">확인된 정보</option><option value="verified">확인된 정보</option><option value="needs_confirmation">확인 필요</option><option value="demo">데모 정보</option></select><button className="danger-link" onClick={() => deletePlace(place)}>{locale === "ko" ? "장소 삭제" : locale === "ja" ? "場所を削除" : locale === "zh-CN" ? "删除地点" : "Delete place"}</button></div></article>)}</section></div></section>;
}

function Marketplace({ locale, t, profile, appMode, products: marketplaceProducts, search, setSearch, category, setCategory, mode, setMode, addProduct, selectProduct: buyerSelectProduct, selectSellerProduct, preferences, setPreferences, toggleFavorite }: { locale: Locale; t: TFunction; profile: UserProfile; appMode: AppMode; products: MarketProduct[]; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; mode: MarketMode; setMode: (value: MarketMode) => void; addProduct: (product: MarketProduct) => Promise<void>; selectProduct: (product: MarketProduct) => void; selectSellerProduct: (product: MarketProduct) => void; preferences: LocalPreferences; setPreferences: Dispatch<SetStateAction<LocalPreferences>>; toggleFavorite: (product: MarketProduct) => void }) {
  const [success, setSuccess] = useState(false);
  const [sort, setSort] = useState<"latest" | "price">("latest");
  const categories = ["All", ...productCategories];
  const selectProduct = mode === "leaving" ? selectSellerProduct : buyerSelectProduct;
  const categoryLabel = (value: string) => value === "All" ? tr(t, "marketplace:all") : tr(t, `marketplace:categories.${value}`);
  const filtered = useMemo(() => [...marketplaceProducts.filter((product) => product.serviceStatus !== "hidden" && product.serviceStatus !== "deleted" && (category === "All" || product.category === category) && productName(product, t).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)))].sort((a, b) => sort === "price" ? a.priceKrw - b.priceKrw : Number(b.id) - Number(a.id)), [marketplaceProducts, category, search, locale, t, sort]);
const changeMode = (nextMode: MarketMode) => { setMode(nextMode); setSuccess(false); };
  const completeListing = async (product: MarketProduct) => { await addProduct(product); setSearch(""); setCategory("All"); setMode("incoming"); setSuccess(true); };

  return <section className="page section-pad market-page">
<div className="page-hero market-hero"><div><span className="eyebrow"><ShoppingBag size={14}/>{tr(t, "marketplace:eyebrow")}</span><h1>{tr(t, "marketplace:title")}</h1><p>{tr(t, "marketplace:body")}</p></div><div className="mode-switch" aria-label={tr(t, "accessibility:marketMode")}><button aria-pressed={mode === "incoming"} className={mode === "incoming" ? "active" : ""} onClick={() => changeMode("incoming")}><ShoppingBag size={18}/>{tr(t, "marketplace:incoming")}</button><button aria-pressed={mode === "leaving"} className={mode === "leaving" ? "active" : ""} onClick={() => changeMode("leaving")}><Tag size={18}/>{tr(t, "marketplace:leaving")}</button></div><button className="primary market-list-cta" onClick={() => changeMode("leaving")}><Tag size={17}/>{tr(t, "marketplace:form.submit")}</button></div>
    <div className="market-flow">{(["verification", "listing", "pickup", "transaction"] as const).map((step, index) => <div key={step}><span>{index === 0 ? <BadgeCheck/> : index === 1 ? <ShoppingBag/> : index === 2 ? <MapPin/> : <Banknote/>}</span><strong>{tr(t, `marketplace:flow.${step}`)}</strong>{index < 3 && <ChevronRight/>}</div>)}</div>
{mode === "leaving" ? !(["authenticated", "demo", "guest"] as AppMode[]).includes(appMode) ? <article className="listing-form auth-gate"><ShieldCheck/><h2>{tr(t, "marketplace:authRequiredTitle")}</h2><p>{tr(t, "marketplace:authRequiredBody")}</p></article> : <><ListingForm locale={locale} t={t} submit={completeListing}/><UserListingManager locale={locale} products={marketplaceProducts} preferences={preferences} selectProduct={selectProduct} cancelReservation={(product) => setPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.map((item) => item.productId === String(product.id) && item.status === "active" ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString() } : item) }))}/></> : <>
      {success && <div className="success-banner" role="status"><CheckCircle2 size={18}/>{tr(t, "marketplace:form.success")}</div>}
      <div className="filters"><label className="search-box"><Search size={19}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr(t, "marketplace:search")}/>{search && <button onClick={() => setSearch("")} aria-label={tr(t, "marketplace:clearSearch")}><X size={16}/></button>}</label><label className="sort-control"><span>{locale === "ko" ? "정렬" : "Sort"}</span><select value={sort} onChange={(event) => setSort(event.target.value as "latest" | "price")}><option value="latest">{locale === "ko" ? "최신순" : "Latest"}</option><option value="price">{locale === "ko" ? "가격순" : "Price"}</option></select></label><div className="chips">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div></div>
      {preferences.reservedProductIds.length > 0 && <section className="reservation-summary"><strong>{locale === "ko" ? "내 예약 상품" : "My reservations"}</strong><span>{preferences.reservedProductIds.length}</span><button className="secondary" onClick={() => setPreferences((current) => ({ ...current, reservedProductIds: [] }))}>{locale === "ko" ? "예약 전체 취소" : "Cancel all"}</button></section>}
      {filtered.length ? <div className="product-grid">{filtered.map((product) => {
        const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t);
        const favorite = preferences.favoriteProductIds.includes(String(product.id));
        return <div className="product-card-wrap" key={product.id}><button className="product-card" aria-label={tr(t, "accessibility:productDetails", { product: name })} onClick={() => selectProduct(product)}><div className={`product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}>{product.imageDataUrl ? <img className="product-image" src={product.imageDataUrl} alt=""/> : <Icon/>}<span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span><span className="source-pill">{tr(t, product.source === "live" ? "common:liveData" : product.source === "demo" ? "common:demoData" : "common:sampleData")}</span></div><div className="product-info"><div><h2>{name}</h2><strong className="price">{formatCurrency(locale, product.priceKrw)}</strong></div><dl><div><dt>{tr(t, "marketplace:condition")}</dt><dd>{tr(t, `marketplace:conditions.${product.condition}`)}</dd></div><div><dt>{tr(t, "marketplace:pickup")}</dt><dd><MapPin size={14}/>{productPickup(product, t)}</dd></div></dl><span className="seller"><SellerIcon size={16}/>{productSeller(product, t, profile)}</span><span className="details-link">{tr(t, "marketplace:details")}<ArrowRight size={16}/></span></div></button><button className="favorite-button" aria-pressed={favorite} aria-label={tr(t, favorite ? "marketplace:unfavorite" : "marketplace:favorite")} title={tr(t, favorite ? "marketplace:unfavorite" : "marketplace:favorite")} onClick={() => toggleFavorite(product)}>{favorite ? "★" : "☆"}</button></div>;
      })}</div> : <EmptyState icon={Search} text={tr(t, "marketplace:empty")}/>}
    </>}
  </section>;
}

function UserListingManager({ locale, products: userProducts, preferences, selectProduct, cancelReservation }: { locale: Locale; products: MarketProduct[]; preferences: LocalPreferences; selectProduct: (product: MarketProduct) => void; cancelReservation: (product: MarketProduct) => void }) {
  const mine = userProducts.filter((product) => product.userCreated && product.serviceStatus !== "deleted");
  return <section className="listing-manager" aria-label={locale === "ko" ? "내 상품 관리" : "My listings"}><div className="listing-manager-heading"><h2>{locale === "ko" ? "내 상품 관리" : "My listings"}</h2><span>{mine.length}</span></div>{mine.length ? <div className="my-listing-list">{mine.map((product) => { const reservation = preferences.reservations.find((item) => item.productId === String(product.id) && item.status === "active"); return <div className="my-listing-row" key={product.id}><button className="my-listing-row-main" onClick={() => selectProduct(product)}><span>{product.imageDataUrl ? <img src={product.imageDataUrl} alt=""/> : <Tag size={18}/>}</span><strong>{product.name}</strong><small>{product.serviceStatus === "sold" ? (locale === "ko" ? "거래 완료" : "Sold") : reservation ? (locale === "ko" ? "예약됨" : "Reserved") : product.serviceStatus === "hidden" ? (locale === "ko" ? "숨김" : "Hidden") : (locale === "ko" ? "판매 중" : "Active")}</small><ArrowRight size={16}/></button>{reservation && <div className="listing-reservation"><span>{locale === "ko" ? `예약자: ${reservation.buyerName}` : `Reserved by: ${reservation.buyerName}`}</span><button className="secondary" onClick={() => cancelReservation(product)}>{locale === "ko" ? "예약 취소" : "Cancel reservation"}</button></div>}</div>; })}</div> : <p className="empty-copy">{locale === "ko" ? "아직 등록한 상품이 없습니다." : "You have no listings yet."}</p>}</section>;
}

function ListingForm({ locale, t, submit }: { locale: Locale; t: TFunction; submit: (product: MarketProduct) => Promise<void> }) {
  const [itemName, setItemName] = useState(""); const [description, setDescription] = useState(""); const [price, setPrice] = useState(""); const [category, setCategory] = useState<ProductCategory>("Home"); const [condition, setCondition] = useState<ProductCondition>("good"); const [pickup, setPickup] = useState(""); const [hours, setHours] = useState(""); const [imageDataUrl, setImageDataUrl] = useState(""); const [availability, setAvailability] = useState<ProductStatus>("Available"); const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemName.trim() || !price.trim() || !pickup.trim()) { setErrorKey("validation:requiredFields"); return; }
    if (!/^\d+$/.test(price.trim())) { setErrorKey("validation:validPrice"); return; }
    const priceKrw = Number(price.trim());
    if (!Number.isSafeInteger(priceKrw) || priceKrw <= 0 || priceKrw > 100_000_000) { setErrorKey("validation:validPrice"); return; }
    setSaving(true);
    try { await submit({ id: `user-${Date.now()}`, name: itemName.trim(), description: description.trim(), priceKrw, category, condition, pickup: pickup.trim(), availableHours: hours.trim(), imageDataUrl, status: availability, icon: categoryProductIcons[category], userCreated: true }); setItemName(""); setDescription(""); setPrice(""); setPickup(""); setHours(""); setImageDataUrl(""); setErrorKey(null); }
    catch { setErrorKey("errors:saveFailed"); } finally { setSaving(false); }
  };
  return <article className="listing-form"><div className="listing-heading"><span className="eyebrow"><PlusCircleIcon/>{tr(t, "marketplace:leaving")}</span><h2>{tr(t, "marketplace:form.title")}</h2><p>{tr(t, "marketplace:form.body")}</p></div><form onSubmit={handleSubmit} className="listing-grid">
    <label className="field"><span>{tr(t, "marketplace:form.itemName")}</span><input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={tr(t, "marketplace:form.itemPlaceholder")}/></label>
    <label className="field field-wide"><span>{locale === "ko" ? "설명" : locale === "ja" ? "説明" : locale === "zh-CN" ? "说明" : "Description"}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3}/></label>
    <label className="field"><span>{tr(t, "marketplace:form.price")}</span><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" placeholder={tr(t, "marketplace:form.pricePlaceholder")}/></label>
    <label className="field"><span>{tr(t, "marketplace:form.category")}</span><select value={category} onChange={(event) => setCategory(event.target.value as ProductCategory)}>{productCategories.map((value) => <option key={value} value={value}>{tr(t, `marketplace:categories.${value}`)}</option>)}</select></label>
    <label className="field"><span>{tr(t, "marketplace:form.condition")}</span><select value={condition} onChange={(event) => setCondition(event.target.value as ProductCondition)}>{productConditions.map((value) => <option key={value} value={value}>{tr(t, `marketplace:conditions.${value}`)}</option>)}</select></label>
    <label className="field field-wide"><span>{tr(t, "marketplace:form.pickup")}</span><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder={tr(t, "marketplace:form.pickupPlaceholder")}/></label>
    <label className="field"><span>{locale === "ko" ? "거래 가능 시간" : locale === "ja" ? "取引可能時間" : locale === "zh-CN" ? "可交易时间" : "Available hours"}</span><input value={hours} onChange={(event) => setHours(event.target.value)} placeholder="10:00–18:00"/></label>
     <label className="field field-wide"><span>{locale === "ko" ? "상품 이미지" : locale === "ja" ? "商品画像" : locale === "zh-CN" ? "商品图片" : "Product image"}</span><small>{tr(t, "marketplace:imageHint")}</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void compressImage(file).then(setImageDataUrl).catch((error) => setErrorKey(error instanceof Error ? error.message : "errors:imageInvalid")); event.currentTarget.value = ""; }}/>{imageDataUrl && <><img className="listing-image-preview" src={imageDataUrl} alt={locale === "ko" ? "선택한 상품 이미지" : "Selected product"}/><button type="button" className="skip-button" onClick={() => setImageDataUrl("")}><Trash2 size={14}/>{tr(t, "marketplace:removeImage")}</button></>}</label>
    <label className="field"><span>{tr(t, "marketplace:form.availability")}</span><select value={availability} onChange={(event) => setAvailability(event.target.value as ProductStatus)}><option value="Available">{tr(t, "common:available")}</option><option value="Reserved">{tr(t, "common:reserved")}</option></select></label>
    {errorKey && <p className="error-text form-error" role="alert">{tr(t, errorKey)}</p>}<button className="primary listing-submit" type="submit" disabled={saving}><ShoppingBag size={18}/>{tr(t, saving ? "common:saving" : "marketplace:form.submit")}</button>
  </form></article>;
}

function PlusCircleIcon() { return <Tag size={14}/>; }

function LocalGuide({ locale, t, category, setCategory, search, setSearch, places: localPlaces, preferences, setPreferences }: { locale: Locale; t: TFunction; category: string; setCategory: (value: string) => void; search: string; setSearch: (value: string) => void; places: import("./data").Place[]; preferences: import("./lib/local-data").LocalPreferences; setPreferences: Dispatch<SetStateAction<import("./lib/local-data").LocalPreferences>> }) {
  const categories: Array<"All" | PlaceCategory> = ["All", "Food", "Halal", "Vegan", "Hospital", "Pharmacy", "Hair Salon", "Cafe", "Grocery"];
  const categoryLabel = (value: string) => value === "All" ? tr(t, "localGuide:all") : tr(t, `localGuide:categories.${value}`);
  const [kakaoPlaces, setKakaoPlaces] = useState<import("./data").Place[]>([]); const [kakaoStatus, setKakaoStatus] = useState<"idle" | "loading" | "ready" | "error">("idle"); const [kakaoError, setKakaoError] = useState<string | null>(null); const [kakaoOnlyFavorites, setKakaoOnlyFavorites] = useState(false); const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null); const requestId = useRef(0);
  const fetchKakaoPlaces = useCallback(async () => { const id = ++requestId.current; setKakaoStatus("loading"); setKakaoError(null); try { const params = new URLSearchParams({ category, query: search, radius: "2000" }); const response = await fetch(`/api/places/search?${params.toString()}`); const payload = await response.json() as Partial<KakaoSearchResponse> & { error?: string }; if (!response.ok) throw new Error(payload.error ?? "kakao_error"); if (id !== requestId.current) return; setKakaoPlaces(dedupePlaces(payload.places ?? [])); setKakaoStatus("ready"); } catch (error) { if (id !== requestId.current) return; setKakaoPlaces([]); setKakaoStatus("error"); setKakaoError(error instanceof Error ? error.message : "kakao_error"); } }, [category, search]);
  useEffect(() => { const timer = window.setTimeout(() => void fetchKakaoPlaces(), 350); return () => window.clearTimeout(timer); }, [fetchKakaoPlaces]);
  const filtered = localPlaces.filter((place) => (category === "All" || place.category === category || (category === "Food" && ["Halal", "Vegan"].includes(place.category))) && `${place.displayName ?? place.localizedName?.[locale] ?? tr(t, place.nameKey)} ${place.displayDescription ?? tr(t, place.descriptionKey)} ${place.address ?? place.displayLocation ?? tr(t, place.locationKey)} ${place.phone ?? ""}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  const shownKakaoPlaces = kakaoOnlyFavorites ? kakaoPlaces.filter((place) => preferences.placeFavorites.includes(place.id)) : kakaoPlaces;
  const mapPlaces = shownKakaoPlaces.length ? shownKakaoPlaces : (kakaoStatus === "error" || kakaoStatus === "ready" && !kakaoPlaces.length ? filtered : []);
  const displayPlaces = shownKakaoPlaces.length ? shownKakaoPlaces : filtered;
  return <section className="page section-pad guide-page"><div className="page-hero"><div><span className="eyebrow"><MapPin size={14}/>{tr(t, "localGuide:eyebrow")}</span><h1>{tr(t, "localGuide:title")}</h1><p>{tr(t, "localGuide:body")}</p></div><div className="guide-visual"><span><MapPin/></span><i/><b>KU</b><i/><span><Utensils/></span></div></div>
    <div className="kakao-guide-toolbar"><span>{locale === "ko" ? "카카오 장소 검색 · 반경 2km" : locale === "ja" ? "Kakao場所検索 · 半径2km" : locale === "zh-CN" ? "Kakao地点搜索 · 半径2公里" : "Kakao place search · 2 km radius"}</span><label><input type="checkbox" checked={kakaoOnlyFavorites} onChange={(event) => setKakaoOnlyFavorites(event.target.checked)}/>{locale === "ko" ? "즐겨찾기 장소만 보기" : locale === "ja" ? "お気に入りだけ表示" : locale === "zh-CN" ? "仅显示收藏地点" : "Show favorites only"}</label></div>{kakaoStatus === "loading" && <p className="map-status">{locale === "ko" ? "카카오 장소를 검색하는 중입니다…" : locale === "ja" ? "Kakaoの場所を検索中…" : locale === "zh-CN" ? "正在搜索 Kakao 地点…" : "Searching Kakao places…"}</p>}{kakaoStatus === "error" && <div className="map-status map-error">{kakaoError === "not_configured" ? (locale === "ko" ? "Kakao API 키가 설정되지 않아 데모 장소를 표시합니다." : "Kakao API key is not configured. Showing demo places.") : (locale === "ko" ? "Kakao 장소 검색에 실패했습니다. 데모 장소를 표시합니다." : "Kakao place search failed. Showing demo places.")}<button className="secondary" onClick={() => void fetchKakaoPlaces()}>{locale === "ko" ? "다시 시도" : locale === "ja" ? "再試行" : locale === "zh-CN" ? "重试" : "Retry"}</button></div>}<KakaoMap places={mapPlaces} selectedId={selectedPlaceId} onSelect={(place) => setSelectedPlaceId(place.id)} labels={{ loading: locale === "ko" ? "지도를 불러오는 중입니다…" : locale === "ja" ? "地図を読み込み中…" : locale === "zh-CN" ? "正在加载地图…" : "Loading map…", failed: locale === "ko" ? "카카오 지도를 불러오지 못했습니다. 목록과 외부 지도 링크를 이용하세요." : locale === "ja" ? "Kakaoマップを読み込めません。リストと外部地図リンクをご利用ください。" : locale === "zh-CN" ? "无法加载 Kakao 地图。请使用列表和外部地图链接。" : "Kakao map could not be loaded. Use the list and external map links.", attribution: "Kakao Maps", noCoordinates: locale === "ko" ? "표시할 좌표가 없습니다." : locale === "ja" ? "表示できる座標がありません。" : locale === "zh-CN" ? "没有可显示的坐标。" : "No coordinates to display." }}/><label className="search-field"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "ko" ? "장소 검색" : locale === "ja" ? "場所を検索" : locale === "zh-CN" ? "搜索地点" : "Search places"}/></label><div className="chips guide-chips">{categories.map((item) => <button key={item} aria-pressed={category === item} aria-label={tr(t, "accessibility:placeCategory", { category: categoryLabel(item) })} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div>
    {displayPlaces.length ? <div className="place-grid">{displayPlaces.map((place) => { const Icon = categoryIcons[place.category] || MapPin; const favorite = preferences.placeFavorites.includes(place.id); const reportKey = String(place.id); const location = place.address ?? place.displayLocation ?? tr(t, place.locationKey); const displayName = place.displayName ?? place.localizedName?.[locale] ?? tr(t, place.nameKey); return <article className={`place-card ${selectedPlaceId === place.id ? "is-selected" : ""}`} key={place.id} onClick={() => setSelectedPlaceId(place.id)}><div className="place-top"><span className="place-icon"><Icon/></span><span className={`demo-pill ${place.verificationStatus === "official" || place.verificationStatus === "verified" ? "verified-pill" : ""}`}>{place.verificationStatus === "official" || place.verificationStatus === "verified" ? (locale === "ko" ? "확인된 정보" : locale === "ja" ? "確認済み" : locale === "zh-CN" ? "已确认信息" : "Verified information") : place.verificationStatus === "needs_confirmation" ? (locale === "ko" ? "확인 필요" : locale === "ja" ? "確認が必要" : locale === "zh-CN" ? "需要确认" : "Needs confirmation") : (locale === "ko" ? "데모 정보" : locale === "ja" ? "デモ情報" : locale === "zh-CN" ? "演示信息" : "Demo information")}</span><button aria-pressed={favorite} onClick={() => setPreferences((p) => ({ ...p, placeFavorites: favorite ? p.placeFavorites.filter((id) => id !== place.id) : [...p.placeFavorites, place.id] }))}>{favorite ? "★" : "☆"}</button></div><span className="place-category">{categoryLabel(place.category)}</span><h2>{displayName}</h2><p>{place.displayDescription ?? tr(t, place.descriptionKey)}</p><div className="place-meta"><span className="no"><MessageCircle size={16}/>{locale === "ko" ? "언어 지원은 업체 문의 필요" : "Ask the provider about language support"}</span><span><MapPin size={16}/>{location} · {tr(t, "localGuide:distanceFromKu", { distance: formatDistance(locale, place.distanceMeters) })}</span>{place.phone && <a href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>☎ {place.phone}</a>}{place.hours && <span>🕒 {place.hours}</span>}{place.closedDays && <span>· {place.closedDays}</span>}</div><div className="guide-map-links"><a href={place.mapUrl ?? googleMapsSearchUrl(`${displayName} ${location}`)} target="_blank" rel="noopener noreferrer">{locale === "ko" ? "지도에서 보기" : "View map"}</a><a href={googleMapsDirectionsUrl(`${displayName} ${location}`)} target="_blank" rel="noopener noreferrer">{locale === "ko" ? "길찾기" : "Directions"}</a></div>{(place.sourceName || place.officialUrl || place.lastVerifiedAt) && <div className="place-source"><span>{place.sourceName ?? (locale === "ko" ? "공식 출처" : "Official source")}</span>{place.officialUrl && <a href={place.officialUrl} target="_blank" rel="noopener noreferrer">{locale === "ko" ? "출처 보기" : "View source"}</a>}{place.lastVerifiedAt && <small>{locale === "ko" ? `정보 확인일: ${place.lastVerifiedAt}` : `Checked: ${place.lastVerifiedAt}`}</small>}</div>}<div className="student-tip"><Lightbulb size={17}/><div><strong>{tr(t, "localGuide:studentTip")}</strong><p>{tr(t, place.tipKey)}</p></div></div><label className="field"><span>{locale === "ko" ? "정보 수정 제보 초안(외부 전송 안 됨)" : "Correction draft (not sent externally)"}</span><input value={preferences.reports[reportKey] ?? ""} onChange={(e) => setPreferences((p) => ({ ...p, reports: { ...p.reports, [reportKey]: e.target.value } }))}/></label></article>; })}</div> : <EmptyState icon={MapPin} text={tr(t, "localGuide:empty")}/>}
  </section>;
}

function LifeGuide({ locale, search, setSearch, category, setCategory, go, preferences }: { locale: Locale; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; go: (page: Page, intent?: NavigationIntent) => void; preferences: LocalPreferences }) {
  const labels: Record<string, string> = locale === "ko" ? { All: "전체", housing: "주거", arrival: "입국·교통", immigration: "체류·행정", "mobile-banking": "통신·은행", academic: "학사생활", healthcare: "의료·응급", daily: "일상생활", departure: "귀국 준비" } : locale === "ja" ? { All: "すべて", housing: "住居", arrival: "入国・交通", immigration: "在留・行政", "mobile-banking": "通信・銀行", academic: "学業生活", healthcare: "医療・緊急", daily: "日常生活", departure: "帰国準備" } : locale === "zh-CN" ? { All: "全部", housing: "住房", arrival: "入境·交通", immigration: "居留·行政", "mobile-banking": "通信·银行", academic: "学业生活", healthcare: "医疗·紧急", daily: "日常生活", departure: "回国准备" } : { All: "All", housing: "Housing", arrival: "Arrival & Transportation", immigration: "Immigration", "mobile-banking": "Mobile & Banking", academic: "Academic Life", healthcare: "Healthcare & Emergency", daily: "Daily Life", departure: "Departure" };
  const articles = [...lifeGuideArticles, ...expandedLifeGuideArticles];
  const filtered = articles.filter((article) => { const copy = getGuideLocaleCopy(article, locale); return (category === "All" || article.category === category) && `${copy.title} ${copy.summary} ${copy.content} ${(copy.checklist ?? []).join(" ")} ${(copy.steps ?? []).join(" ")} ${(copy.cautions ?? []).join(" ")}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)); });
  return <section className="page section-pad"><div className="page-hero"><div><span className="eyebrow"><BookOpen size={14}/> {locale === "ko" ? "생활 가이드" : locale === "ja" ? "生活ガイド" : locale === "zh-CN" ? "生活指南" : "Life Guide"}</span><h1>{locale === "ko" ? "생활 가이드" : locale === "ja" ? "生活ガイド" : locale === "zh-CN" ? "生活指南" : "Life Guide"}</h1><p>{locale === "ko" ? "공식 정보를 찾고 확인할 수 있는 생활정보 허브입니다." : locale === "ja" ? "公式情報を確認できる生活情報ハブです。" : locale === "zh-CN" ? "查找和确认官方信息的生活指南。" : "Find, check, and save practical information from official sources."}</p></div></div><label className="search-field"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "ko" ? "제목 또는 본문 검색" : locale === "ja" ? "タイトルまたは本文を検索" : locale === "zh-CN" ? "搜索标题或正文" : "Search title or content"}/></label><div className="chips">{["All", ...Object.keys(labels).filter((key) => key !== "All")].map((key) => <button key={key} aria-pressed={category === key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{labels[key]}</button>)}</div>{filtered.length ? <div className="guide-article-grid">{filtered.map((article) => { const copy = getGuideLocaleCopy(article, locale); const metadata = preferences.guideMetadata[article.id]; const checked = metadata?.contentCheckedAt ?? article.contentCheckedAt ?? article.lastVerifiedAt; const checkedDate = checked ? (() => { try { return formatDate(locale, checked); } catch { return checked; } })() : ""; const sourceStatus = metadata?.sourceStatus ?? article.sourceStatus ?? (article.officialUrl ? "verified" : article.verificationStatus === "needs_confirmation" ? "needs_confirmation" : "unavailable"); const sourceUrl = sourceStatus === "verified" ? (metadata?.officialUrls?.[locale] ?? article.officialUrls?.[locale] ?? metadata?.officialUrl ?? article.officialUrl) : undefined; const sourceName = sourceStatus === "verified" ? (metadata?.sourceName ?? article.sourceName) : undefined; const contentOrigin = metadata?.contentOrigin ?? article.contentOrigin ?? (article.officialUrl ? "official-guide" : "demo"); return <article className="guide-article" key={article.id}><span className="source-pill">{contentOrigin === "demo" ? guideUi(locale, "demoOrigin") : guideUi(locale, "officialOrigin")}</span><span className="place-category">{labels[article.category]}</span><h2>{copy.title}</h2><p>{copy.summary}</p><div className="article-meta"><span>{sourceName ?? guideUi(locale, sourceStatus === "unavailable" ? "sourceUnavailable" : "sourceNeedsConfirmation")}</span><span>{checkedDate ? `${guideUi(locale, "checked")}: ${checkedDate}` : ""}</span></div>{checkedDate && <small className="article-note">{guideUi(locale, "checkedNote")}</small>}<p>{copy.content}</p>{article.category === "immigration" || article.category === "healthcare" || article.category === "mobile-banking" ? <p className="student-tip"><AlertTriangle size={15}/>{guideUi(locale, "changing")}</p> : null}{copy.steps?.length ? <><h3>{guideUi(locale, "steps")}</h3><ol>{copy.steps.map((step) => <li key={step}>{step}</li>)}</ol></> : null}{copy.checklist?.length ? <><h3>{guideUi(locale, "checklist")}</h3><ul>{copy.checklist.map((item) => <li key={item}>{item}</li>)}</ul></> : null}{copy.cautions?.map((caution) => <p className="student-tip" key={caution}><AlertTriangle size={15}/>{caution}</p>)}{article.estimatedMinutes && <p className="article-note">{guideUi(locale, "duration")}: {guideDuration(locale, article.estimatedMinutes[0], article.estimatedMinutes[1])}</p>}{article.relatedTaskIds[0] && <button className="task-action" onClick={() => go("onboarding", { taskId: article.relatedTaskIds[0], highlight: true })}>{locale === "ko" ? "관련 라이프사이클 작업 보기" : locale === "ja" ? "関連するライフサイクルを見る" : locale === "zh-CN" ? "查看相关留学周期任务" : "View related lifecycle task"}<ArrowRight size={15}/></button>}{sourceUrl ? <a className="task-action" href={sourceUrl} target="_blank" rel="noopener noreferrer">{guideUi(locale, "officialSource")}<ArrowRight size={15}/></a> : <span className="article-note">{sourceStatus === "unavailable" ? guideUi(locale, "sourceUnavailable") : guideUi(locale, "sourceNeedsConfirmation")}</span>}</article>})}</div> : <EmptyState icon={BookOpen} text={locale === "ko" ? "검색 결과가 없습니다." : locale === "ja" ? "検索結果がありません." : locale === "zh-CN" ? "没有找到指南。" : "No guides found."}/>}</section>;
}

function Modal({ children, close, label, className = "", dismissible = true }: { children: ReactNode; close: () => void; label: string; className?: string; dismissible?: boolean }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      if (dismissible && event.key === "Escape") close();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("[autofocus], button, input, select, a[href]")?.focus());
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = ""; window.removeEventListener("keydown", handler); previousFocus?.focus(); };
  }, [close, dismissible]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) close(); }}><div ref={dialogRef} tabIndex={-1} onKeyDown={(event) => { if (dismissible && event.key === "Escape") { event.preventDefault(); close(); } }} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}

function SetupModal({ t, submit, skip }: { t: TFunction; submit: (profile: UserProfile) => void; skip: () => void }) {
  const [name, setName] = useState(""); const [arrivalDate, setArrivalDate] = useState(""); const [housing, setHousing] = useState<Housing>("dorm"); const [error, setError] = useState(false);
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); if (!name.trim() || !arrivalDate) { setError(true); return; } submit({ name: name.trim(), arrivalDate, housing, mode: "personalized" }); };
  return <Modal close={skip} label={tr(t, "profile:setupTitle")} className="setup-modal" dismissible={false}><div className="modal-icon"><Sparkles/></div><span className="eyebrow">{tr(t, "profile:setupEyebrow")}</span><h2>{tr(t, "profile:setupTitle")}</h2><p>{tr(t, "profile:setupBody")}</p><form onSubmit={handleSubmit}>
    <label className="field"><span>{tr(t, "profile:name")}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={tr(t, "profile:namePlaceholder")}/></label>
    <label className="field"><span>{tr(t, "profile:arrivalDate")}</span><input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)}/></label>
    <fieldset className="housing-options"><legend>{tr(t, "profile:housingType")}</legend><label className={housing === "dorm" ? "selected" : ""}><input type="radio" name="housing" value="dorm" checked={housing === "dorm"} onChange={() => setHousing("dorm")}/><House/><span><strong>{tr(t, "profile:dorm")}</strong></span></label><label className={housing === "off-campus" ? "selected" : ""}><input type="radio" name="housing" value="off-campus" checked={housing === "off-campus"} onChange={() => setHousing("off-campus")}/><MapPin/><span><strong>{tr(t, "profile:offCampus")}</strong></span></label></fieldset>
    {error && <p className="error-text" role="alert">{tr(t, "validation:requiredFields")}</p>}
    <button className="primary full" type="submit">{tr(t, "profile:create")}<ArrowRight size={18}/></button><button className="skip-button" type="button" onClick={skip}>{tr(t, "profile:skip")}</button>
  </form><span className="setup-language-note"><Languages size={14}/>{tr(t, "profile:languageNote")}</span></Modal>;
}

function VerificationModal({ locale, t, profile, email, setEmail, verified, verifyError, close, verify }: { locale: Locale; t: TFunction; profile: UserProfile; email: string; setEmail: (value: string) => void; verified: boolean; verifyError: boolean; close: () => void; verify: () => void }) {
  return <Modal close={close} label={tr(t, "verification:title")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon verify"><ShieldCheck/></div><h2>{tr(t, "verification:title")}</h2><p>{tr(t, "verification:body")}</p><div className="profile-summary"><strong>{profile.name}</strong><span><CalendarDays size={15}/>{tr(t, "profile:arrival")}: {profile.arrivalDate ? formatDate(locale, profile.arrivalDate) : tr(t, "profile:demoArrival")}</span><span><House size={15}/>{tr(t, "profile:housing")}: {tr(t, profile.housing === "dorm" ? "profile:dorm" : "profile:offCampus")}</span></div>{verified ? <div className="verified-success"><BadgeCheck/><div><strong>{tr(t, "common:verified")}</strong><span>{tr(t, "verification:success")}</span></div></div> : <><label className="field"><span>{tr(t, "verification:email")}</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder={tr(t, "verification:emailPlaceholder")}/></label>{verifyError && <p className="error-text">{tr(t, "validation:validEmail")}</p>}<button className="primary full" onClick={verify}>{tr(t, "verification:submit")}<ArrowRight size={18}/></button></>}</Modal>;
}

function AuthModal({ locale, t, close, configured }: { locale: Locale; t: TFunction; close: () => void; configured: boolean }) {
  const [step, setStep] = useState<"email" | "sent">("email"); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [errorKey, setErrorKey] = useState<string | null>(null); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [cooldown]);
  const send = async () => { if (!isKuEmail(email)) { setErrorKey("validation:validEmail"); return; } setBusy(true); setErrorKey(null); try { setEmail(await sendEmailOtp(email, locale)); setStep("sent"); setCooldown(60); } catch (error) { setErrorKey(mapServiceError(error)); } finally { setBusy(false); } };
  return <Modal close={close} label={tr(t, "verification:authTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon verify"><ShieldCheck/></div><h2>{tr(t, "verification:authTitle")}</h2><p>{tr(t, step === "sent" ? "verification:linkSent" : "verification:authBody")}</p>{!configured ? <div className="configuration-warning" role="alert">{tr(t, "errors:supabaseNotConfigured")}</div> : step === "email" ? <><label className="field"><span>{tr(t, "verification:email")}</span><input autoFocus value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder={tr(t, "verification:emailPlaceholder")}/></label><button className="primary full" disabled={busy} onClick={() => void send()}>{tr(t, busy ? "verification:sending" : "verification:sendCode")}</button></> : <><div className="auth-email"><span>{email}</span><button onClick={() => { setStep("email"); setErrorKey(null); }}>{tr(t, "verification:changeEmail")}</button></div><p>{tr(t, "verification:openLink")}</p><button className="skip-button" disabled={busy || cooldown > 0} onClick={() => void send()}>{cooldown ? tr(t, "verification:resendCooldown", { seconds: cooldown }) : tr(t, "verification:resend")}</button></>}{errorKey && <p className="error-text" role="alert">{tr(t, errorKey)}</p>}<p className="auth-security-note">{tr(t, "verification:securityNote")}</p></Modal>;
}

function AccountModal({ t, user, profile, taskCount, listingCount, close, save, signout, openDelete }: { t: TFunction; user: User; profile: UserProfile; taskCount: number; listingCount: number; close: () => void; save: (profile: UserProfile) => void; signout: () => void; openDelete: () => void }) {
  const [name, setName] = useState(profile.name); const [arrivalDate, setArrivalDate] = useState(profile.arrivalDate); const [housing, setHousing] = useState<Housing>(profile.housing);
  return <Modal close={close} label={tr(t, "profile:accountTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon verify"><BadgeCheck/></div><h2>{tr(t, "profile:accountTitle")}</h2><span className="verified-badge"><BadgeCheck size={15}/>{tr(t, "verification:verifiedKu")}</span><div className="import-summary"><span><strong>{taskCount}</strong>{tr(t, "profile:accountTasks")}</span><span><strong>{listingCount}</strong>{tr(t, "profile:accountListings")}</span></div><label className="field"><span>{tr(t, "verification:email")}</span><input value={user.email ?? ""} readOnly/></label><label className="field"><span>{tr(t, "profile:name")}</span><input value={name} onChange={(event) => setName(event.target.value)}/></label><label className="field"><span>{tr(t, "profile:arrivalDate")}</span><input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)}/></label><label className="field"><span>{tr(t, "profile:housingType")}</span><select value={housing} onChange={(event) => setHousing(event.target.value as Housing)}><option value="dorm">{tr(t, "profile:dorm")}</option><option value="off-campus">{tr(t, "profile:offCampus")}</option></select></label><button className="primary full" onClick={() => save({ name, arrivalDate, housing, mode: "personalized" })}>{tr(t, "profile:save")}</button><div className="account-actions"><button className="secondary" onClick={signout}>{tr(t, "verification:signOut")}</button><button className="danger-link" onClick={openDelete}>{tr(t, "profile:deleteAccount")}</button></div></Modal>;
}

function GuestImportModal({ t, candidate, close, confirm }: { t: TFunction; candidate: { profile: UserProfile; done: string[]; products: MarketProduct[] }; close: () => void; confirm: () => void }) {
  return <Modal close={close} label={tr(t, "profile:importTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon"><PackageCheck/></div><h2>{tr(t, "profile:importTitle")}</h2><p>{tr(t, "profile:importBody")}</p><div className="import-summary"><span><strong>{candidate.profile.name}</strong>{tr(t, "profile:importProfile")}</span><span><strong>{candidate.done.length}</strong>{tr(t, "profile:importTasks")}</span><span><strong>{candidate.products.length}</strong>{tr(t, "profile:importProducts")}</span></div><div className="modal-actions"><button className="secondary" onClick={close}>{tr(t, "profile:notNow")}</button><button className="primary" onClick={confirm}>{tr(t, "profile:importConfirm")}</button></div></Modal>;
}

function DeleteAccountModal({ t, email, close, confirm }: { t: TFunction; email: string; close: () => void; confirm: () => void }) {
  const [step, setStep] = useState(1); const [typed, setTyped] = useState("");
  return <Modal close={close} label={tr(t, "profile:deleteTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon reset"><RotateCcw/></div><h2>{tr(t, "profile:deleteTitle")}</h2><p>{tr(t, "profile:deleteBody")}</p><ul className="delete-list"><li>{tr(t, "profile:deleteProfile")}</li><li>{tr(t, "profile:deleteProgress")}</li><li>{tr(t, "profile:deleteListings")}</li></ul>{step === 2 && <label className="field"><span>{tr(t, "profile:typeEmail")}</span><input autoFocus value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={email}/></label>}<div className="modal-actions"><button className="secondary" onClick={close}>{tr(t, "common:cancel")}</button>{step === 1 ? <button className="danger-button" onClick={() => setStep(2)}>{tr(t, "profile:continueDelete")}</button> : <button className="danger-button" disabled={typed.trim().toLowerCase() !== email.toLowerCase()} onClick={confirm}>{tr(t, "profile:deleteForever")}</button>}</div></Modal>;
}

function ResetModal({ t, close, confirm }: { t: TFunction; close: () => void; confirm: () => void }) {
  return <Modal close={close} label={tr(t, "reset:title")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon reset"><RotateCcw/></div><h2>{tr(t, "reset:title")}</h2><p>{tr(t, "reset:body")}</p><div className="modal-actions"><button className="secondary" onClick={close}>{tr(t, "common:cancel")}</button><button className="danger-button" onClick={confirm}>{tr(t, "reset:confirm")}</button></div></Modal>;
}

function PublicInfoModal({ page, close }: { page: "about" | "terms" | "privacy" | "safety" | "sources" | "disclaimer"; close: () => void }) {
  const content = {
    about: ["About KU Settle", "A student-built prototype for organizing arrival-to-departure information. It is not an official Korea University service."],
    terms: ["Terms of use — draft", "Use this information as a starting point and confirm important decisions with official sources. This draft has not received legal review."],
    privacy: ["Privacy notice — draft", "Guest and Demo data is stored in this browser. Authentication-related data is not used in this release. Future account features require a separate policy update."],
    safety: ["Marketplace safety", "Meet in a safe public place, inspect items before payment, and do not share financial or identity details through this prototype."],
    sources: ["Information sources and correction policy", "Official sources are identified on Life Guide articles. Sample Local Guide cards are not verified recommendations. Corrections are saved locally until reporting is available."],
    disclaimer: ["Disclaimer", "KU Settle does not provide legal, immigration, medical, financial, or university-authoritative advice. Confirm current information with the responsible official organization."]
  }[page];
  return <Modal close={close} label={content[0]}><button className="modal-close" onClick={close} aria-label="Close"><X/></button><h2>{content[0]}</h2><p>{content[1]}</p></Modal>;
}

function ProductEditModal({ locale, t, product, close, save }: { locale: Locale; t: TFunction; product: MarketProduct; close: () => void; save: (product: MarketProduct) => void }) {
  const [name, setName] = useState(product.name ?? ""); const [description, setDescription] = useState(product.description ?? ""); const [price, setPrice] = useState(String(product.priceKrw)); const [pickup, setPickup] = useState(product.pickup ?? ""); const [hours, setHours] = useState(product.availableHours ?? ""); const [imageDataUrl, setImageDataUrl] = useState(product.imageDataUrl ?? ""); const [error, setError] = useState<string | null>(null);
  const submit = () => { const next = { ...product, name: name.trim(), description: description.trim(), priceKrw: Number(price.trim()), pickup: pickup.trim(), availableHours: hours.trim(), imageDataUrl }; const validation = validateMarketplaceInput(next); if (!validation.valid) { setError(validation.error); return; } save(next); };
  return <Modal close={close} label={locale === "ko" ? "상품 수정" : "Edit listing"}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><h2>{locale === "ko" ? "상품 수정" : locale === "ja" ? "商品を編集" : locale === "zh-CN" ? "编辑商品" : "Edit listing"}</h2><label className="field"><span>{locale === "ko" ? "상품명" : "Item name"}</span><input value={name} onChange={(e) => setName(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "설명" : "Description"}</span><textarea value={description} onChange={(e) => setDescription(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "가격" : "Price"}</span><input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "픽업 장소" : "Pickup"}</span><input value={pickup} onChange={(e) => setPickup(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "거래 가능 시간" : "Available hours"}</span><input value={hours} onChange={(e) => setHours(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "상품 이미지" : "Product image"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void compressImage(file).then(setImageDataUrl).catch((error) => setError(error instanceof Error ? error.message : "errors:imageInvalid")); e.currentTarget.value = ""; }}/>{imageDataUrl && <><img className="listing-image-preview" src={imageDataUrl} alt=""/><button type="button" className="skip-button" onClick={() => setImageDataUrl("")}><Trash2 size={14}/>{tr(t, "marketplace:removeImage")}</button></>}</label>{error && <p className="error-text" role="alert">{tr(t, error)}</p>}<button className="primary full" onClick={submit}>{locale === "ko" ? "저장" : locale === "ja" ? "保存" : locale === "zh-CN" ? "保存" : "Save"}</button></Modal>;
}

function ProductModal({ locale, t, profile, mode, product: rawProduct, reservation, close, contact, changeStatus, reserve, cancelReservation, edit }: { locale: Locale; t: TFunction; profile: UserProfile; mode: ProductModalMode; product: MarketProduct; reservation?: import("./lib/local-data").LocalReservation; close: () => void; contact: () => void; reserve: () => void; cancelReservation: () => void; edit: () => void; changeStatus: (status: "active" | "sold" | "hidden" | "deleted") => void }) {
  const product = { ...rawProduct, ownedByCurrentUser: mode === "seller" }; const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t); const reservationLabel = reservation ? reservation.buyerName : "";
return <Modal close={close} label={name}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className={`modal-product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span></div><span className="seller"><SellerIcon size={16}/>{product.source === "live" ? tr(t, "common:verified") : product.source === "sample" ? tr(t, "common:sample") : tr(t, "common:demoData")}</span><h2>{name}</h2><strong className="modal-price">{formatCurrency(locale, product.priceKrw)}</strong>{product.imageDataUrl && <img className="modal-listing-image" src={product.imageDataUrl} alt={name}/>} {product.description && <p className="listing-description">{product.description}</p>} {product.availableHours && <p className="listing-hours">{product.availableHours}</p>}<div className="product-modal-details"><div><span>{tr(t, "marketplace:condition")}</span><strong>{tr(t, `marketplace:conditions.${product.condition}`)}</strong></div><div><span>{tr(t, "marketplace:pickup")}</span><strong><MapPin size={16}/>{productPickup(product, t)}</strong></div><div><span>{tr(t, "marketplace:seller")}</span><strong>{productSeller(product, t, profile)}</strong></div></div>{product.ownedByCurrentUser ? <div className="owner-listing-actions">{reservation && <div className="reservation-owner-note"><strong>{tr(t, "marketplace:reservationHolder")}</strong><span>{reservationLabel}</span><button className="secondary" onClick={cancelReservation}>{tr(t, "marketplace:cancelReservation")}</button></div>}<button className="secondary" onClick={edit}>{locale === "ko" ? "상품 수정" : locale === "ja" ? "商品を編集" : locale === "zh-CN" ? "编辑商品" : "Edit listing"}</button><button className="secondary" onClick={() => changeStatus(product.serviceStatus === "sold" ? "active" : "sold")}>{tr(t, product.serviceStatus === "sold" ? "marketplace:cancelSold" : "marketplace:markSold")}</button><button className="secondary" onClick={() => changeStatus(product.serviceStatus === "hidden" ? "active" : "hidden")}>{tr(t, product.serviceStatus === "hidden" ? "marketplace:showListing" : "marketplace:hideListing")}</button><button className="danger-link" onClick={() => changeStatus("deleted")}>{tr(t, "marketplace:deleteListing")}</button></div> : <div className="product-actions"><button className="primary full" disabled={product.serviceStatus === "sold"} onClick={product.status === "Reserved" ? cancelReservation : reserve}>{locale === "ko" ? (product.status === "Reserved" ? "예약 취소" : "예약하기") : locale === "ja" ? (product.status === "Reserved" ? "予約を取り消す" : "予約する") : locale === "zh-CN" ? (product.status === "Reserved" ? "取消预约" : "预约商品") : (product.status === "Reserved" ? "Cancel reservation" : "Reserve item")}</button><button className="secondary full" onClick={contact}><MessageCircle size={18}/>{tr(t, "marketplace:contact")}</button><button className="danger-link" onClick={() => window.localStorage.setItem(`ku-settle-market-report-${product.id}`, "draft")}>{locale === "ko" ? "상품 신고" : locale === "ja" ? "商品を報告" : locale === "zh-CN" ? "举报商品" : "Report listing"}</button></div>}</Modal>;
}

function ContactModal({ t, close }: { t: TFunction; close: () => void }) {
  const [ready, setReady] = useState(false);
  return <Modal close={close} label={tr(t, "marketplace:contactTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon"><MessageCircle/></div><h2>{tr(t, "marketplace:contactTitle")}</h2><p>{tr(t, "marketplace:contactBody")}</p><div className="message-preview">“{tr(t, "marketplace:message")}”</div><button className="primary full" onClick={() => setReady(true)}>{ready ? <Check/> : <MessageCircle/>}{tr(t, ready ? "marketplace:messageReady" : "marketplace:contact")}</button></Modal>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Search; text: string }) {
  return <div className="empty-state"><Icon/><p>{text}</p></div>;
}
