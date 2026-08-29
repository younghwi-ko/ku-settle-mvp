"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import type { TFunction } from "i18next";
import {
  ArrowRight, BadgeCheck, Banknote, BedDouble, Box, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleUserRound, Clock3, CookingPot, FileCheck2, GraduationCap, HeartPulse, Hospital, House, Languages, LampDesk,
  Lightbulb, MapPin, Menu, MessageCircle, PackageCheck, RotateCcw, Search, ShieldCheck, ShoppingBag, Sparkles, Store, BookOpen,
  Tag, Utensils, Vegan, X, Zap
} from "lucide-react";
import {
  lifecycleStages, places, products, tasks, lifeGuideArticles, type LifecycleStage, type MarketProduct, type PlaceCategory,
  type ProductCategory, type ProductCondition, type ProductIcon, type ProductStatus, type Task, type TaskAction,
  type TranslationKey
} from "./data";
import {
  formatCurrency, formatDate, formatDistance, formatNumber, formatPercent, localeNames, supportedLocales,
  useAppI18n, type Locale
} from "./i18n";
import { getSupabaseClient, isSupabaseConfigured } from "./lib/supabase";
import { createMarketplaceItem, deleteAccount, importGuestData, loadAccount, saveProfile, saveProgress, sendEmailOtp, signOut, updateMarketplaceItemStatus } from "./lib/repository";
import { isKuEmail, mapServiceError, profileRowToStored, type AppMode, type ProfileRow, type StoredProfile } from "./lib/domain";
import { shouldShowVerifiedBadge } from "./lib/verification";
import { emptyPreferences, readLocalData, writeLocalData, type LocalPreferences } from "./lib/local-data";

type Page = "home" | "onboarding" | "marketplace" | "guide" | "life-guide";
type Housing = "dorm" | "off-campus";
type UserProfile = StoredProfile;
type MarketMode = "incoming" | "leaving";
type StageStat = { stage: (typeof lifecycleStages)[number]; completed: number; total: number; progress: number };
type NavigationIntent = { stage?: LifecycleStage; taskId?: string; highlight?: boolean; marketMode?: MarketMode; guideCategory?: string };

const storageKeys = {
  language: "ku-settle-language",
  checklist: "ku-settle-checklist",
  verified: "ku-settle-verified",
  profile: "ku-settle-profile",
  userProducts: "ku-settle-user-products"
  , importState: "ku-settle-guest-import-state", data: "ku-settle-local-data-v2"
} as const;
const demoProfile: UserProfile = { name: "Alex", arrivalDate: "", housing: "dorm", mode: "demo" };
const demoDone = ["housing-reserve", "sim-compare", "airport-route", "arrival-essentials", "dorm", "account", "courses"];
const productCategories: ProductCategory[] = ["Home", "Kitchen", "Electronics", "Bedding"];
const productConditions: ProductCondition[] = ["likeNew", "good", "used", "clean"];
const productIcons: Record<ProductIcon, typeof Box> = { cooking: CookingPot, lamp: LampDesk, bed: BedDouble, kettle: Zap, fan: Sparkles, box: Box };
const categoryIcons: Partial<Record<PlaceCategory, typeof Hospital>> = { Hospital, Halal: Utensils, Vegan, Pharmacy: HeartPulse, Cafe: Store, Grocery: ShoppingBag, Food: Utensils };
const categoryProductIcons: Record<ProductCategory, ProductIcon> = { Home: "box", Kitchen: "cooking", Electronics: "fan", Bedding: "bed" };

