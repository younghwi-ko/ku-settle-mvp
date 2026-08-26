"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BadgeCheck, Banknote, BedDouble, Box, Building2, Check, CheckCircle2, ChevronRight,
  CircleUserRound, Clock3, CookingPot, FileCheck2, GraduationCap, HeartPulse, Hospital, Languages,
  LampDesk, Lightbulb, MapPin, Menu, MessageCircle, PackageCheck, Search, ShieldCheck, ShoppingBag,
  Smartphone, Sparkles, Store, Tag, Utensils, Vegan, X, Zap
} from "lucide-react";
import { copy, type Lang } from "./i18n";
import { places, products, tasks } from "./data";

type Page = "home" | "onboarding" | "marketplace" | "guide";
type Product = (typeof products)[number];

const defaultDone = ["dorm", "account", "courses", "campus"];
const validTaskIds = new Set(tasks.map((task) => task.id));
const productIcons = { cooking: CookingPot, lamp: LampDesk, bed: BedDouble, kettle: Zap, fan: Sparkles, box: Box };
const categoryIcons: Record<string, typeof Hospital> = { Hospital, Halal: Utensils, Vegan, Pharmacy: HeartPulse, Cafe: Store, Grocery: ShoppingBag };

function normalizeDone(value: unknown) {
  if (!Array.isArray(value)) return defaultDone;
  return [...new Set(value.filter((id): id is string => typeof id === "string" && validTaskIds.has(id)))];
}

function getTaskPreviews(done: string[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const recent = done.slice().reverse().map((id) => taskById.get(id)).filter((task): task is (typeof tasks)[number] => Boolean(task)).slice(0, 2);
  const next = tasks.filter((task) => !done.includes(task.id)).slice(0, 3);
  const previews = [...recent.map((task) => ({ task, kind: "recent" as const })), ...next.map((task) => ({ task, kind: "next" as const }))];
  const selected = new Set(previews.map(({ task }) => task.id));

  for (const task of tasks) {
    if (previews.length === 5) break;
    if (!selected.has(task.id)) {
      previews.push({ task, kind: done.includes(task.id) ? "recent" : "next" });
      selected.add(task.id);
    }
  }

  return previews;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [page, setPage] = useState<Page>("home");
  const [done, setDone] = useState<string[]>(defaultDone);
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [marketMode, setMarketMode] = useState<"incoming" | "leaving">("incoming");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketCategory, setMarketCategory] = useState("All");
  const [guideCategory, setGuideCategory] = useState("All");
  const [email, setEmail] = useState("student@korea.ac.kr");
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("ku-settle-language") as Lang | null;
    const savedDone = localStorage.getItem("ku-settle-checklist");
    const savedVerified = localStorage.getItem("ku-settle-verified");
    if (savedLang === "en" || savedLang === "ko") setLang(savedLang);
    if (savedDone) { try { setDone(normalizeDone(JSON.parse(savedDone))); } catch { setDone(defaultDone); } }
    if (savedVerified === "true") setVerified(true);
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) { localStorage.setItem("ku-settle-language", lang); document.documentElement.lang = lang; } }, [lang, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("ku-settle-checklist", JSON.stringify(done)); }, [done, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("ku-settle-verified", String(verified)); }, [verified, hydrated]);

  const t = copy[lang];
  const completedCount = tasks.filter((task) => done.includes(task.id)).length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const navItems: { key: Page; icon: typeof GraduationCap; label: string }[] = [
    { key: "home", icon: GraduationCap, label: t.nav.home },
    { key: "onboarding", icon: FileCheck2, label: t.nav.onboarding },
    { key: "marketplace", icon: ShoppingBag, label: t.nav.marketplace },
    { key: "guide", icon: MapPin, label: t.nav.guide }
  ];

  const go = (target: Page) => { setPage(target); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const toggleTask = (id: string) => setDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleLang = () => setLang((current) => current === "en" ? "ko" : "en");

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
            {verified ? <BadgeCheck size={20} className="verified-icon"/> : <CircleUserRound size={20}/>}<span>{verified ? t.common.verified : t.verify.profile}</span>
          </button>
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => go(key)} className={page === key ? "active" : ""}><Icon size={18}/>{label}</button>)}</nav>}

      <main>
        {page === "home" && <Dashboard lang={lang} t={t} progress={progress} completedCount={completedCount} done={done} go={go}/>}
        {page === "onboarding" && <Onboarding lang={lang} t={t} progress={progress} done={done} toggleTask={toggleTask}/>} 
        {page === "marketplace" && <Marketplace lang={lang} t={t} search={marketSearch} setSearch={setMarketSearch} category={marketCategory} setCategory={setMarketCategory} mode={marketMode} setMode={setMarketMode} selectProduct={setSelectedProduct}/>} 
        {page === "guide" && <LocalGuide lang={lang} t={t} category={guideCategory} setCategory={setGuideCategory}/>} 
      </main>

      <footer><div className="footer-brand"><span className="brand-mark small">KU</span><span><strong>KU Settle</strong><small>© 2026 KU Settle</small></span></div><span className="footer-notice">{t.footer.notice}</span></footer>

      {profileOpen && <VerificationModal t={t} email={email} setEmail={setEmail} verified={verified} verifyError={verifyError} close={() => setProfileOpen(false)} verify={() => { const ok = /^[^@\s]+@korea\.ac\.kr$/i.test(email); setVerifyError(!ok); if (ok) setVerified(true); }}/>} 
      {selectedProduct && <ProductModal lang={lang} t={t} product={selectedProduct} close={() => setSelectedProduct(null)} contact={() => { setSelectedProduct(null); setContactOpen(true); }}/>} 
      {contactOpen && <ContactModal t={t} close={() => setContactOpen(false)}/>} 
    </div>
  );
}

