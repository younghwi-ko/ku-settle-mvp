"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BadgeCheck, Banknote, BedDouble, Box, CalendarDays, Check, CheckCircle2, ChevronRight,
  CircleUserRound, Clock3, CookingPot, FileCheck2, GraduationCap, HeartPulse, Hospital, House,
  Languages, LampDesk, Lightbulb, MapPin, Menu, MessageCircle, PackageCheck, PlusCircle, RotateCcw,
  Search, ShieldCheck, ShoppingBag, Sparkles, Store, Tag, Utensils, Vegan, X, Zap
} from "lucide-react";
import { copy, type Lang } from "./i18n";
import { lifecycleStages, places, products, tasks, type Bilingual, type LifecycleStage, type MarketProduct, type ProductCategory, type ProductIcon, type Task, type TaskAction } from "./data";

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
const productIcons: Record<ProductIcon, typeof Box> = { cooking: CookingPot, lamp: LampDesk, bed: BedDouble, kettle: Zap, fan: Sparkles, box: Box };
const categoryIcons: Record<string, typeof Hospital> = { Hospital, Halal: Utensils, Vegan, Pharmacy: HeartPulse, Cafe: Store, Grocery: ShoppingBag };
const categoryProductIcons: Record<ProductCategory, ProductIcon> = { Home: "box", Kitchen: "cooking", Electronics: "fan", Bedding: "bed" };
const conditions: Record<string, Bilingual> = {
  "Like new": { en: "Like new", ko: "거의 새 상품" },
  Good: { en: "Good", ko: "양호" },
  Used: { en: "Used", ko: "사용감 있음" },
  Clean: { en: "Clean", ko: "세탁 완료" }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBilingual(value: unknown): value is Bilingual {
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

function normalizeUserProducts(value: unknown): MarketProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || (typeof item.id !== "string" && typeof item.id !== "number")) return [];
    if (!isBilingual(item.name) || !isBilingual(item.condition) || !isBilingual(item.pickup) || !isBilingual(item.seller)) return [];
    if (typeof item.price !== "string" || !productCategories.includes(item.category as ProductCategory)) return [];
    if (item.status !== "Available" && item.status !== "Reserved") return [];
    if (!Object.hasOwn(productIcons, String(item.icon))) return [];
    return [{
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category as ProductCategory,
      condition: item.condition,
      pickup: item.pickup,
      seller: item.seller,
      status: item.status,
      icon: item.icon as ProductIcon,
      userCreated: true
    }];
  });
}

