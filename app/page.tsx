"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import {
  ArrowRight, BadgeCheck, Banknote, BedDouble, Box, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleUserRound, Clock3, CookingPot, FileCheck2, GraduationCap, HeartPulse, Hospital, House, Languages, LampDesk,
  Lightbulb, MapPin, Menu, MessageCircle, PackageCheck, RotateCcw, Search, ShieldCheck, ShoppingBag, Sparkles, Store,
  Tag, Utensils, Vegan, X, Zap
} from "lucide-react";
import {
  lifecycleStages, places, products, tasks, type LifecycleStage, type MarketProduct, type PlaceCategory,
  type ProductCategory, type ProductCondition, type ProductIcon, type ProductStatus, type Task, type TaskAction,
  type TranslationKey
} from "./data";
import {
  formatCurrency, formatDate, formatDistance, formatNumber, formatPercent, localeNames, supportedLocales,
  useAppI18n, type Locale
} from "./i18n";

type Page = "home" | "onboarding" | "marketplace" | "guide";
type Housing = "dorm" | "off-campus";
type ProfileMode = "personalized" | "demo";
type UserProfile = { name: string; arrivalDate: string; housing: Housing; mode: ProfileMode };
type MarketMode = "incoming" | "leaving";
type StageStat = { stage: (typeof lifecycleStages)[number]; completed: number; total: number; progress: number };
type NavigationIntent = { stage?: LifecycleStage; taskId?: string; highlight?: boolean; marketMode?: MarketMode; guideCategory?: string };

const storageKeys = {
  language: "ku-settle-language",
  checklist: "ku-settle-checklist",
  verified: "ku-settle-verified",
  profile: "ku-settle-profile",
  userProducts: "ku-settle-user-products"
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
  return product.userCreated ? tr(t, "marketplace:userSeller", { name: profile.name }) : tr(t, product.sellerKey as TranslationKey);
}