function Dashboard({ lang, t, progress, completedCount, done, go }: { lang: Lang; t: typeof copy[Lang]; progress: number; completedCount: number; done: string[]; go: (p: Page) => void }) {
  const previews = getTaskPreviews(done);
  return <>
    <section className="hero section-pad">
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={14}/>{t.home.eyebrow}</span>
        <h1>{t.home.welcome}</h1><p className="hero-lead">{t.home.lead}</p><p className="hero-body">{t.home.body}</p>
        <div className="hero-actions"><button className="primary" onClick={() => go("onboarding")}>{t.nav.onboarding}<ArrowRight size={18}/></button><button className="secondary" onClick={() => go("marketplace")}>{t.nav.marketplace}</button></div>
        <div className="trust-row">{t.home.trust.map((item) => <span key={item}><Check size={14}/>{item}</span>)}</div>
      </div>
      <div className="setup-card">
        <div className="setup-top"><div><span>{t.home.setup}</span><strong>{progress}%</strong></div><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div></div>
        <div className="progress-track"><i style={{ width: `${progress}%` }}/></div>
        <div className="setup-label"><span>{completedCount} / {tasks.length} {t.common.completed}</span><b>{progress}% {t.common.complete}</b></div>
        <div className="mini-list">{previews.map(({ task, kind }) => <div key={task.id} className={done.includes(task.id) ? "done" : ""}><span>{done.includes(task.id) ? <Check size={14}/> : null}</span><div><strong>{task.title[lang]}</strong><small>{kind === "recent" ? t.home.recent : t.home.upNext}</small></div></div>)}</div>
        <button className="text-button" onClick={() => go("onboarding")}>{t.home.viewAll}<ChevronRight size={16}/></button>
      </div>
    </section>
    <section className="dashboard-grid section-pad compact">
      <article className="next-card">
        <div className="next-icon"><FileCheck2/></div><div><span className="label">{t.home.next}</span><h2>{t.home.arcTitle}</h2><p>{t.home.arcBody}</p><button onClick={() => go("onboarding")}>{t.home.viewGuide}<ArrowRight size={17}/></button></div>
        <span className="step-badge">03</span>
      </article>
      <article className="checklist-preview"><div className="section-heading"><div><span className="label">{t.home.checklist}</span><h2>{lang === "en" ? "Your first-week essentials" : "첫 주 필수 할 일"}</h2></div><button onClick={() => go("onboarding")}>{t.home.viewAll}</button></div><div className="preview-tasks">{previews.map(({ task, kind }) => <div key={task.id}><span className={done.includes(task.id) ? "checked" : ""}>{done.includes(task.id) && <Check size={14}/>}</span><div><strong>{task.title[lang]}</strong><small>{kind === "recent" ? t.home.recent : t.home.upNext} · {task.category[lang]}</small></div></div>)}</div></article>
    </section>
    <section className="feature-section section-pad compact"><div className="section-title"><span className="eyebrow">{lang === "en" ? "ONE CAMPUS, ONE STARTING POINT" : "하나의 캠퍼스, 하나의 시작점"}</span><h2>{lang === "en" ? "Everything for your first weeks" : "첫 몇 주에 필요한 모든 것"}</h2></div><div className="feature-grid">{([
      ["onboarding", FileCheck2, t.nav.onboarding, t.home.cards[0], "01"], ["marketplace", ShoppingBag, t.nav.marketplace, t.home.cards[1], "02"], ["guide", MapPin, t.nav.guide, t.home.cards[2], "03"]
    ] as const).map(([target, Icon, title, text, number]) => <button className="feature-card" key={target} onClick={() => go(target)}><span className="feature-number">{number}</span><span className="feature-icon"><Icon/></span><h3>{title}</h3><p>{text}</p><span className="learn">{lang === "en" ? "Explore" : "둘러보기"}<ArrowRight size={17}/></span></button>)}</div></section>
  </>;
}