function getStageStats(activeTasks: Task[], done: string[]): StageStat[] {
  return lifecycleStages.map((stage) => {
    const stageTasks = activeTasks.filter((task) => task.stage === stage.id);
    const completed = stageTasks.filter((task) => done.includes(task.id)).length;
    return { stage, completed, total: stageTasks.length, progress: stageTasks.length ? Math.round((completed / stageTasks.length) * 100) : 0 };
  });
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
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
      const savedLang = localStorage.getItem(storageKeys.language) as Lang | null;
      const savedProfile = localStorage.getItem(storageKeys.profile);
      const savedDone = localStorage.getItem(storageKeys.checklist);
      const savedProducts = localStorage.getItem(storageKeys.userProducts);
      const loadedProfile = savedProfile ? (() => { try { return normalizeProfile(JSON.parse(savedProfile)); } catch { return null; } })() : null;

      if (savedLang === "en" || savedLang === "ko") setLang(savedLang);
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

  useEffect(() => { if (hydrated) { localStorage.setItem(storageKeys.language, lang); document.documentElement.lang = lang; } }, [lang, hydrated]);
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

  const t = copy[lang];
  const currentProfile = profile ?? demoProfile;
  const activeTasks = useMemo(() => getActiveTasks(currentProfile.housing), [currentProfile.housing]);
  const completedCount = activeTasks.filter((task) => done.includes(task.id)).length;
  const progress = activeTasks.length ? Math.round((completedCount / activeTasks.length) * 100) : 0;
  const recommendedTask = activeTasks.find((task) => !done.includes(task.id)) ?? null;
  const stageStats = useMemo(() => getStageStats(activeTasks, done), [activeTasks, done]);
  const marketplaceProducts = useMemo(() => [...userProducts, ...products], [userProducts]);
  const navItems: { key: Page; icon: typeof GraduationCap; label: string }[] = [
    { key: "home", icon: GraduationCap, label: t.nav.home },
    { key: "onboarding", icon: FileCheck2, label: t.nav.onboarding },
    { key: "marketplace", icon: ShoppingBag, label: t.nav.marketplace },
    { key: "guide", icon: MapPin, label: t.nav.guide }
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
  const toggleLang = () => setLang((current) => current === "en" ? "ko" : "en");
  const startPersonalizedPlan = (nextProfile: UserProfile) => { setProfile(nextProfile); setDone([]); setVerified(false); setSelectedStage("before-arrival"); setFocusTaskId(null); setHighlightTaskId(null); setSetupOpen(false); };
  const skipForDemo = () => { setProfile(demoProfile); setDone(demoDone); setVerified(false); setSelectedStage("first-weeks"); setSetupOpen(false); };
  const resetDemo = () => {
    [storageKeys.profile, storageKeys.checklist, storageKeys.verified, storageKeys.userProducts].forEach((key) => localStorage.removeItem(key));
    setProfile(null);
    setDone([]);
    setVerified(false);
    setUserProducts([]);
    setMarketSearch("");
    setMarketCategory("All");
    setMarketMode("incoming");
    setSelectedProduct(null);
    setContactOpen(false);
    setGuideCategory("All");
    setSelectedStage("before-arrival");
    setFocusTaskId(null);
    setHighlightTaskId(null);
    setResetOpen(false);
    setProfileOpen(false);
    setPage("home");
    setSetupOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go("home")} aria-label="KU Settle home">
          <span className="brand-mark">KU</span><span><strong>KU Settle</strong><small>Arrival made simple</small></span>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map(({ key, label }) => <button key={key} onClick={() => go(key)} className={page === key ? "active" : ""}>{label}</button>)}
        </nav>
        <div className="header-actions">
          <button className="language-toggle" onClick={toggleLang} aria-label="Switch language"><Languages size={17}/><span className={lang === "en" ? "selected" : ""}>EN</span><i>/</i><span className={lang === "ko" ? "selected" : ""}>KO</span></button>
          <button className="profile-button" onClick={() => setProfileOpen(true)} aria-label={t.verify.title}>
            {verified ? <BadgeCheck size={20} className="verified-icon"/> : <CircleUserRound size={20}/>}<span>{currentProfile.name}</span>
          </button>
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => go(key)} className={page === key ? "active" : ""}><Icon size={18}/>{label}</button>)}</nav>}

      <main>
        {page === "home" && <Dashboard lang={lang} t={t} profile={currentProfile} activeTasks={activeTasks} stageStats={stageStats} progress={progress} completedCount={completedCount} recommendedTask={recommendedTask} go={go}/>}
        {page === "onboarding" && <Onboarding lang={lang} t={t} activeTasks={activeTasks} stageStats={stageStats} progress={progress} done={done} recommendedTask={recommendedTask} selectedStage={selectedStage} setSelectedStage={setSelectedStage} focusTaskId={focusTaskId} highlightTaskId={highlightTaskId} go={go} openTaskAction={openTaskAction} toggleTask={toggleTask}/>}
        {page === "marketplace" && <Marketplace lang={lang} t={t} profile={currentProfile} products={marketplaceProducts} search={marketSearch} setSearch={setMarketSearch} category={marketCategory} setCategory={setMarketCategory} mode={marketMode} setMode={setMarketMode} addProduct={(product) => setUserProducts((current) => [product, ...current])} selectProduct={setSelectedProduct}/>}
        {page === "guide" && <LocalGuide lang={lang} t={t} category={guideCategory} setCategory={setGuideCategory}/>}
      </main>

      <footer><div className="footer-brand"><span className="brand-mark small">KU</span><span><strong>KU Settle</strong><small>© 2026 KU Settle</small></span></div><div className="footer-actions"><span className="footer-notice">{t.footer.notice}</span><button className="reset-demo" onClick={() => setResetOpen(true)}><RotateCcw size={13}/>{t.reset.button}</button></div></footer>

      {setupOpen && <SetupModal lang={lang} t={t} submit={startPersonalizedPlan} skip={skipForDemo}/>}
      {resetOpen && <ResetModal t={t} close={() => setResetOpen(false)} confirm={resetDemo}/>}
      {profileOpen && <VerificationModal
        t={t}
        profile={currentProfile}
        email={email}
        setEmail={setEmail}
        verified={verified}
        verifyError={verifyError}
        close={() => setProfileOpen(false)}
        verify={() => {
          const ok = /^[^@\s]+@korea\.ac\.kr$/i.test(email);
          setVerifyError(!ok);
          if (ok) setVerified(true);
        }}
      />}
      {selectedProduct && <ProductModal lang={lang} t={t} product={selectedProduct} close={() => setSelectedProduct(null)} contact={() => { setSelectedProduct(null); setContactOpen(true); }}/>}
      {contactOpen && <ContactModal t={t} close={() => setContactOpen(false)}/>}
    </div>
  );
}