function tr(t: TFunction, key: string, options?: Record<string, unknown>) {
  return String(t(key, options));
}
function ui(locale: Locale, key: string) { const copy: Record<string, Record<Locale, string>> = { due: { en: "Due date", ko: "예정일", ja: "予定日", "zh-CN": "预定日期" }, note: { en: "Note", ko: "메모", ja: "メモ", "zh-CN": "备注" }, important: { en: "Important", ko: "중요", ja: "重要", "zh-CN": "重要" }, personal: { en: "Personal task", ko: "개인 작업", ja: "個人タスク", "zh-CN": "个人任务" }, add: { en: "Add personal task", ko: "개인 작업 추가", ja: "個人タスクを追加", "zh-CN": "添加个人任务" }, delete: { en: "Delete", ko: "삭제", ja: "削除", "zh-CN": "删除" }, hide: { en: "Hide completed", ko: "완료 작업 숨기기", ja: "完了済みを隠す", "zh-CN": "隐藏已完成" }, show: { en: "Show completed", ko: "완료 작업 보기", ja: "完了済みを表示", "zh-CN": "显示已完成" }, allDates: { en: "All dates", ko: "전체 날짜", ja: "すべての日付", "zh-CN": "所有日期" }, today: { en: "Today", ko: "오늘", ja: "今日", "zh-CN": "今天" }, week: { en: "This week", ko: "이번 주", ja: "今週", "zh-CN": "本周" }, none: { en: "No date", ko: "예정 없음", ja: "予定なし", "zh-CN": "无日期" } }; return copy[key]?.[locale] ?? key; }

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
      return [{ id: item.id, name: item.name, pickup: item.pickup, priceKrw: Math.round(item.priceKrw), category, condition: item.condition as ProductCondition, status, icon, userCreated: true }];
    }

    if (isLegacyBilingual(item.name) && isLegacyBilingual(item.pickup) && isLegacyBilingual(item.condition) && typeof item.price === "string") {
      const priceKrw = Number(item.price.replace(/[^0-9]/g, ""));
      if (!priceKrw) return [];
      return [{ id: item.id, name: item.name.en || item.name.ko, pickup: item.pickup.en || item.pickup.ko, priceKrw, category, condition: conditionFromLegacy(item.condition.en || item.condition.ko), status, icon, userCreated: true }];
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
      if (savedProducts) { try { loadedProducts = normalizeUserProducts(JSON.parse(savedProducts)).map((product) => ({ ...product, source: "demo" })); } catch { loadedProducts = []; } }
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
    writeLocalData(localStorage, storageKeys.data, { version: 2, profile, done, products: userProducts, verified, preferences: localPreferences });
  }, [done, hydrated, localPreferences, profile, userProducts, verified, appMode]);
  useEffect(() => {
    if (!highlightTaskId) return;
    const timer = window.setTimeout(() => setHighlightTaskId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightTaskId]);
  useEffect(() => {
    if (localeReady && hydrated) document.title = `KU Settle — ${tr(t, "navigation:brandTagline")}`;
  }, [hydrated, locale, localeReady, t]);

  const currentProfile = profile ?? { ...demoProfile, name: tr(t, "profile:guestName"), mode: "personalized" as const };
  const actualVerified = Boolean(authUser?.email_confirmed_at && authUser.email && isKuEmail(authUser.email));
  const showVerifiedBadge = shouldShowVerifiedBadge(appMode, actualVerified, verified);
  const activeTasks = useMemo(() => getActiveTasks(currentProfile.housing), [currentProfile.housing]);
  const completedCount = activeTasks.filter((task) => done.includes(task.id)).length;
  const progress = activeTasks.length ? Math.round((completedCount / activeTasks.length) * 100) : 0;
  const recommendedTask = activeTasks.find((task) => !done.includes(task.id)) ?? null;
  const stageStats = useMemo(() => getStageStats(activeTasks, done), [activeTasks, done]);
  const marketplaceProducts = useMemo(() => [...userProducts, ...products], [userProducts]);
  const navItems: { key: Page; icon: typeof GraduationCap; labelKey: string }[] = [
    { key: "home", icon: GraduationCap, labelKey: "navigation:home" },
    { key: "onboarding", icon: FileCheck2, labelKey: "navigation:onboarding" },
    { key: "life-guide", icon: BookOpen, labelKey: "navigation:lifeGuide" },
    { key: "marketplace", icon: ShoppingBag, labelKey: "navigation:marketplace" },
    { key: "guide", icon: MapPin, labelKey: "navigation:localGuide" }
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
    setProfile(null); setDone([]); setVerified(false); setUserProducts([]); setLocalPreferences(emptyPreferences()); setGuestCandidate(null); guestCandidateRef.current = null; setAppMode("guest"); setMarketSearch(""); setMarketCategory("All"); setMarketMode("incoming");
    setSelectedProduct(null); setContactOpen(false); setGuideCategory("All"); setSelectedStage("before-arrival"); setFocusTaskId(null); setHighlightTaskId(null);
    setResetOpen(false); setProfileOpen(false); setPage("home"); setSetupOpen(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeMarketplaceStatus = async (product: MarketProduct, status: "active" | "sold" | "hidden" | "deleted") => {
    if (appMode !== "authenticated" && product.userCreated && product.ownedByCurrentUser) {
      setUserProducts((current) => status === "deleted" || status === "hidden"
        ? current.filter((item) => item.id !== product.id)
        : current.map((item) => item.id === product.id ? { ...item, serviceStatus: status, status: status === "sold" ? "Reserved" : "Available" } : item));
      setSelectedProduct(null); setServiceMessage("common:saved");
      return;
    }
    if (!authUser || product.source !== "live" || !product.ownedByCurrentUser) return;
    setServerBusy(true);
    try {
      const updated = await updateMarketplaceItemStatus(String(product.id), status, authUser.id);
      setUserProducts((current) => status === "deleted" || status === "hidden" ? current.filter((item) => item.id !== product.id) : current.map((item) => item.id === product.id ? updated : item));
      setSelectedProduct(null); setServiceMessage("common:saved");
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
    setUserProducts((current) => current.map((item) => item.id === product.id ? { ...item, status: "Reserved" } : item));
    setSelectedProduct(null); setServiceMessage("common:saved");
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
        {page === "marketplace" && <Marketplace locale={locale} t={t} profile={currentProfile} appMode={appMode} products={marketplaceProducts} search={marketSearch} setSearch={setMarketSearch} category={marketCategory} setCategory={setMarketCategory} mode={marketMode} setMode={setMarketMode} addProduct={addMarketplaceProduct} selectProduct={setSelectedProduct}/>}
        {page === "life-guide" && <LifeGuide locale={locale} search={lifeGuideSearch} setSearch={setLifeGuideSearch} category={lifeGuideCategory} setCategory={setLifeGuideCategory} go={go}/>}
        {page === "guide" && <LocalGuide locale={locale} t={t} category={guideCategory} setCategory={setGuideCategory} search={guideSearch} setSearch={setGuideSearch} preferences={localPreferences} setPreferences={setLocalPreferences}/>}
      </main>

      <footer><div className="footer-brand"><span className="brand-mark small">KU</span><span><strong>KU Settle</strong><small>{tr(t, "common:copyright", { year: formatNumber(locale, new Date().getFullYear(), { useGrouping: false }) })}</small></span></div><div className="footer-actions"><span className="footer-notice">{tr(t, "navigation:footerNotice")}</span>{(["about", "terms", "privacy", "safety", "sources", "disclaimer"] as const).map((item) => <button key={item} onClick={() => setInfoPage(item)}>{item}</button>)}{appMode !== "authenticated" && <button className="reset-demo" onClick={() => setResetOpen(true)}><RotateCcw size={13}/>{tr(t, "reset:button")}</button>}</div></footer>

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
        <ProductModal locale={locale} t={t} profile={currentProfile} product={selectedProduct} close={() => setSelectedProduct(null)} contact={() => { setSelectedProduct(null); setContactOpen(true); }} reserve={() => reserveMarketplaceProduct(selectedProduct)} changeStatus={(status) => void changeMarketplaceStatus(selectedProduct, status)}/>
      )}
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
  const [customTitle, setCustomTitle] = useState(""); const [customDate, setCustomDate] = useState(""); const [customNote, setCustomNote] = useState("");
  const selectedTasks = useMemo(() => activeTasks.filter((task) => task.stage === selectedStage), [activeTasks, selectedStage]);
  const visibleTasks = selectedTasks.filter((task) => { const due = preferences.dueDates[task.id] ?? ""; if (preferences.hiddenCompleted && done.includes(task.id)) return false; if (dateFilter === "none") return !due; const today = new Date().toLocaleDateString("en-CA"); if (dateFilter === "today") return due === today; if (dateFilter === "week") { const end = new Date(); end.setDate(end.getDate() + 7); return Boolean(due && due >= today && due <= end.toLocaleDateString("en-CA")); } return true; });
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
    <div className="chips"><button aria-pressed={preferences.hiddenCompleted} onClick={() => setPreferences((p) => ({ ...p, hiddenCompleted: !p.hiddenCompleted }))}>{preferences.hiddenCompleted ? ui(locale, "show") : ui(locale, "hide")}</button>{(["all", "today", "week", "none"] as const).map((item) => <button key={item} aria-pressed={dateFilter === item} onClick={() => setDateFilter(item)}>{ui(locale, item === "all" ? "allDates" : item)}</button>)}</div>
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

function Marketplace({ locale, t, profile, appMode, products: marketplaceProducts, search, setSearch, category, setCategory, mode, setMode, addProduct, selectProduct }: { locale: Locale; t: TFunction; profile: UserProfile; appMode: AppMode; products: MarketProduct[]; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; mode: MarketMode; setMode: (value: MarketMode) => void; addProduct: (product: MarketProduct) => Promise<void>; selectProduct: (product: MarketProduct) => void }) {
  const [success, setSuccess] = useState(false);
  const categories = ["All", ...productCategories];
  const categoryLabel = (value: string) => value === "All" ? tr(t, "marketplace:all") : tr(t, `marketplace:categories.${value}`);
  const filtered = useMemo(() => marketplaceProducts.filter((product) => (category === "All" || product.category === category) && productName(product, t).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))), [marketplaceProducts, category, search, locale, t]);
const changeMode = (nextMode: MarketMode) => { setMode(nextMode); setSuccess(false); };
  const completeListing = async (product: MarketProduct) => { await addProduct(product); setSearch(""); setCategory("All"); setMode("incoming"); setSuccess(true); };

  return <section className="page section-pad market-page">
<div className="page-hero market-hero"><div><span className="eyebrow"><ShoppingBag size={14}/>{tr(t, "marketplace:eyebrow")}</span><h1>{tr(t, "marketplace:title")}</h1><p>{tr(t, "marketplace:body")}</p></div><div className="mode-switch" aria-label={tr(t, "accessibility:marketMode")}><button aria-pressed={mode === "incoming"} className={mode === "incoming" ? "active" : ""} onClick={() => changeMode("incoming")}><ShoppingBag size={18}/>{tr(t, "marketplace:incoming")}</button><button aria-pressed={mode === "leaving"} className={mode === "leaving" ? "active" : ""} onClick={() => changeMode("leaving")}><Tag size={18}/>{tr(t, "marketplace:leaving")}</button></div><button className="primary market-list-cta" onClick={() => changeMode("leaving")}><Tag size={17}/>{tr(t, "marketplace:form.submit")}</button></div>
    <div className="market-flow">{(["verification", "listing", "pickup", "transaction"] as const).map((step, index) => <div key={step}><span>{index === 0 ? <BadgeCheck/> : index === 1 ? <ShoppingBag/> : index === 2 ? <MapPin/> : <Banknote/>}</span><strong>{tr(t, `marketplace:flow.${step}`)}</strong>{index < 3 && <ChevronRight/>}</div>)}</div>
    {mode === "leaving" ? !(["authenticated", "demo", "guest"] as AppMode[]).includes(appMode) ? <article className="listing-form auth-gate"><ShieldCheck/><h2>{tr(t, "marketplace:authRequiredTitle")}</h2><p>{tr(t, "marketplace:authRequiredBody")}</p></article> : <ListingForm t={t} submit={completeListing}/> : <>
      {success && <div className="success-banner" role="status"><CheckCircle2 size={18}/>{tr(t, "marketplace:form.success")}</div>}
      <div className="filters"><label className="search-box"><Search size={19}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr(t, "marketplace:search")}/>{search && <button onClick={() => setSearch("")} aria-label={tr(t, "marketplace:clearSearch")}><X size={16}/></button>}</label><div className="chips">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div></div>
      {filtered.length ? <div className="product-grid">{filtered.map((product) => {
        const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t);
        return <button className="product-card" key={product.id} aria-label={tr(t, "accessibility:productDetails", { product: name })} onClick={() => selectProduct(product)}><div className={`product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span><span className="source-pill">{tr(t, product.source === "live" ? "common:liveData" : product.source === "demo" ? "common:demoData" : "common:sampleData")}</span></div><div className="product-info"><div><h2>{name}</h2><strong className="price">{formatCurrency(locale, product.priceKrw)}</strong></div><dl><div><dt>{tr(t, "marketplace:condition")}</dt><dd>{tr(t, `marketplace:conditions.${product.condition}`)}</dd></div><div><dt>{tr(t, "marketplace:pickup")}</dt><dd><MapPin size={14}/>{productPickup(product, t)}</dd></div></dl><span className="seller"><SellerIcon size={16}/>{productSeller(product, t, profile)}</span><span className="details-link">{tr(t, "marketplace:details")}<ArrowRight size={16}/></span></div></button>;
      })}</div> : <EmptyState icon={Search} text={tr(t, "marketplace:empty")}/>}
    </>}
  </section>;
}

function ListingForm({ t, submit }: { t: TFunction; submit: (product: MarketProduct) => Promise<void> }) {
  const [itemName, setItemName] = useState(""); const [description, setDescription] = useState(""); const [price, setPrice] = useState(""); const [category, setCategory] = useState<ProductCategory>("Home"); const [condition, setCondition] = useState<ProductCondition>("good"); const [pickup, setPickup] = useState(""); const [hours, setHours] = useState(""); const [imageDataUrl, setImageDataUrl] = useState(""); const [availability, setAvailability] = useState<ProductStatus>("Available"); const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemName.trim() || !price.trim() || !pickup.trim()) { setErrorKey("validation:requiredFields"); return; }
    const priceKrw = Number(price.replace(/[^0-9]/g, ""));
    if (!priceKrw) { setErrorKey("validation:positivePrice"); return; }
    setSaving(true);
    try { await submit({ id: `user-${Date.now()}`, name: itemName.trim(), description: description.trim(), priceKrw, category, condition, pickup: pickup.trim(), availableHours: hours.trim(), imageDataUrl, status: availability, icon: categoryProductIcons[category], userCreated: true }); setItemName(""); setDescription(""); setPrice(""); setPickup(""); setHours(""); setImageDataUrl(""); setErrorKey(null); }
    catch { setErrorKey("errors:saveFailed"); } finally { setSaving(false); }
  };
  return <article className="listing-form"><div className="listing-heading"><span className="eyebrow"><PlusCircleIcon/>{tr(t, "marketplace:leaving")}</span><h2>{tr(t, "marketplace:form.title")}</h2><p>{tr(t, "marketplace:form.body")}</p></div><form onSubmit={handleSubmit} className="listing-grid">
    <label className="field"><span>{tr(t, "marketplace:form.itemName")}</span><input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={tr(t, "marketplace:form.itemPlaceholder")}/></label>
    <label className="field field-wide"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3}/></label>
    <label className="field"><span>{tr(t, "marketplace:form.price")}</span><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" placeholder={tr(t, "marketplace:form.pricePlaceholder")}/></label>
    <label className="field"><span>{tr(t, "marketplace:form.category")}</span><select value={category} onChange={(event) => setCategory(event.target.value as ProductCategory)}>{productCategories.map((value) => <option key={value} value={value}>{tr(t, `marketplace:categories.${value}`)}</option>)}</select></label>
    <label className="field"><span>{tr(t, "marketplace:form.condition")}</span><select value={condition} onChange={(event) => setCondition(event.target.value as ProductCondition)}>{productConditions.map((value) => <option key={value} value={value}>{tr(t, `marketplace:conditions.${value}`)}</option>)}</select></label>
    <label className="field field-wide"><span>{tr(t, "marketplace:form.pickup")}</span><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder={tr(t, "marketplace:form.pickupPlaceholder")}/></label>
    <label className="field"><span>Available hours</span><input value={hours} onChange={(event) => setHours(event.target.value)} placeholder="10:00–18:00"/></label>
    <label className="field field-wide"><span>Product image</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setImageDataUrl(String(reader.result)); reader.readAsDataURL(file); }}/>{imageDataUrl && <img className="listing-image-preview" src={imageDataUrl} alt="Selected product"/>}</label>
    <label className="field"><span>{tr(t, "marketplace:form.availability")}</span><select value={availability} onChange={(event) => setAvailability(event.target.value as ProductStatus)}><option value="Available">{tr(t, "common:available")}</option><option value="Reserved">{tr(t, "common:reserved")}</option></select></label>
    {errorKey && <p className="error-text form-error" role="alert">{tr(t, errorKey)}</p>}<button className="primary listing-submit" type="submit" disabled={saving}><ShoppingBag size={18}/>{tr(t, saving ? "common:saving" : "marketplace:form.submit")}</button>
  </form></article>;
}

function PlusCircleIcon() { return <Tag size={14}/>; }

function LocalGuide({ locale, t, category, setCategory, search, setSearch, preferences, setPreferences }: { locale: Locale; t: TFunction; category: string; setCategory: (value: string) => void; search: string; setSearch: (value: string) => void; preferences: import("./lib/local-data").LocalPreferences; setPreferences: Dispatch<SetStateAction<import("./lib/local-data").LocalPreferences>> }) {
  const categories: Array<"All" | PlaceCategory> = ["All", "Food", "Halal", "Vegan", "Hospital", "Pharmacy", "Hair Salon", "Cafe", "Grocery"];
  const categoryLabel = (value: string) => value === "All" ? tr(t, "localGuide:all") : tr(t, `localGuide:categories.${value}`);
  const filtered = places.filter((place) => (category === "All" || place.category === category || (category === "Food" && ["Halal", "Vegan"].includes(place.category))) && `${tr(t, place.nameKey)} ${tr(t, place.descriptionKey)}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  return <section className="page section-pad guide-page"><div className="page-hero"><div><span className="eyebrow"><MapPin size={14}/>{tr(t, "localGuide:eyebrow")}</span><h1>{tr(t, "localGuide:title")}</h1><p>{tr(t, "localGuide:body")}</p></div><div className="guide-visual"><span><MapPin/></span><i/><b>KU</b><i/><span><Utensils/></span></div></div>
    <label className="search-field"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "ko" ? "장소 검색" : "Search places"}/></label><div className="chips guide-chips">{categories.map((item) => <button key={item} aria-pressed={category === item} aria-label={tr(t, "accessibility:placeCategory", { category: categoryLabel(item) })} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div>
    {filtered.length ? <div className="place-grid">{filtered.map((place) => { const Icon = categoryIcons[place.category] || MapPin; const favorite = preferences.placeFavorites.includes(place.id); const reportKey = String(place.id); return <article className="place-card" key={place.id}><div className="place-top"><span className="place-icon"><Icon/></span><span className="demo-pill">{tr(t, "common:demoData")}</span><button aria-pressed={favorite} onClick={() => setPreferences((p) => ({ ...p, placeFavorites: favorite ? p.placeFavorites.filter((id) => id !== place.id) : [...p.placeFavorites, place.id] }))}>{favorite ? "★" : "☆"}</button></div><span className="place-category">{categoryLabel(place.category)}</span><h2>{tr(t, place.nameKey)}</h2><p>{tr(t, place.descriptionKey)}</p><div className="place-meta"><span className="no"><MessageCircle size={16}/>{locale === "ko" ? "언어 지원은 업체 문의 필요" : "Ask the provider about language support"}</span><span><MapPin size={16}/>{tr(t, place.locationKey)} · {tr(t, "localGuide:distanceFromKu", { distance: formatDistance(locale, place.distanceMeters) })}</span></div><div className="student-tip"><Lightbulb size={17}/><div><strong>{tr(t, "localGuide:studentTip")}</strong><p>{tr(t, place.tipKey)}</p></div></div><label className="field"><span>{locale === "ko" ? "정보 수정 제보 초안(외부 전송 안 됨)" : "Correction draft (not sent externally)"}</span><input value={preferences.reports[reportKey] ?? ""} onChange={(e) => setPreferences((p) => ({ ...p, reports: { ...p.reports, [reportKey]: e.target.value } }))}/></label></article>; })}</div> : <EmptyState icon={MapPin} text={tr(t, "localGuide:empty")}/>}
  </section>;
}

function LifeGuide({ locale, search, setSearch, category, setCategory, go }: { locale: Locale; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; go: (page: Page, intent?: NavigationIntent) => void }) {
  const labels: Record<string, string> = locale === "ko" ? { All: "전체", housing: "주거", arrival: "입국·교통", immigration: "체류·행정", "mobile-banking": "통신·은행", academic: "학사생활", healthcare: "의료·응급", daily: "일상생활", departure: "귀국 준비" } : locale === "ja" ? { All: "すべて", housing: "住居", arrival: "入国・交通", immigration: "在留・行政", "mobile-banking": "通信・銀行", academic: "学業生活", healthcare: "医療・緊急", daily: "日常生活", departure: "帰国準備" } : locale === "zh-CN" ? { All: "全部", housing: "住房", arrival: "入境·交通", immigration: "居留·行政", "mobile-banking": "通信·银行", academic: "学业生活", healthcare: "医疗·紧急", daily: "日常生活", departure: "回国准备" } : { All: "All", housing: "Housing", arrival: "Arrival & Transportation", immigration: "Immigration", "mobile-banking": "Mobile & Banking", academic: "Academic Life", healthcare: "Healthcare & Emergency", daily: "Daily Life", departure: "Departure" };
  const filtered = lifeGuideArticles.filter((article) => (category === "All" || article.category === category) && `${article.title} ${article.summary}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  return <section className="page section-pad"><div className="page-hero"><div><span className="eyebrow"><BookOpen size={14}/> {labels["life-guide"] ?? "Life Guide"}</span><h1>{locale === "ko" ? "생활 가이드" : locale === "ja" ? "生活ガイド" : locale === "zh-CN" ? "生活指南" : "Life Guide"}</h1><p>{locale === "ko" ? "공식 정보를 찾고 확인할 수 있는 생활정보 허브입니다." : "Find, check, and save practical information from official sources."}</p></div></div><label className="search-field"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "ko" ? "제목 또는 본문 검색" : "Search title or content"}/></label><div className="chips">{["All", ...Object.keys(labels).filter((key) => key !== "All")].map((key) => <button key={key} aria-pressed={category === key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{labels[key]}</button>)}</div>{filtered.length ? <div className="guide-article-grid">{filtered.map((article) => { const translated = article.locales[locale]; return <article className="guide-article" key={article.id}><span className="source-pill">{article.verificationStatus === "official" ? (locale === "ko" ? "공식" : "Official") : "Demo"}</span><span className="place-category">{labels[article.category]}</span><h2>{translated?.title ?? article.title}</h2><p>{translated?.summary ?? article.summary}</p><div className="article-meta"><span>{article.sourceName}</span><span>{article.lastVerifiedAt}</span></div><p>{translated?.content ?? article.content}</p><ul>{article.checklist.map((item) => <li key={item}>{item}</li>)}</ul>{article.relatedTaskIds[0] && <button className="task-action" onClick={() => go("onboarding", { taskId: article.relatedTaskIds[0], highlight: true })}>{locale === "ko" ? "관련 lifecycle 작업 보기" : "View related lifecycle task"}<ArrowRight size={15}/></button>}<a className="task-action" href={article.officialUrl} target="_blank" rel="noopener noreferrer">{locale === "ko" ? "공식 출처 열기" : "Open official source"}<ArrowRight size={15}/></a></article>})}</div> : <EmptyState icon={BookOpen} text={locale === "ko" ? "검색 결과가 없습니다." : "No guides found."}/>}</section>;
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

function ProductModal({ locale, t, profile, product, close, contact, changeStatus, reserve }: { locale: Locale; t: TFunction; profile: UserProfile; product: MarketProduct; close: () => void; contact: () => void; reserve: () => void; changeStatus: (status: "active" | "sold" | "hidden" | "deleted") => void }) {
  const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t);
return <Modal close={close} label={name}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className={`modal-product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span></div><span className="seller"><SellerIcon size={16}/>{product.source === "live" ? tr(t, "common:verified") : product.source === "sample" ? tr(t, "common:sample") : tr(t, "common:demoData")}</span><h2>{name}</h2><strong className="modal-price">{formatCurrency(locale, product.priceKrw)}</strong>{product.imageDataUrl && <img className="modal-listing-image" src={product.imageDataUrl} alt={name}/>} {product.description && <p className="listing-description">{product.description}</p>} {product.availableHours && <p className="listing-hours">{product.availableHours}</p>}<div className="product-modal-details"><div><span>{tr(t, "marketplace:condition")}</span><strong>{tr(t, `marketplace:conditions.${product.condition}`)}</strong></div><div><span>{tr(t, "marketplace:pickup")}</span><strong><MapPin size={16}/>{productPickup(product, t)}</strong></div><div><span>{tr(t, "marketplace:seller")}</span><strong>{productSeller(product, t, profile)}</strong></div></div>{product.ownedByCurrentUser ? <div className="owner-listing-actions"><button className="secondary" onClick={() => changeStatus(product.serviceStatus === "sold" ? "active" : "sold")}>{tr(t, product.serviceStatus === "sold" ? "marketplace:markActive" : "marketplace:markSold")}</button><button className="secondary" onClick={() => changeStatus("hidden")}>{tr(t, "marketplace:hideListing")}</button><button className="danger-link" onClick={() => changeStatus("deleted")}>{tr(t, "marketplace:deleteListing")}</button></div> : <div className="product-actions"><button className="primary full" disabled={product.status === "Reserved"} onClick={reserve}>{product.status === "Reserved" ? "Reserved" : "Reserve item"}</button><button className="secondary full" onClick={contact}><MessageCircle size={18}/>{tr(t, "marketplace:contact")}</button><button className="danger-link" onClick={() => window.localStorage.setItem(`ku-settle-market-report-${product.id}`, "draft")}>Report listing</button></div>}</Modal>;
}

function ContactModal({ t, close }: { t: TFunction; close: () => void }) {
  const [ready, setReady] = useState(false);
  return <Modal close={close} label={tr(t, "marketplace:contactTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon"><MessageCircle/></div><h2>{tr(t, "marketplace:contactTitle")}</h2><p>{tr(t, "marketplace:contactBody")}</p><div className="message-preview">“{tr(t, "marketplace:message")}”</div><button className="primary full" onClick={() => setReady(true)}>{ready ? <Check/> : <MessageCircle/>}{tr(t, ready ? "marketplace:messageReady" : "marketplace:contact")}</button></Modal>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Search; text: string }) {
  return <div className="empty-state"><Icon/><p>{text}</p></div>;
}