function Onboarding({ lang, t, progress, done, toggleTask }: { lang: Lang; t: typeof copy[Lang]; progress: number; done: string[]; toggleTask: (id: string) => void }) {
  return <section className="page section-pad">
    <div className="page-hero"><div><span className="eyebrow"><FileCheck2 size={14}/>{t.onboarding.eyebrow}</span><h1>{t.onboarding.title}</h1><p>{t.onboarding.body}</p></div><div className="progress-summary"><div><strong>{progress}%</strong><span>{t.common.complete}</span></div><div className="progress-track"><i style={{ width: `${progress}%` }}/></div><small><CheckCircle2 size={14}/>{t.onboarding.saved}</small></div></div>
    <div className="timeline-note"><Lightbulb size={20}/><span>{t.onboarding.searchHint}</span></div>
    <div className="task-list">{tasks.map((task, index) => { const isDone = done.includes(task.id); return <article className={`task-card ${task.featured ? "featured" : ""} ${isDone ? "is-done" : ""}`} key={task.id}>
      <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={`${t.onboarding.mark}: ${task.title[lang]}`}>{isDone && <Check size={18}/>}</button>
      <div className="task-main"><div className="task-title-row"><div><span className="task-category">{String(index + 1).padStart(2, "0")} · {task.category[lang]}</span><h2>{task.title[lang]}</h2></div><span className={`status ${isDone ? "complete" : task.featured ? "progress" : ""}`}>{isDone ? t.common.completed : task.featured ? t.common.inProgress : t.common.notStarted}</span></div><p>{task.description[lang]}</p>
        <div className="task-details"><div><span className="detail-label"><PackageCheck size={16}/>{t.onboarding.need}</span><ul>{task.needs.map((need) => <li key={need.en}>{need[lang]}</li>)}</ul></div><div><span className="detail-label"><Clock3 size={16}/>{t.onboarding.time}</span><strong>{task.time} {t.common.min}</strong></div><div className="tip"><span className="detail-label"><Lightbulb size={16}/>{t.onboarding.tip}</span><p>{task.tip[lang]}</p></div></div>
        {task.officialGuidance && <div className="official-guidance"><div><span className="detail-label"><Clock3 size={16}/>{t.onboarding.recommendedTiming}</span><p>{task.officialGuidance.recommendedTiming[lang]}</p></div><div><span className="detail-label"><MapPin size={16}/>{t.onboarding.applicationLocation}</span><p>{task.officialGuidance.applicationLocation[lang]}</p></div><div><span className="detail-label"><FileCheck2 size={16}/>{t.onboarding.officialLink}</span><a href={task.officialGuidance.link.href} target="_blank" rel="noopener noreferrer">{task.officialGuidance.link.label[lang]}<ArrowRight size={14}/></a></div><div><span className="detail-label"><CheckCircle2 size={16}/>{t.onboarding.lastUpdated}</span><p>{task.officialGuidance.lastUpdated[lang]}</p></div></div>}
      </div>
    </article>; })}</div>
  </section>;
}