function Dashboard({ lang, t, profile, activeTasks, stageStats, progress, completedCount, recommendedTask, go }: { lang: Lang; t: typeof copy[Lang]; profile: UserProfile; activeTasks: Task[]; stageStats: StageStat[]; progress: number; completedCount: number; recommendedTask: Task | null; go: (page: Page, intent?: NavigationIntent) => void }) {
  const recommendedIndex = recommendedTask ? activeTasks.findIndex((task) => task.id === recommendedTask.id) : -1;
  const recommendedStage = recommendedTask ? lifecycleStages.find((stage) => stage.id === recommendedTask.stage) : null;
  return <>
    <section className="hero section-pad">
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={14}/>{t.home.eyebrow}</span>
        <h1>{lang === "en" ? `${t.home.welcome}, ${profile.name}` : `${profile.name}님, ${t.home.welcome}`}</h1><p className="hero-lead">{t.home.lead}</p><p className="hero-body">{t.home.body}</p>
        <div className="hero-actions"><button className="primary" onClick={() => go("onboarding")}>{t.nav.onboarding}<ArrowRight size={18}/></button><button className="secondary" onClick={() => go("marketplace")}>{t.nav.marketplace}</button></div>
        <div className="trust-row">{t.home.trust.map((item) => <span key={item}><Check size={14}/>{item}</span>)}</div>
      </div>
      <div className="setup-card">
        <div className="setup-top"><div><span>{t.home.setup}</span><strong>{progress}%</strong></div><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div></div>
        <div className="progress-track"><i style={{ width: `${progress}%` }}/></div>
        <div className="setup-label"><span>{completedCount} / {activeTasks.length} {t.common.completed}</span><b>{progress}% {t.common.complete}</b></div>
        <div className="home-lifecycle" aria-label={t.home.lifecycle}>{stageStats.map(({ stage, completed, total, progress: stageProgress }) => <button key={stage.id} onClick={() => go("onboarding", { stage: stage.id })} aria-label={`${stage.label[lang]}: ${completed}/${total}, ${stageProgress}%`}><span className="lifecycle-number">{stage.number}</span><span><strong>{stage.label[lang]}</strong><small>{completed}/{total} · {stageProgress}%</small></span><ChevronRight size={15}/></button>)}</div>
        <button className="text-button" onClick={() => go("onboarding")}>{t.home.viewAll}<ChevronRight size={16}/></button>
      </div>
    </section>
    <section className="dashboard-grid single section-pad compact">
      <button className={`next-card next-card-button ${recommendedTask ? "" : "all-complete"}`} onClick={() => go("onboarding", recommendedTask ? { stage: recommendedTask.stage, taskId: recommendedTask.id, highlight: true } : { stage: "departure" })}>
        <span className="next-icon">{recommendedTask ? <FileCheck2/> : <CheckCircle2/>}</span><span className="next-content"><span className="label">{t.home.next}{recommendedStage ? ` · ${recommendedStage.label[lang]}` : ""}</span><strong className="next-title">{recommendedTask ? recommendedTask.title[lang] : t.home.allCompletedTitle}</strong><span className="next-description">{recommendedTask ? recommendedTask.description[lang] : t.home.allCompletedBody}</span><span className="next-link">{recommendedTask ? t.home.viewGuide : t.home.reviewTasks}<ArrowRight size={17}/></span></span>
        <span className="step-badge">{recommendedTask ? String(recommendedIndex + 1).padStart(2, "0") : "✓"}</span>
      </button>
    </section>
    <section className="feature-section section-pad compact"><div className="section-title"><span className="eyebrow">{lang === "en" ? "INFORMATION → ACTION" : "정보에서 실행으로"}</span><h2>{lang === "en" ? "One journey, four connected stages" : "하나로 연결된 4단계 유학생 여정"}</h2></div><div className="feature-grid">{([
      ["onboarding", FileCheck2, t.nav.onboarding, t.home.cards[0], "01"], ["marketplace", ShoppingBag, t.nav.marketplace, t.home.cards[1], "02"], ["guide", MapPin, t.nav.guide, t.home.cards[2], "03"]
    ] as const).map(([target, Icon, title, text, number]) => <button className="feature-card" key={target} onClick={() => go(target)}><span className="feature-number">{number}</span><span className="feature-icon"><Icon/></span><h3>{title}</h3><p>{text}</p><span className="learn">{lang === "en" ? "Explore" : "둘러보기"}<ArrowRight size={17}/></span></button>)}</div></section>
  </>;
}