export default function Home() {
  const { t, locale, changeLocale } = useAppI18n();
  const [page, setPage] = useState<Page>("home");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [userProducts, setUserProducts] = useState<MarketProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
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
  const [email, setEmail] = useState("student@korea.ac.kr");
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const savedProfile = localStorage.getItem(storageKeys.profile);
      const savedDone = localStorage.getItem(storageKeys.checklist);
      const savedProducts = localStorage.getItem(storageKeys.userProducts);
      const loadedProfile = savedProfile ? (() => { try { return normalizeProfile(JSON.parse(savedProfile)); } catch { return null; } })() : null;
      if (loadedProfile) {
        setProfile(loadedProfile);
        const fallback = loadedProfile.mode === "demo" ? demoDone : [];
        try { setDone(normalizeDone(savedDone ? JSON.parse(savedDone) : null, getActiveTasks(loadedProfile.housing), fallback)); } catch { setDone(fallback); }
      } else {
        setDone([]);
        setSetupOpen(true);
      }
      if (savedProducts) { try { setUserProducts(normalizeUserProducts(JSON.parse(savedProducts))); } catch { setUserProducts([]); } }
      setVerified(localStorage.getItem(storageKeys.verified) === "true");
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem(storageKeys.checklist, JSON.stringify(done)); }, [done, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(storageKeys.verified, String(verified)); }, [verified, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(storageKeys.userProducts, JSON.stringify(userProducts)); }, [userProducts, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (profile) localStorage.setItem(storageKeys.profile, JSON.stringify(profile));
    else localStorage.removeItem(storageKeys.profile);
  }, [profile, hydrated]);
  useEffect(() => {
    if (!highlightTaskId) return;
    const timer = window.setTimeout(() => setHighlightTaskId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightTaskId]);
  useEffect(() => { document.title = `KU Settle — ${tr(t, "navigation:brandTagline")}`; }, [locale, t]);

  const currentProfile = profile ?? demoProfile;
  const activeTasks = useMemo(() => getActiveTasks(currentProfile.housing), [currentProfile.housing]);
  const completedCount = activeTasks.filter((task) => done.includes(task.id)).length;
  const progress = activeTasks.length ? Math.round((completedCount / activeTasks.length) * 100) : 0;
  const recommendedTask = activeTasks.find((task) => !done.includes(task.id)) ?? null;
  const stageStats = useMemo(() => getStageStats(activeTasks, done), [activeTasks, done]);
  const marketplaceProducts = useMemo(() => [...userProducts, ...products], [userProducts]);
  const navItems: { key: Page; icon: typeof GraduationCap; labelKey: string }[] = [
    { key: "home", icon: GraduationCap, labelKey: "navigation:home" },
    { key: "onboarding", icon: FileCheck2, labelKey: "navigation:onboarding" },
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
  const toggleTask = (id: string) => setDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const startPersonalizedPlan = (nextProfile: UserProfile) => {
    setProfile(nextProfile); setDone([]); setVerified(false); setSelectedStage("before-arrival"); setFocusTaskId(null); setHighlightTaskId(null); setSetupOpen(false);
  };
  const skipForDemo = () => { setProfile(demoProfile); setDone(demoDone); setVerified(false); setSelectedStage("first-weeks"); setSetupOpen(false); };
  const resetDemo = () => {
    [storageKeys.profile, storageKeys.checklist, storageKeys.verified, storageKeys.userProducts].forEach((key) => localStorage.removeItem(key));
    setProfile(null); setDone([]); setVerified(false); setUserProducts([]); setMarketSearch(""); setMarketCategory("All"); setMarketMode("incoming");
    setSelectedProduct(null); setContactOpen(false); setGuideCategory("All"); setSelectedStage("before-arrival"); setFocusTaskId(null); setHighlightTaskId(null);
    setResetOpen(false); setProfileOpen(false); setPage("home"); setSetupOpen(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
          <button className="profile-button" onClick={() => setProfileOpen(true)} aria-label={tr(t, "accessibility:profile")}>
            {verified ? <BadgeCheck size={20} className="verified-icon"/> : <CircleUserRound size={20}/>}<span>{currentProfile.name}</span>
          </button>
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={tr(t, menuOpen ? "navigation:closeMenu" : "navigation:openMenu")} aria-expanded={menuOpen}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label={tr(t, "navigation:mobileLabel")}>{navItems.map(({ key, labelKey, icon: Icon }) => <button key={key} onClick={() => go(key)} className={page === key ? "active" : ""}><Icon size={18}/>{tr(t, labelKey)}</button>)}</nav>}

      <main>
        {page === "home" && <Dashboard locale={locale} t={t} profile={currentProfile} activeTasks={activeTasks} stageStats={stageStats} progress={progress} completedCount={completedCount} recommendedTask={recommendedTask} go={go}/>}
        {page === "onboarding" && <Onboarding locale={locale} t={t} activeTasks={activeTasks} stageStats={stageStats} progress={progress} done={done} recommendedTask={recommendedTask} selectedStage={selectedStage} setSelectedStage={setSelectedStage} focusTaskId={focusTaskId} highlightTaskId={highlightTaskId} go={go} openTaskAction={openTaskAction} toggleTask={toggleTask}/>}
        {page === "marketplace" && <Marketplace locale={locale} t={t} profile={currentProfile} products={marketplaceProducts} search={marketSearch} setSearch={setMarketSearch} category={marketCategory} setCategory={setMarketCategory} mode={marketMode} setMode={setMarketMode} addProduct={(product) => setUserProducts((current) => [product, ...current])} selectProduct={setSelectedProduct}/>}
        {page === "guide" && <LocalGuide locale={locale} t={t} category={guideCategory} setCategory={setGuideCategory}/>}
      </main>

      <footer><div className="footer-brand"><span className="brand-mark small">KU</span><span><strong>KU Settle</strong><small>{tr(t, "common:copyright", { year: formatNumber(locale, new Date().getFullYear(), { useGrouping: false }) })}</small></span></div><div className="footer-actions"><span className="footer-notice">{tr(t, "navigation:footerNotice")}</span><button className="reset-demo" onClick={() => setResetOpen(true)}><RotateCcw size={13}/>{tr(t, "reset:button")}</button></div></footer>

      {setupOpen && <SetupModal t={t} submit={startPersonalizedPlan} skip={skipForDemo}/>}
      {resetOpen && <ResetModal t={t} close={() => setResetOpen(false)} confirm={resetDemo}/>}
      {profileOpen && <VerificationModal locale={locale} t={t} profile={currentProfile} email={email} setEmail={setEmail} verified={verified} verifyError={verifyError} close={() => setProfileOpen(false)} verify={() => { const ok = /^[^@\s]+@korea\.ac\.kr$/i.test(email); setVerifyError(!ok); if (ok) setVerified(true); }}/>}
      {selectedProduct && <ProductModal locale={locale} t={t} profile={currentProfile} product={selectedProduct} close={() => setSelectedProduct(null)} contact={() => { setSelectedProduct(null); setContactOpen(true); }}/>}
      {contactOpen && <ContactModal t={t} close={() => setContactOpen(false)}/>}
    </div>
  );
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

function Onboarding({ locale, t, activeTasks, stageStats, progress, done, recommendedTask, selectedStage, setSelectedStage, focusTaskId, highlightTaskId, go, openTaskAction, toggleTask }: { locale: Locale; t: TFunction; activeTasks: Task[]; stageStats: StageStat[]; progress: number; done: string[]; recommendedTask: Task | null; selectedStage: LifecycleStage; setSelectedStage: (stage: LifecycleStage) => void; focusTaskId: string | null; highlightTaskId: string | null; go: (page: Page, intent?: NavigationIntent) => void; openTaskAction: (action: TaskAction) => void; toggleTask: (id: string) => void }) {
  const taskRef = useRef<HTMLElement | null>(null);
  const selectedTasks = useMemo(() => activeTasks.filter((task) => task.stage === selectedStage), [activeTasks, selectedStage]);
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
    <div className="timeline-note"><Lightbulb size={20}/><span>{tr(t, "onboarding:recommendationHint")}</span>{recommendedTask && recommendedTask.stage !== selectedStage && <button onClick={() => go("onboarding", { stage: recommendedTask.stage, taskId: recommendedTask.id, highlight: true })}>{tr(t, "onboarding:viewNext")}<ArrowRight size={15}/></button>}</div>
    <div className="task-list">{selectedTasks.map((task, index) => {
      const isDone = done.includes(task.id); const isRecommended = !isDone && task.id === recommendedTask?.id; const isHighlighted = task.id === highlightTaskId; const title = tr(t, task.titleKey);
      return <article ref={task.id === focusTaskId ? taskRef : undefined} data-task-id={task.id} aria-current={isRecommended ? "step" : undefined} className={`task-card ${isRecommended ? "featured recommended" : ""} ${isHighlighted ? "attention-flash" : ""} ${isDone ? "is-done" : ""}`} key={task.id}>
        <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={tr(t, isDone ? "onboarding:markIncomplete" : "onboarding:markComplete", { task: title })}>{isDone && <Check size={18}/>}</button>
        <div className="task-main"><div className="task-title-row"><div><span className="task-category">{String(index + 1).padStart(2, "0")} · {tr(t, task.categoryKey)}</span><h2>{title}</h2></div><span className={`status ${isDone ? "complete" : isRecommended ? "progress" : ""}`}>{tr(t, isDone ? "common:completed" : isRecommended ? "common:inProgress" : "common:notStarted")}</span></div><p>{tr(t, task.descriptionKey)}</p>
          <div className="task-details"><div><span className="detail-label"><PackageCheck size={16}/>{tr(t, "onboarding:prepare")}</span><ul>{task.preparationKeys.map((key) => <li key={key}>{tr(t, key)}</li>)}</ul></div><div><span className="detail-label"><Clock3 size={16}/>{tr(t, "onboarding:estimatedTime")}</span><strong>{tr(t, "common:durationMinutes", { min: formatNumber(locale, task.estimatedMinutes[0]), max: formatNumber(locale, task.estimatedMinutes[1]) })}</strong></div><div className="tip"><span className="detail-label"><Lightbulb size={16}/>{tr(t, "onboarding:practicalNote")}</span><p>{tr(t, task.practicalNoteKey)}</p></div></div>
          {task.officialGuidance ? <div className="official-guidance"><div><span className="detail-label"><ShieldCheck size={16}/>{tr(t, "onboarding:officialGuidance")}</span><p>{tr(t, task.officialGuidance.messageKey)}</p></div><a href={task.officialGuidance.href} target="_blank" rel="noopener noreferrer">{tr(t, task.officialGuidance.actionLabelKey)}<ArrowRight size={14}/></a></div> : task.action && (task.action.kind === "external" ? <a className="task-action" href={task.action.href} target="_blank" rel="noopener noreferrer">{tr(t, task.action.actionLabelKey)}<ArrowRight size={15}/></a> : <button className="task-action" onClick={() => openTaskAction(task.action as TaskAction)}>{tr(t, task.action.actionLabelKey)}<ArrowRight size={15}/></button>)}
        </div>
      </article>;
    })}</div>
  </section>;
}

function Marketplace({ locale, t, profile, products: marketplaceProducts, search, setSearch, category, setCategory, mode, setMode, addProduct, selectProduct }: { locale: Locale; t: TFunction; profile: UserProfile; products: MarketProduct[]; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; mode: MarketMode; setMode: (value: MarketMode) => void; addProduct: (product: MarketProduct) => void; selectProduct: (product: MarketProduct) => void }) {
  const [success, setSuccess] = useState(false);
  const categories = ["All", ...productCategories];
  const categoryLabel = (value: string) => value === "All" ? tr(t, "marketplace:all") : tr(t, `marketplace:categories.${value}`);
  const filtered = useMemo(() => marketplaceProducts.filter((product) => (category === "All" || product.category === category) && productName(product, t).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))), [marketplaceProducts, category, search, locale, t]);
  const changeMode = (nextMode: MarketMode) => { setMode(nextMode); setSuccess(false); };
  const completeListing = (product: MarketProduct) => { addProduct(product); setSearch(""); setCategory("All"); setMode("incoming"); setSuccess(true); };

  return <section className="page section-pad market-page">
    <div className="page-hero market-hero"><div><span className="eyebrow"><ShoppingBag size={14}/>{tr(t, "marketplace:eyebrow")}</span><h1>{tr(t, "marketplace:title")}</h1><p>{tr(t, "marketplace:body")}</p></div><div className="mode-switch" aria-label={tr(t, "accessibility:marketMode")}><button aria-pressed={mode === "incoming"} className={mode === "incoming" ? "active" : ""} onClick={() => changeMode("incoming")}><ShoppingBag size={18}/>{tr(t, "marketplace:incoming")}</button><button aria-pressed={mode === "leaving"} className={mode === "leaving" ? "active" : ""} onClick={() => changeMode("leaving")}><Tag size={18}/>{tr(t, "marketplace:leaving")}</button></div></div>
    <div className="market-flow">{(["verification", "listing", "pickup", "transaction"] as const).map((step, index) => <div key={step}><span>{index === 0 ? <BadgeCheck/> : index === 1 ? <ShoppingBag/> : index === 2 ? <MapPin/> : <Banknote/>}</span><strong>{tr(t, `marketplace:flow.${step}`)}</strong>{index < 3 && <ChevronRight/>}</div>)}</div>
    {mode === "leaving" ? <ListingForm t={t} submit={completeListing}/> : <>
      {success && <div className="success-banner" role="status"><CheckCircle2 size={18}/>{tr(t, "marketplace:form.success")}</div>}
      <div className="filters"><label className="search-box"><Search size={19}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr(t, "marketplace:search")}/>{search && <button onClick={() => setSearch("")} aria-label={tr(t, "marketplace:clearSearch")}><X size={16}/></button>}</label><div className="chips">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div></div>
      {filtered.length ? <div className="product-grid">{filtered.map((product) => {
        const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t);
        return <button className="product-card" key={product.id} aria-label={tr(t, "accessibility:productDetails", { product: name })} onClick={() => selectProduct(product)}><div className={`product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span></div><div className="product-info"><div><h2>{name}</h2><strong className="price">{formatCurrency(locale, product.priceKrw)}</strong></div><dl><div><dt>{tr(t, "marketplace:condition")}</dt><dd>{tr(t, `marketplace:conditions.${product.condition}`)}</dd></div><div><dt>{tr(t, "marketplace:pickup")}</dt><dd><MapPin size={14}/>{productPickup(product, t)}</dd></div></dl><span className="seller"><SellerIcon size={16}/>{productSeller(product, t, profile)}</span><span className="details-link">{tr(t, "marketplace:details")}<ArrowRight size={16}/></span></div></button>;
      })}</div> : <EmptyState icon={Search} text={tr(t, "marketplace:empty")}/>}
    </>}
  </section>;
}

function ListingForm({ t, submit }: { t: TFunction; submit: (product: MarketProduct) => void }) {
  const [itemName, setItemName] = useState(""); const [price, setPrice] = useState(""); const [category, setCategory] = useState<ProductCategory>("Home"); const [condition, setCondition] = useState<ProductCondition>("good"); const [pickup, setPickup] = useState(""); const [availability, setAvailability] = useState<ProductStatus>("Available"); const [errorKey, setErrorKey] = useState<string | null>(null);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemName.trim() || !price.trim() || !pickup.trim()) { setErrorKey("validation:requiredFields"); return; }
    const priceKrw = Number(price.replace(/[^0-9]/g, ""));
    if (!priceKrw) { setErrorKey("validation:positivePrice"); return; }
    submit({ id: `user-${Date.now()}`, name: itemName.trim(), priceKrw, category, condition, pickup: pickup.trim(), status: availability, icon: categoryProductIcons[category], userCreated: true });
    setItemName(""); setPrice(""); setPickup(""); setErrorKey(null);
  };
  return <article className="listing-form"><div className="listing-heading"><span className="eyebrow"><PlusCircleIcon/>{tr(t, "marketplace:leaving")}</span><h2>{tr(t, "marketplace:form.title")}</h2><p>{tr(t, "marketplace:form.body")}</p></div><form onSubmit={handleSubmit} className="listing-grid">
    <label className="field"><span>{tr(t, "marketplace:form.itemName")}</span><input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={tr(t, "marketplace:form.itemPlaceholder")}/></label>
    <label className="field"><span>{tr(t, "marketplace:form.price")}</span><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" placeholder={tr(t, "marketplace:form.pricePlaceholder")}/></label>
    <label className="field"><span>{tr(t, "marketplace:form.category")}</span><select value={category} onChange={(event) => setCategory(event.target.value as ProductCategory)}>{productCategories.map((value) => <option key={value} value={value}>{tr(t, `marketplace:categories.${value}`)}</option>)}</select></label>
    <label className="field"><span>{tr(t, "marketplace:form.condition")}</span><select value={condition} onChange={(event) => setCondition(event.target.value as ProductCondition)}>{productConditions.map((value) => <option key={value} value={value}>{tr(t, `marketplace:conditions.${value}`)}</option>)}</select></label>
    <label className="field field-wide"><span>{tr(t, "marketplace:form.pickup")}</span><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder={tr(t, "marketplace:form.pickupPlaceholder")}/></label>
    <label className="field"><span>{tr(t, "marketplace:form.availability")}</span><select value={availability} onChange={(event) => setAvailability(event.target.value as ProductStatus)}><option value="Available">{tr(t, "common:available")}</option><option value="Reserved">{tr(t, "common:reserved")}</option></select></label>
    {errorKey && <p className="error-text form-error" role="alert">{tr(t, errorKey)}</p>}<button className="primary listing-submit" type="submit"><ShoppingBag size={18}/>{tr(t, "marketplace:form.submit")}</button>
  </form></article>;
}

function PlusCircleIcon() { return <Tag size={14}/>; }

function LocalGuide({ locale, t, category, setCategory }: { locale: Locale; t: TFunction; category: string; setCategory: (value: string) => void }) {
  const categories: Array<"All" | PlaceCategory> = ["All", "Food", "Halal", "Vegan", "Hospital", "Pharmacy", "Hair Salon", "Cafe", "Grocery"];
  const categoryLabel = (value: string) => value === "All" ? tr(t, "localGuide:all") : tr(t, `localGuide:categories.${value}`);
  const filtered = places.filter((place) => category === "All" || place.category === category || (category === "Food" && ["Halal", "Vegan"].includes(place.category)));
  return <section className="page section-pad guide-page"><div className="page-hero"><div><span className="eyebrow"><MapPin size={14}/>{tr(t, "localGuide:eyebrow")}</span><h1>{tr(t, "localGuide:title")}</h1><p>{tr(t, "localGuide:body")}</p></div><div className="guide-visual"><span><MapPin/></span><i/><b>KU</b><i/><span><Utensils/></span></div></div>
    <div className="chips guide-chips">{categories.map((item) => <button key={item} aria-pressed={category === item} aria-label={tr(t, "accessibility:placeCategory", { category: categoryLabel(item) })} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div>
    {filtered.length ? <div className="place-grid">{filtered.map((place) => { const Icon = categoryIcons[place.category] || MapPin; return <article className="place-card" key={place.id}><div className="place-top"><span className="place-icon"><Icon/></span><span className="demo-pill">{tr(t, "common:demoData")}</span></div><span className="place-category">{categoryLabel(place.category)}</span><h2>{tr(t, place.nameKey)}</h2><p>{tr(t, place.descriptionKey)}</p><div className="place-meta"><span className={place.english ? "yes" : "no"}><MessageCircle size={16}/>{tr(t, "localGuide:englishAvailable")} {place.english ? <Check size={14}/> : "—"}</span><span><MapPin size={16}/>{tr(t, place.locationKey)} · {tr(t, "localGuide:distanceFromKu", { distance: formatDistance(locale, place.distanceMeters) })}</span></div><div className="student-tip"><Lightbulb size={17}/><div><strong>{tr(t, "localGuide:studentTip")}</strong><p>{tr(t, place.tipKey)}</p></div></div></article>; })}</div> : <EmptyState icon={MapPin} text={tr(t, "localGuide:empty")}/>}
  </section>;
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
  return <div className="modal-backdrop" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) close(); }}><div ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
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

function ResetModal({ t, close, confirm }: { t: TFunction; close: () => void; confirm: () => void }) {
  return <Modal close={close} label={tr(t, "reset:title")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon reset"><RotateCcw/></div><h2>{tr(t, "reset:title")}</h2><p>{tr(t, "reset:body")}</p><div className="modal-actions"><button className="secondary" onClick={close}>{tr(t, "common:cancel")}</button><button className="danger-button" onClick={confirm}>{tr(t, "reset:confirm")}</button></div></Modal>;
}

function ProductModal({ locale, t, profile, product, close, contact }: { locale: Locale; t: TFunction; profile: UserProfile; product: MarketProduct; close: () => void; contact: () => void }) {
  const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t);
  return <Modal close={close} label={name}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className={`modal-product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span></div><span className="seller"><SellerIcon size={16}/>{product.userCreated ? tr(t, "common:demoData") : tr(t, "common:verified")}</span><h2>{name}</h2><strong className="modal-price">{formatCurrency(locale, product.priceKrw)}</strong><div className="product-modal-details"><div><span>{tr(t, "marketplace:condition")}</span><strong>{tr(t, `marketplace:conditions.${product.condition}`)}</strong></div><div><span>{tr(t, "marketplace:pickup")}</span><strong><MapPin size={16}/>{productPickup(product, t)}</strong></div><div><span>{tr(t, "marketplace:seller")}</span><strong>{productSeller(product, t, profile)}</strong></div></div><button className="primary full" disabled={product.status === "Reserved"} onClick={contact}><MessageCircle size={18}/>{tr(t, "marketplace:contact")}</button></Modal>;
}

function ContactModal({ t, close }: { t: TFunction; close: () => void }) {
  const [ready, setReady] = useState(false);
  return <Modal close={close} label={tr(t, "marketplace:contactTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon"><MessageCircle/></div><h2>{tr(t, "marketplace:contactTitle")}</h2><p>{tr(t, "marketplace:contactBody")}</p><div className="message-preview">“{tr(t, "marketplace:message")}”</div><button className="primary full" onClick={() => setReady(true)}>{ready ? <Check/> : <MessageCircle/>}{tr(t, ready ? "marketplace:messageReady" : "marketplace:contact")}</button></Modal>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Search; text: string }) {
  return <div className="empty-state"><Icon/><p>{text}</p></div>;
}