function Marketplace({ lang, t, search, setSearch, category, setCategory, mode, setMode, selectProduct }: { lang: Lang; t: typeof copy[Lang]; search: string; setSearch: (v: string) => void; category: string; setCategory: (v: string) => void; mode: "incoming" | "leaving"; setMode: (v: "incoming" | "leaving") => void; selectProduct: (p: Product) => void }) {
  const categories = ["All", "Home", "Kitchen", "Electronics", "Bedding"];
  const labels: Record<string, string> = { All: t.market.all, Home: t.market.home, Kitchen: t.market.kitchen, Electronics: t.market.electronics, Bedding: t.market.bedding };
  const filtered = useMemo(() => products.filter((p) => (category === "All" || p.category === category) && p.name[lang].toLowerCase().includes(search.toLowerCase())), [category, search, lang]);
  return <section className="page section-pad market-page">
    <div className="page-hero market-hero"><div><span className="eyebrow"><ShoppingBag size={14}/>{t.market.eyebrow}</span><h1>{t.market.title}</h1><p>{t.market.body}</p></div><div className="mode-switch"><button className={mode === "incoming" ? "active" : ""} onClick={() => setMode("incoming")}><ShoppingBag size={18}/>{t.market.incoming}</button><button className={mode === "leaving" ? "active" : ""} onClick={() => setMode("leaving")}><Tag size={18}/>{t.market.leaving}</button></div></div>
    <div className="market-flow">{t.market.flow.map((step, i) => <div key={step}><span>{i === 0 ? <BadgeCheck/> : i === 1 ? <ShoppingBag/> : i === 2 ? <MapPin/> : <Banknote/>}</span><strong>{step}</strong>{i < 3 && <ChevronRight/>}</div>)}</div>
    <div className="filters"><label className="search-box"><Search size={19}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.market.search}/>{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={16}/></button>}</label><div className="chips">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{labels[item]}</button>)}</div></div>
    {filtered.length ? <div className="product-grid">{filtered.map((product) => { const Icon = productIcons[product.icon]; return <button className="product-card" key={product.id} onClick={() => selectProduct(product)}><div className={`product-visual tone-${product.id}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{product.status === "Available" ? t.common.available : t.common.reserved}</span></div><div className="product-info"><div><h2>{product.name[lang]}</h2><strong className="price">{product.price}</strong></div><dl><div><dt>{t.market.condition}</dt><dd>{product.condition[lang]}</dd></div><div><dt>{t.market.pickup}</dt><dd><MapPin size={14}/>{product.pickup[lang]}</dd></div></dl><span className="seller"><BadgeCheck size={16}/>{product.seller[lang]}</span><span className="details-link">{t.market.details}<ArrowRight size={16}/></span></div></button>; })}</div> : <EmptyState icon={Search} text={t.market.empty}/>} 
  </section>;
}

function LocalGuide({ lang, t, category, setCategory }: { lang: Lang; t: typeof copy[Lang]; category: string; setCategory: (v: string) => void }) {
  const categories = ["All", "Food", "Halal", "Vegan", "Hospital", "Pharmacy", "Hair Salon", "Cafe", "Grocery"];
  const categoryLabel = (value: string) => value === "All" ? t.guide.all : ({ Food: lang === "en" ? "Food" : "음식", Halal: lang === "en" ? "Halal" : "할랄", Vegan: lang === "en" ? "Vegan" : "비건", Hospital: lang === "en" ? "Hospital" : "병원", Pharmacy: lang === "en" ? "Pharmacy" : "약국", "Hair Salon": lang === "en" ? "Hair Salon" : "미용실", Cafe: lang === "en" ? "Cafe" : "카페", Grocery: lang === "en" ? "Grocery" : "식료품" } as Record<string,string>)[value];
  const filtered = places.filter((p) => category === "All" || p.category === category || (category === "Food" && ["Halal","Vegan"].includes(p.category)));
  return <section className="page section-pad guide-page"><div className="page-hero"><div><span className="eyebrow"><MapPin size={14}/>{t.guide.eyebrow}</span><h1>{t.guide.title}</h1><p>{t.guide.body}</p></div><div className="guide-visual"><span><MapPin/></span><i/><b>KU</b><i/><span><Utensils/></span></div></div>
    <div className="chips guide-chips">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div>
    {filtered.length ? <div className="place-grid">{filtered.map((place) => { const Icon = categoryIcons[place.category] || MapPin; return <article className="place-card" key={place.id}><div className="place-top"><span className="place-icon"><Icon/></span><span className="demo-pill">{t.common.demo}</span></div><span className="place-category">{categoryLabel(place.category)}</span><h2>{place.name[lang]}</h2><p>{place.description[lang]}</p><div className="place-meta"><span className={place.english ? "yes" : "no"}><MessageCircle size={16}/>{t.guide.english} {place.english ? <Check size={14}/> : "—"}</span><span><MapPin size={16}/>{place.location[lang]} · {place.distance} {t.guide.distance}</span></div><div className="student-tip"><Lightbulb size={17}/><div><strong>{t.guide.tip}</strong><p>{place.tip[lang]}</p></div></div></article>; })}</div> : <EmptyState icon={MapPin} text={t.guide.empty}/>} 
  </section>;
}

function Modal({ children, close, label }: { children: React.ReactNode; close: () => void; label: string }) {
  useEffect(() => { const handler = (e: KeyboardEvent) => e.key === "Escape" && close(); document.body.style.overflow = "hidden"; window.addEventListener("keydown", handler); return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handler); }; }, [close]);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}

function VerificationModal({ t, email, setEmail, verified, verifyError, close, verify }: { t: typeof copy[Lang]; email: string; setEmail: (v: string) => void; verified: boolean; verifyError: boolean; close: () => void; verify: () => void }) {
  return <Modal close={close} label={t.verify.title}><button className="modal-close" onClick={close} aria-label={t.common.close}><X/></button><div className="modal-icon verify"><ShieldCheck/></div><h2>{t.verify.title}</h2><p>{t.verify.body}</p>{verified ? <div className="verified-success"><BadgeCheck/><div><strong>{t.common.verified}</strong><span>{t.verify.success}</span></div></div> : <><label className="field"><span>{t.verify.email}</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="student@korea.ac.kr"/></label>{verifyError && <p className="error-text">{t.verify.error}</p>}<button className="primary full" onClick={verify}>{t.verify.send}<ArrowRight size={18}/></button></>}</Modal>;
}

function ProductModal({ lang, t, product, close, contact }: { lang: Lang; t: typeof copy[Lang]; product: Product; close: () => void; contact: () => void }) {
  const Icon = productIcons[product.icon]; return <Modal close={close} label={product.name[lang]}><button className="modal-close" onClick={close} aria-label={t.common.close}><X/></button><div className={`modal-product-visual tone-${product.id}`}><Icon/><span className="availability">{product.status === "Available" ? t.common.available : t.common.reserved}</span></div><span className="seller"><BadgeCheck size={16}/>{t.common.verified}</span><h2>{product.name[lang]}</h2><strong className="modal-price">{product.price}</strong><div className="product-modal-details"><div><span>{t.market.condition}</span><strong>{product.condition[lang]}</strong></div><div><span>{t.market.pickup}</span><strong><MapPin size={16}/>{product.pickup[lang]}</strong></div><div><span>{t.market.seller}</span><strong>{product.seller[lang]}</strong></div></div><button className="primary full" disabled={product.status === "Reserved"} onClick={contact}><MessageCircle size={18}/>{t.market.contact}</button></Modal>;
}

function ContactModal({ t, close }: { t: typeof copy[Lang]; close: () => void }) {
  const [ready, setReady] = useState(false); return <Modal close={close} label={t.market.contactTitle}><button className="modal-close" onClick={close} aria-label={t.common.close}><X/></button><div className="modal-icon"><MessageCircle/></div><h2>{t.market.contactTitle}</h2><p>{t.market.contactBody}</p><div className="message-preview">“{t.market.message}”</div><button className="primary full" onClick={() => setReady(true)}>{ready ? <Check/> : <MessageCircle/>}{ready ? t.market.copied : t.market.contact}</button></Modal>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Search; text: string }) { return <div className="empty-state"><Icon/><p>{text}</p></div>; }