function Onboarding({ lang, t, activeTasks, stageStats, progress, done, recommendedTask, selectedStage, setSelectedStage, focusTaskId, highlightTaskId, go, openTaskAction, toggleTask }: { lang: Lang; t: typeof copy[Lang]; activeTasks: Task[]; stageStats: StageStat[]; progress: number; done: string[]; recommendedTask: Task | null; selectedStage: LifecycleStage; setSelectedStage: (stage: LifecycleStage) => void; focusTaskId: string | null; highlightTaskId: string | null; go: (page: Page, intent?: NavigationIntent) => void; openTaskAction: (action: TaskAction) => void; toggleTask: (id: string) => void }) {
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
    <div className="page-hero lifecycle-hero"><div><span className="eyebrow"><FileCheck2 size={14}/>{t.onboarding.eyebrow}</span><h1>{t.onboarding.title}</h1><p>{t.onboarding.body}</p></div><div className="progress-panels"><div className="progress-summary"><div><span>{t.onboarding.overallProgress}</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }}/></div><small><CheckCircle2 size={14}/>{overallCompleted}/{activeTasks.length} {t.onboarding.tasksComplete}</small></div><div className="progress-summary selected"><div><span>{t.onboarding.stageProgress}</span><strong>{selectedStat.progress}%</strong></div><div className="progress-track"><i style={{ width: `${selectedStat.progress}%` }}/></div><small>{selectedStat.stage.label[lang]} · {selectedStat.completed}/{selectedStat.total}</small></div></div></div>
    <div className="lifecycle-tabs" role="tablist" aria-label={t.home.lifecycle}>{stageStats.map(({ stage, completed, total, progress: stageProgress }) => <button role="tab" aria-selected={selectedStage === stage.id} className={selectedStage === stage.id ? "active" : ""} key={stage.id} onClick={() => setSelectedStage(stage.id)}><span>{stage.number}</span><strong>{stage.label[lang]}</strong><small>{completed}/{total} · {stageProgress}%</small><i><b style={{ width: `${stageProgress}%` }}/></i></button>)}</div>
    <div className="timeline-note"><Lightbulb size={20}/><span>{t.onboarding.searchHint}</span>{recommendedTask && recommendedTask.stage !== selectedStage && <button onClick={() => go("onboarding", { stage: recommendedTask.stage, taskId: recommendedTask.id, highlight: true })}>{t.onboarding.viewNext}<ArrowRight size={15}/></button>}</div>
    <div className="task-list">{selectedTasks.map((task, index) => { const isDone = done.includes(task.id); const isRecommended = !isDone && task.id === recommendedTask?.id; const isHighlighted = task.id === highlightTaskId; return <article ref={task.id === focusTaskId ? taskRef : undefined} data-task-id={task.id} aria-current={isRecommended ? "step" : undefined} className={`task-card ${isRecommended ? "featured recommended" : ""} ${isHighlighted ? "attention-flash" : ""} ${isDone ? "is-done" : ""}`} key={task.id}>
      <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={`${t.onboarding.mark}: ${task.title[lang]}`}>{isDone && <Check size={18}/>}</button>
      <div className="task-main"><div className="task-title-row"><div><span className="task-category">{String(index + 1).padStart(2, "0")} · {task.category[lang]}</span><h2>{task.title[lang]}</h2></div><span className={`status ${isDone ? "complete" : isRecommended ? "progress" : ""}`}>{isDone ? t.common.completed : isRecommended ? t.common.inProgress : t.common.notStarted}</span></div><p>{task.description[lang]}</p>
        <div className="task-details"><div><span className="detail-label"><PackageCheck size={16}/>{t.onboarding.need}</span><ul>{task.needs.map((need) => <li key={need.en}>{need[lang]}</li>)}</ul></div><div><span className="detail-label"><Clock3 size={16}/>{t.onboarding.time}</span><strong>{task.time} {t.common.min}</strong></div><div className="tip"><span className="detail-label"><Lightbulb size={16}/>{t.onboarding.tip}</span><p>{task.tip[lang]}</p></div></div>
        {task.officialGuidance ? <div className="official-guidance"><div><span className="detail-label"><ShieldCheck size={16}/>{t.onboarding.officialGuidance}</span><p>{task.officialGuidance.message[lang]}</p></div><a href={task.officialGuidance.link.href} target="_blank" rel="noopener noreferrer">{task.officialGuidance.link.label[lang]}<ArrowRight size={14}/></a></div> : task.action && (task.action.kind === "external" ? <a className="task-action" href={task.action.href} target="_blank" rel="noopener noreferrer">{task.action.label[lang]}<ArrowRight size={15}/></a> : <button className="task-action" onClick={() => openTaskAction(task.action!)}>{task.action.label[lang]}<ArrowRight size={15}/></button>)}
      </div>
    </article>; })}</div>
  </section>;
}

function Marketplace({ lang, t, profile, products: marketplaceProducts, search, setSearch, category, setCategory, mode, setMode, addProduct, selectProduct }: { lang: Lang; t: typeof copy[Lang]; profile: UserProfile; products: MarketProduct[]; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; mode: MarketMode; setMode: (value: MarketMode) => void; addProduct: (product: MarketProduct) => void; selectProduct: (product: MarketProduct) => void }) {
  const [success, setSuccess] = useState(false);
  const categories = ["All", ...productCategories];
  const labels: Record<string, string> = { All: t.market.all, Home: t.market.home, Kitchen: t.market.kitchen, Electronics: t.market.electronics, Bedding: t.market.bedding };
  const filtered = useMemo(() => marketplaceProducts.filter((product) => (category === "All" || product.category === category) && product.name[lang].toLowerCase().includes(search.toLowerCase())), [marketplaceProducts, category, search, lang]);
  const changeMode = (nextMode: MarketMode) => { setMode(nextMode); setSuccess(false); };
  const completeListing = (product: MarketProduct) => { addProduct(product); setSearch(""); setCategory("All"); setMode("incoming"); setSuccess(true); };

  return <section className="page section-pad market-page">
    <div className="page-hero market-hero"><div><span className="eyebrow"><ShoppingBag size={14}/>{t.market.eyebrow}</span><h1>{t.market.title}</h1><p>{t.market.body}</p></div><div className="mode-switch"><button aria-pressed={mode === "incoming"} className={mode === "incoming" ? "active" : ""} onClick={() => changeMode("incoming")}><ShoppingBag size={18}/>{t.market.incoming}</button><button aria-pressed={mode === "leaving"} className={mode === "leaving" ? "active" : ""} onClick={() => changeMode("leaving")}><Tag size={18}/>{t.market.leaving}</button></div></div>
    <div className="market-flow">{t.market.flow.map((step, index) => <div key={step}><span>{index === 0 ? <BadgeCheck/> : index === 1 ? <ShoppingBag/> : index === 2 ? <MapPin/> : <Banknote/>}</span><strong>{step}</strong>{index < 3 && <ChevronRight/>}</div>)}</div>
    {mode === "leaving" ? <ListingForm lang={lang} t={t} profile={profile} submit={completeListing}/> : <>
      {success && <div className="success-banner" role="status"><CheckCircle2 size={18}/>{t.market.success}</div>}
      <div className="filters"><label className="search-box"><Search size={19}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.market.search}/>{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={16}/></button>}</label><div className="chips">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{labels[item]}</button>)}</div></div>
      {filtered.length ? <div className="product-grid">{filtered.map((product) => {
        const Icon = productIcons[product.icon];
        const SellerIcon = product.userCreated ? Tag : BadgeCheck;
        return <button className="product-card" key={product.id} onClick={() => selectProduct(product)}><div className={`product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{product.status === "Available" ? t.common.available : t.common.reserved}</span></div><div className="product-info"><div><h2>{product.name[lang]}</h2><strong className="price">{product.price}</strong></div><dl><div><dt>{t.market.condition}</dt><dd>{product.condition[lang]}</dd></div><div><dt>{t.market.pickup}</dt><dd><MapPin size={14}/>{product.pickup[lang]}</dd></div></dl><span className="seller"><SellerIcon size={16}/>{product.seller[lang]}</span><span className="details-link">{t.market.details}<ArrowRight size={16}/></span></div></button>;
      })}</div> : <EmptyState icon={Search} text={t.market.empty}/>}
    </>}
  </section>;
}

function ListingForm({ lang, t, profile, submit }: { lang: Lang; t: typeof copy[Lang]; profile: UserProfile; submit: (product: MarketProduct) => void }) {
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Home");
  const [condition, setCondition] = useState("Good");
  const [pickup, setPickup] = useState("");
  const [availability, setAvailability] = useState<"Available" | "Reserved">("Available");
  const [error, setError] = useState(false);
  const categoryLabels: Record<ProductCategory, string> = { Home: t.market.home, Kitchen: t.market.kitchen, Electronics: t.market.electronics, Bedding: t.market.bedding };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const numericPrice = price.replace(/[^0-9]/g, "");
    if (!itemName.trim() || !numericPrice || !pickup.trim()) { setError(true); return; }
    const conditionCopy = conditions[condition] ?? conditions.Good;
    submit({
      id: `user-${Date.now()}`,
      name: { en: itemName.trim(), ko: itemName.trim() },
      price: `₩${Number(numericPrice).toLocaleString("ko-KR")}`,
      category,
      condition: conditionCopy,
      pickup: { en: pickup.trim(), ko: pickup.trim() },
      seller: { en: `KU student · ${profile.name}`, ko: `고려대 학생 · ${profile.name}` },
      status: availability,
      icon: categoryProductIcons[category],
      userCreated: true
    });
  };

  return <form className="listing-form" onSubmit={handleSubmit}>
    <div className="listing-heading"><span className="next-icon"><PlusCircle/></span><div><h2>{t.market.formTitle}</h2><p>{t.market.formBody}</p></div></div>
    <div className="listing-grid">
      <label className="field"><span>{t.market.itemName}</span><input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={t.market.itemPlaceholder}/></label>
      <label className="field"><span>{t.market.price}</span><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" placeholder={t.market.pricePlaceholder}/></label>
      <label className="field"><span>{t.market.category}</span><select value={category} onChange={(event) => setCategory(event.target.value as ProductCategory)}>{productCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}</select></label>
      <label className="field"><span>{t.market.condition}</span><select value={condition} onChange={(event) => setCondition(event.target.value)}>{Object.entries(conditions).map(([value, label]) => <option key={value} value={value}>{label[lang]}</option>)}</select></label>
      <label className="field field-wide"><span>{t.market.pickupLocation}</span><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder={t.market.pickupPlaceholder}/></label>
      <label className="field"><span>{t.market.availability}</span><select value={availability} onChange={(event) => setAvailability(event.target.value as "Available" | "Reserved")}><option value="Available">{t.common.available}</option><option value="Reserved">{t.common.reserved}</option></select></label>
    </div>
    {error && <p className="error-text" role="alert">{t.common.required}</p>}
    <button className="primary listing-submit" type="submit"><PlusCircle size={18}/>{t.market.submit}</button>
  </form>;
}

function LocalGuide({ lang, t, category, setCategory }: { lang: Lang; t: typeof copy[Lang]; category: string; setCategory: (value: string) => void }) {
  const categories = ["All", "Food", "Halal", "Vegan", "Hospital", "Pharmacy", "Hair Salon", "Cafe", "Grocery"];
  const categoryLabel = (value: string) => value === "All" ? t.guide.all : ({ Food: lang === "en" ? "Food" : "음식", Halal: lang === "en" ? "Halal" : "할랄", Vegan: lang === "en" ? "Vegan" : "비건", Hospital: lang === "en" ? "Hospital" : "병원", Pharmacy: lang === "en" ? "Pharmacy" : "약국", "Hair Salon": lang === "en" ? "Hair Salon" : "미용실", Cafe: lang === "en" ? "Cafe" : "카페", Grocery: lang === "en" ? "Grocery" : "식료품" } as Record<string,string>)[value];
  const filtered = places.filter((place) => category === "All" || place.category === category || (category === "Food" && ["Halal", "Vegan"].includes(place.category)));
  return <section className="page section-pad guide-page"><div className="page-hero"><div><span className="eyebrow"><MapPin size={14}/>{t.guide.eyebrow}</span><h1>{t.guide.title}</h1><p>{t.guide.body}</p></div><div className="guide-visual"><span><MapPin/></span><i/><b>KU</b><i/><span><Utensils/></span></div></div>
    <div className="chips guide-chips">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div>
    {filtered.length ? <div className="place-grid">{filtered.map((place) => { const Icon = categoryIcons[place.category] || MapPin; return <article className="place-card" key={place.id}><div className="place-top"><span className="place-icon"><Icon/></span><span className="demo-pill">{t.common.demo}</span></div><span className="place-category">{categoryLabel(place.category)}</span><h2>{place.name[lang]}</h2><p>{place.description[lang]}</p><div className="place-meta"><span className={place.english ? "yes" : "no"}><MessageCircle size={16}/>{t.guide.english} {place.english ? <Check size={14}/> : "—"}</span><span><MapPin size={16}/>{place.location[lang]} · {place.distance} {t.guide.distance}</span></div><div className="student-tip"><Lightbulb size={17}/><div><strong>{t.guide.tip}</strong><p>{place.tip[lang]}</p></div></div></article>; })}</div> : <EmptyState icon={MapPin} text={t.guide.empty}/>} 
  </section>;
}

function Modal({ children, close, label, className = "", dismissible = true }: { children: React.ReactNode; close: () => void; label: string; className?: string; dismissible?: boolean }) {
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (dismissible && event.key === "Escape") close(); }; document.body.style.overflow = "hidden"; window.addEventListener("keydown", handler); return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handler); }; }, [close, dismissible]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) close(); }}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}

function SetupModal({ lang, t, submit, skip }: { lang: Lang; t: typeof copy[Lang]; submit: (profile: UserProfile) => void; skip: () => void }) {
  const [name, setName] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [housing, setHousing] = useState<Housing>("dorm");
  const [error, setError] = useState(false);
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); if (!name.trim() || !arrivalDate) { setError(true); return; } submit({ name: name.trim(), arrivalDate, housing, mode: "personalized" }); };

  return <Modal close={skip} label={t.setup.title} className="setup-modal" dismissible={false}><div className="modal-icon"><Sparkles/></div><span className="eyebrow">{t.setup.eyebrow}</span><h2>{t.setup.title}</h2><p>{t.setup.body}</p><form onSubmit={handleSubmit}>
    <label className="field"><span>{t.setup.name}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t.setup.namePlaceholder}/></label>
    <label className="field"><span>{t.setup.arrival}</span><input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)}/></label>
    <fieldset className="housing-options"><legend>{t.setup.housing}</legend><label className={housing === "dorm" ? "selected" : ""}><input type="radio" name="housing" value="dorm" checked={housing === "dorm"} onChange={() => setHousing("dorm")}/><House/><span><strong>{t.setup.dorm}</strong></span></label><label className={housing === "off-campus" ? "selected" : ""}><input type="radio" name="housing" value="off-campus" checked={housing === "off-campus"} onChange={() => setHousing("off-campus")}/><MapPin/><span><strong>{t.setup.offCampus}</strong></span></label></fieldset>
    {error && <p className="error-text" role="alert">{t.common.required}</p>}
    <button className="primary full" type="submit">{t.setup.start}<ArrowRight size={18}/></button><button className="skip-button" type="button" onClick={skip}>{t.setup.skip}</button>
  </form><span className="setup-language-note"><Languages size={14}/>{lang === "en" ? "You can switch to Korean after setup." : "설정 후에도 영어로 전환할 수 있습니다."}</span></Modal>;
}

function VerificationModal({ t, profile, email, setEmail, verified, verifyError, close, verify }: { t: typeof copy[Lang]; profile: UserProfile; email: string; setEmail: (value: string) => void; verified: boolean; verifyError: boolean; close: () => void; verify: () => void }) {
  return <Modal close={close} label={t.verify.title}><button className="modal-close" onClick={close} aria-label={t.common.close}><X/></button><div className="modal-icon verify"><ShieldCheck/></div><h2>{t.verify.title}</h2><p>{t.verify.body}</p><div className="profile-summary"><strong>{profile.name}</strong><span><CalendarDays size={15}/>{t.profile.arrival}: {profile.arrivalDate || t.profile.demoArrival}</span><span><House size={15}/>{t.profile.housing}: {profile.housing === "dorm" ? t.setup.dorm : t.setup.offCampus}</span></div>{verified ? <div className="verified-success"><BadgeCheck/><div><strong>{t.common.verified}</strong><span>{t.verify.success}</span></div></div> : <><label className="field"><span>{t.verify.email}</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="student@korea.ac.kr"/></label>{verifyError && <p className="error-text">{t.verify.error}</p>}<button className="primary full" onClick={verify}>{t.verify.send}<ArrowRight size={18}/></button></>}</Modal>;
}

function ResetModal({ t, close, confirm }: { t: typeof copy[Lang]; close: () => void; confirm: () => void }) {
  return <Modal close={close} label={t.reset.title}><button className="modal-close" onClick={close} aria-label={t.common.close}><X/></button><div className="modal-icon reset"><RotateCcw/></div><h2>{t.reset.title}</h2><p>{t.reset.body}</p><div className="modal-actions"><button className="secondary" onClick={close}>{t.common.cancel}</button><button className="danger-button" onClick={confirm}>{t.reset.confirm}</button></div></Modal>;
}

function ProductModal({ lang, t, product, close, contact }: { lang: Lang; t: typeof copy[Lang]; product: MarketProduct; close: () => void; contact: () => void }) {
  const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; return <Modal close={close} label={product.name[lang]}><button className="modal-close" onClick={close} aria-label={t.common.close}><X/></button><div className={`modal-product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{product.status === "Available" ? t.common.available : t.common.reserved}</span></div><span className="seller"><SellerIcon size={16}/>{product.userCreated ? t.common.demo : t.common.verified}</span><h2>{product.name[lang]}</h2><strong className="modal-price">{product.price}</strong><div className="product-modal-details"><div><span>{t.market.condition}</span><strong>{product.condition[lang]}</strong></div><div><span>{t.market.pickup}</span><strong><MapPin size={16}/>{product.pickup[lang]}</strong></div><div><span>{t.market.seller}</span><strong>{product.seller[lang]}</strong></div></div><button className="primary full" disabled={product.status === "Reserved"} onClick={contact}><MessageCircle size={18}/>{t.market.contact}</button></Modal>;
}

function ContactModal({ t, close }: { t: typeof copy[Lang]; close: () => void }) {
  const [ready, setReady] = useState(false); return <Modal close={close} label={t.market.contactTitle}><button className="modal-close" onClick={close} aria-label={t.common.close}><X/></button><div className="modal-icon"><MessageCircle/></div><h2>{t.market.contactTitle}</h2><p>{t.market.contactBody}</p><div className="message-preview">“{t.market.message}”</div><button className="primary full" onClick={() => setReady(true)}>{ready ? <Check/> : <MessageCircle/>}{ready ? t.market.copied : t.market.contact}</button></Modal>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Search; text: string }) { return <div className="empty-state"><Icon/><p>{text}</p></div>; }
