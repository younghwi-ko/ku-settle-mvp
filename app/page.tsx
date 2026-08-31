"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import type { TFunction } from "i18next";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Banknote, BedDouble, Box, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleUserRound, Clock3, CookingPot, FileCheck2, GraduationCap, HeartPulse, Hospital, House, Languages, LampDesk,
  Lightbulb, MapPin, Menu, MessageCircle, PackageCheck, RotateCcw, Search, ShieldCheck, ShoppingBag, Sparkles, Store, BookOpen,
  Tag, Trash2, Utensils, Vegan, X, Zap, Bell, HelpCircle, Loader2
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
import { accountFetch } from "./lib/account-api";
import { createMarketplaceItem, deleteAccount, importGuestData, loadAccount, saveProfile, saveProgress, signInWithPassword, signOut, updateMarketplaceItemStatus, validAccountPassword } from "./lib/repository";
import { googleMapsDirectionsUrl, googleMapsSearchUrl, isKuEmail, isOwnedMarketplaceProduct, isPickupPast, isValidImageDataUrl, isValidPickupSchedule, mapServiceError, profileRowToStored, validateMarketplaceInput, type AppMode, type ProfileRow, type StoredProfile } from "./lib/domain";
import { shouldShowVerifiedBadge } from "./lib/verification";
import { emptyPreferences, migrateLocalData, readLocalData, writeLocalData, type LocalPreferences, type LocalReservation, type ReportDraft, type LocalServiceRequest, type ServiceRequestMode } from "./lib/local-data";
import KakaoMap from "./components/kakao-map";
import AdminServerPanel from "./components/admin-server-panel";
import { dedupePlaces, isValidCoordinates, KU_CENTER, KU_SCIENCE_CENTER, matchesPlaceCategory, type KakaoSearchResponse, type CampusFilter } from "./lib/kakao";
import { bootstrapRemote, createRemoteListing, createRemoteReservation, deleteRemoteListing, fetchRemoteState, importRemoteState, serverListingToProduct, serverReservationToLocal, serverServiceToLocal, updateRemoteLifecycle, updateRemoteListing, updateRemoteReservation, upsertRemoteService } from "./lib/remote-state";

type Page = "home" | "onboarding" | "marketplace" | "guide" | "life-guide" | "admin" | "operation-model";
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
const guideCategoryIcons: Record<string, typeof BookOpen> = { housing: House, arrival: MapPin, immigration: ShieldCheck, "mobile-banking": Languages, academic: GraduationCap, healthcare: HeartPulse, daily: ShoppingBag, departure: PackageCheck };
const categoryProductIcons: Record<ProductCategory, ProductIcon> = { Home: "box", Kitchen: "cooking", Electronics: "fan", Bedding: "bed" };

function tr(t: TFunction, key: string, options?: Record<string, unknown>) {
  const value = String(t(key.replace(/^marketplace\./, "marketplace:"), options));
  const replacements: Array<[string, string]> = [["Demo data", "Sample data"], ["데모 데이터", "샘플 데이터"], ["Demo verification", "Anonymous session"], ["데모 인증", "익명 세션"], ["Demo mode", "Use without sign-in"], ["데모 모드", "로그인 없이 이용"], ["Demo message", "Message draft"], ["데모 메시지", "메시지 초안"], ["demo listings", "sample listings"], ["데모 상품", "샘플 상품"], ["데모 식당", "샘플 식당"], ["데모 의료기관", "샘플 의료기관"], ["데모 마켓", "샘플 마켓"], ["데모 장소", "내부 검증 장소"], ["Showing demo places", "Showing internal verification places"], ["No image upload is needed for this demo.", "Add an image to help buyers understand the item's condition."], ["このデモでは画像のアップロードは不要です。", "画像を追加すると商品の状態を確認しやすくなります。"], ["本演示不需要上传图片。", "添加图片可以帮助买家了解商品状态。"], ["발표용 데모", "시험 운영"], ["Demo", "Sample"], ["데모", "샘플"], ["デモ", "サンプル"], ["演示", "示例"]];
  return replacements.reduce((current, [from, to]) => current.split(from).join(to), value);
}
function ui(locale: Locale, key: string) { const copy: Record<string, Record<Locale, string>> = { due: { en: "Due date", ko: "예정일", ja: "予定日", "zh-CN": "预定日期" }, note: { en: "Note", ko: "메모", ja: "メモ", "zh-CN": "备注" }, important: { en: "Important", ko: "중요", ja: "重要", "zh-CN": "重要" }, personal: { en: "Personal task", ko: "개인 작업", ja: "個人タスク", "zh-CN": "个人任务" }, add: { en: "Add personal task", ko: "개인 작업 추가", ja: "個人タスクを追加", "zh-CN": "添加个人任务" }, delete: { en: "Delete", ko: "삭제", ja: "削除", "zh-CN": "删除" }, hide: { en: "Hide completed", ko: "완료 작업 숨기기", ja: "完了済みを隠す", "zh-CN": "隐藏已完成" }, show: { en: "Show completed", ko: "완료 작업 보기", ja: "完了済みを表示", "zh-CN": "显示已完成" }, allDates: { en: "All dates", ko: "전체 날짜", ja: "すべての日付", "zh-CN": "所有日期" }, today: { en: "Today", ko: "오늘", ja: "今日", "zh-CN": "今天" }, week: { en: "This week", ko: "이번 주", ja: "今週", "zh-CN": "本周" }, none: { en: "No date", ko: "예정 없음", ja: "予定なし", "zh-CN": "无日期" } }; return copy[key]?.[locale] ?? key; }
function guideUi(locale: Locale, key: string) { const copy: Record<string, Record<Locale, string>> = {
  checklist: { en: "Preparation", ko: "준비물", ja: "準備するもの", "zh-CN": "准备事项" }, steps: { en: "Steps", ko: "진행 순서", ja: "進め方", "zh-CN": "步骤" }, cautions: { en: "Cautions", ko: "주의사항", ja: "注意事項", "zh-CN": "注意事项" }, duration: { en: "Estimated time", ko: "예상 소요시간", ja: "所要時間", "zh-CN": "预计用时" }, officialOrigin: { en: "Official-source guide", ko: "공식 출처 기반 안내", ja: "公式出典に基づく案内", "zh-CN": "基于官方来源的指南" }, demoOrigin: { en: "Demo content", ko: "데모 콘텐츠", ja: "デモコンテンツ", "zh-CN": "演示内容" }, sourceVerified: { en: "Verified source", ko: "확인된 공식 출처", ja: "確認済みの公式出典", "zh-CN": "已确认的官方来源" }, sourceUnavailable: { en: "No official source available", ko: "공식 출처 없음", ja: "公式出典なし", "zh-CN": "暂无官方来源" }, sourceNeedsConfirmation: { en: "Official source needs confirmation", ko: "공식 출처 확인 필요", ja: "公式出典の確認が必要", "zh-CN": "需要确认官方来源" }, officialSource: { en: "Open official source", ko: "공식 출처 열기", ja: "公式出典を開く", "zh-CN": "打开官方来源" }, sourceName: { en: "Source name", ko: "출처명", ja: "出典名", "zh-CN": "来源名称" }, sourceUrl: { en: "Official URL", ko: "공식 URL", ja: "公式URL", "zh-CN": "官方URL" }, checked: { en: "Content checked", ko: "콘텐츠 확인일", ja: "コンテンツ確認日", "zh-CN": "内容确认日期" }, checkedNote: { en: "This is the content review date, not an official update date.", ko: "콘텐츠를 점검한 날짜이며 공식 정보 갱신일과 다를 수 있습니다.", ja: "コンテンツの確認日であり、公式情報の更新日とは異なる場合があります。", "zh-CN": "这是内容检查日期，可能不同于官方信息更新日期。" }, changing: { en: "Administrative, healthcare, finance, and telecom conditions may change. Check the latest official notice.", ko: "행정·의료·금융·통신 조건은 바뀔 수 있으므로 최신 공식 안내를 확인하세요.", ja: "行政・医療・金融・通信の条件は変わることがあるため、最新の公式案内を確認してください。", "zh-CN": "行政、医疗、金融和通信条件可能变化，请确认最新官方通知。" }
}; if (key === "demoOrigin") return ({ en: "Sample content", ko: "샘플 콘텐츠", ja: "サンプルコンテンツ", "zh-CN": "示例内容" } as Record<Locale, string>)[locale]; return copy[key]?.[locale] ?? key; }

function guideViewUi(locale: Locale, key: "details" | "recommendation" | "status") {
  const copy = {
    details: { ko: "자세히 보기", en: "View details", ja: "詳細を見る", "zh-CN": "查看详情" },
    recommendation: { ko: "지금 해야 할 일", en: "Recommended now", ja: "今すぐすること", "zh-CN": "现在要做的事" },
    status: { ko: "확인 상태", en: "Information status", ja: "確認状態", "zh-CN": "信息状态" },
  } as const;
  return copy[key][locale];
}

function guideProgressUi(locale: Locale, done: boolean, hasTask: boolean) {
  if (done) return locale === "ko" ? "완료" : locale === "ja" ? "完了" : locale === "zh-CN" ? "已完成" : "Completed";
  if (hasTask) return locale === "ko" ? "진행 중" : locale === "ja" ? "進行中" : locale === "zh-CN" ? "进行中" : "In progress";
  return locale === "ko" ? "미완료" : locale === "ja" ? "未完了" : locale === "zh-CN" ? "未完成" : "Not started";
}

function guideDuration(locale: Locale, min: number, max: number) {
  const unit = locale === "ko" ? "분" : locale === "ja" ? "分" : locale === "zh-CN" ? "分钟" : " min";
  return `${min}–${max}${unit}`;
}

function serviceUi(locale: Locale, key: string) { const copy: Record<string, Record<Locale, string>> = {
  pickup: { ko: "캠퍼스 픽업", en: "Campus pickup", ja: "キャンパス受け取り", "zh-CN": "校园自取" }, delivery: { ko: "배송", en: "Delivery", ja: "配送", "zh-CN": "配送" }, storage: { ko: "보관", en: "Storage", ja: "保管", "zh-CN": "寄存" }, sale: { ko: "판매", en: "Sale", ja: "販売", "zh-CN": "出售" }, donation: { ko: "기부", en: "Donation", ja: "寄付", "zh-CN": "捐赠" }, disposal: { ko: "폐기", en: "Disposal", ja: "廃棄", "zh-CN": "处理" }, notice: { ko: "선택한 서비스와 진행 상태를 저장합니다. 결제·배송업체·보관업체·메시지 연동은 준비 중입니다.", en: "Your selected service and progress are saved. Payment, provider, and messaging integrations are planned.", ja: "選択したサービスと進行状況を保存します。決済・業者・メッセージ連携は準備中です。", "zh-CN": "我们会保存所选服务和进度。支付、服务商和消息功能正在准备中。" }, method: { ko: "서비스 선택", en: "Choose a service", ja: "サービスを選択", "zh-CN": "选择服务" }, ready: { ko: "상담 준비", en: "Prepare consultation", ja: "相談を準備", "zh-CN": "准备咨询" }, quote: { ko: "견적 확인", en: "View estimate", ja: "見積もりを見る", "zh-CN": "查看报价" }, selected: { ko: "선택됨", en: "Selected", ja: "選択済み", "zh-CN": "已选择" }, duration: { ko: "보관 기간", en: "Storage period", ja: "保管期間", "zh-CN": "寄存期限" }, location: { ko: "보관 장소", en: "Storage location", ja: "保管場所", "zh-CN": "寄存地点" }, cost: { ko: "예상 비용: 견적 확인 필요", en: "Estimated cost: estimate required", ja: "見積もり: 確認が必要", "zh-CN": "预计费用：需要确认报价" }, operation: { ko: "서비스 운영 모델", en: "Service model", ja: "サービス運営モデル", "zh-CN": "服务运营模式" }, free: { ko: "무료로 제공 중", en: "Available now", ja: "現在利用できる機能", "zh-CN": "当前可用" }, paid: { ko: "향후 연동 예정", en: "Planned integrations", ja: "今後連携予定", "zh-CN": "计划中的集成" }, mvp: { ko: "내부 운영 메모", en: "Internal operations note", ja: "内部運用メモ", "zh-CN": "内部运营备注" }, status: { ko: "상태", en: "Status", ja: "状態", "zh-CN": "状态" }, notSelected: { ko: "선택 전", en: "Not selected", ja: "未選択", "zh-CN": "未选择" }, methodSelected: { ko: "방법 선택", en: "Method selected", ja: "方法選択済み", "zh-CN": "已选择方式" }, consultation: { ko: "상담 준비 완료", en: "Consultation ready", ja: "相談準備完了", "zh-CN": "咨询准备完成" }, viewed: { ko: "견적 확인 완료", en: "Estimate viewed", ja: "見積もり確認済み", "zh-CN": "报价已查看" }
}; return copy[key]?.[locale] ?? key; }
function serviceStatusUi(locale: Locale, status: import("./lib/local-data").ServiceRequestStatus) { const labels: Record<string, Record<Locale, string>> = { "not-selected": { ko: "선택 전", en: "Not selected", ja: "未選択", "zh-CN": "未选择" }, "method-selected": { ko: "방법 선택", en: "Method selected", ja: "方法選択済み", "zh-CN": "已选择方式" }, "consultation-ready": { ko: "상담 준비", en: "Consultation ready", ja: "相談準備", "zh-CN": "咨询准备" }, "quote-viewed": { ko: "견적 확인", en: "Quote viewed", ja: "見積もり確認", "zh-CN": "已查看报价" }, "application-ready": { ko: "신청 준비 완료", en: "Application ready", ja: "申請準備完了", "zh-CN": "申请准备完成" }, "in-progress": { ko: "진행 중", en: "In progress", ja: "進行中", "zh-CN": "进行中" }, completed: { ko: "완료", en: "Completed", ja: "完了", "zh-CN": "已完成" }, cancelled: { ko: "취소", en: "Cancelled", ja: "キャンセル", "zh-CN": "已取消" } }; return labels[status][locale]; }

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
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
  const [remoteReady, setRemoteReady] = useState(false);
  const [remotePublicProducts, setRemotePublicProducts] = useState<MarketProduct[]>([]);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

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
      if (savedProducts) { try { loadedProducts = normalizeUserProducts(JSON.parse(savedProducts)).map((product) => ({ ...product, source: "sample", ownedByCurrentUser: true })); } catch { loadedProducts = []; } }
      setUserProducts(loadedProducts);
      if (loadedProfile?.mode === "personalized") {
        candidate = { profile: loadedProfile, done: loadedDone, products: loadedProducts };
        setGuestCandidate(candidate);
        guestCandidateRef.current = candidate;
      }
      setVerified(migrated.verified); setLocalPreferences(migrated.preferences); writeLocalData(localStorage, storageKeys.data, migrated);
      setHydrated(true);
      void (async () => {
        if (!await bootstrapRemote()) return;
        try {
          const remote = await fetchRemoteState();
          if (remote.myListings?.length) setUserProducts(remote.myListings.map(serverListingToProduct));
          else if (loadedProducts.length || loadedProfile) await importRemoteState({ profile: loadedProfile, done: loadedDone, products: loadedProducts, preferences: migrated.preferences, locale });
          setRemotePublicProducts(remote.listings.filter((item) => !remote.myListings?.some((mine) => mine.id === item.id)).map((item) => ({ ...serverListingToProduct(item), ownedByCurrentUser: false })));
          const reservations = remote.reservations.map(serverReservationToLocal).filter((item): item is LocalReservation => Boolean(item));
          const services = remote.serviceRequests.map(serverServiceToLocal).filter((item): item is LocalServiceRequest => Boolean(item));
          // A successful server response is authoritative, including an empty list
          // after an administrator has soft-deleted or completed prior requests.
          setLocalPreferences((current) => ({ ...current, reservations, reservedProductIds: reservations.filter((item) => item.status === "active").map((item) => item.productId), serviceRequests: services }));
          setRemoteReady(true);
        } catch { setRemoteReady(false); }
      })();
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
    try { writeLocalData(localStorage, storageKeys.data, { version: 7, profile, done, products: userProducts, verified, preferences: localPreferences }); } catch { window.setTimeout(() => setServiceMessage("errors:storageQuota"), 0); }
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
  const marketplaceProducts = useMemo(() => [...userProducts.filter((product) => product.serviceStatus !== "deleted"), ...remotePublicProducts, ...products].map((product) => localPreferences.reservedProductIds.includes(String(product.id)) && product.serviceStatus !== "sold" ? { ...product, status: "Reserved" as const } : product), [userProducts, remotePublicProducts, products, localPreferences.reservedProductIds]);
  const localPlaces = useMemo(() => [...places.filter((place) => !localPreferences.deletedPlaceIds.includes(place.id)), ...localPreferences.customPlaces].map((place) => ({ ...place, ...(localPreferences.placeOverrides[String(place.id)] ?? {}) })).filter((place) => place.operatingStatus !== "inactive"), [localPreferences.customPlaces, localPreferences.deletedPlaceIds, localPreferences.placeOverrides]);
  const navItems: { key: Page; icon: typeof GraduationCap; labelKey: string }[] = [
    { key: "home", icon: GraduationCap, labelKey: "navigation:home" },
    { key: "onboarding", icon: FileCheck2, labelKey: "navigation:onboarding" },
    { key: "life-guide", icon: BookOpen, labelKey: "navigation:lifeGuide" },
    { key: "marketplace", icon: ShoppingBag, labelKey: "navigation:marketplace" },
    { key: "guide", icon: MapPin, labelKey: "navigation:localGuide" }
  ];

  const go = (target: Page, intent: NavigationIntent = {}) => {
    if (target !== "admin") setAdminAuthenticated(false);
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
    if (remoteReady && appMode !== "authenticated") void updateRemoteLifecycle(id, !wasDone).catch(() => { setDone(done); setServiceMessage("errors:generic"); });
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
    setResetOpen(false); setProfileOpen(false); setProfileMenuOpen(false); setPage("home"); setSetupOpen(false); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeMarketplaceStatus = async (product: MarketProduct, status: "active" | "sold" | "hidden" | "deleted") => {
    if (appMode !== "authenticated" && product.userCreated && product.ownedByCurrentUser) {
      setUserProducts((current) => status === "deleted"
        ? current.filter((item) => item.id !== product.id)
        : current.map((item) => item.id === product.id ? { ...item, serviceStatus: status, status: status === "sold" ? "Reserved" : "Available" } : item));
      if (status === "sold") setLocalPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.map((item) => item.productId === String(product.id) && item.status === "active" ? { ...item, status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item) }));
      if (status === "deleted") setLocalPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.filter((item) => item.productId !== String(product.id)), reportDrafts: current.reportDrafts.filter((item) => item.productId !== String(product.id)), serviceRequests: current.serviceRequests.filter((item) => item.productId !== String(product.id)) }));
      if (status === "deleted") setSelectedProduct(null);
      else setSelectedProduct((current) => current?.id === product.id ? { ...current, serviceStatus: status, status: status === "sold" ? "Reserved" : "Available" } : current);
      if (remoteReady && typeof product.id === "string" && product.id.includes("-")) {
        const sync = status === "deleted" ? deleteRemoteListing(product.id) : updateRemoteListing({ ...product, serviceStatus: status }, status);
        void sync.catch(() => setServiceMessage("errors:generic"));
      }
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
    if (appMode === "demo" || appMode === "guest") { if (remoteReady) { try { const created = await createRemoteListing(product, currentProfile.name); setUserProducts((current) => [created, ...current]); setServiceMessage("common:saved"); return; } catch { setServiceMessage("errors:generic"); throw new Error("Remote listing save failed"); } } setUserProducts((current) => [{ ...product, source: "sample", ownedByCurrentUser: true, serviceStatus: "active" }, ...current]); setServiceMessage("common:saved"); return; }
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
    const nextReservation = { id: existingId ?? `reservation-${Date.now()}`, productId, buyerName: currentProfile.name, status: "active" as const, createdAt: existingId ? (localPreferences.reservations.find((item) => item.id === existingId)?.createdAt ?? now) : now, updatedAt: now, ...pickup };
    setLocalPreferences((current) => ({ ...current, reservedProductIds: [...new Set([...current.reservedProductIds, productId])], reservations: [...current.reservations.filter((item) => !(item.productId === productId && item.status === "active")), nextReservation] }));
    if (remoteReady && product.userCreated) void createRemoteReservation(product, currentProfile.name, pickup).catch(() => setServiceMessage("errors:generic"));
    setPendingReservation(null);
    setSelectedProduct((current) => current?.id === product.id ? { ...current, status: "Reserved" } : current);
    setServiceMessage("common:saved");
  };
  const cancelMarketplaceReservation = (product: MarketProduct) => {
    const productId = String(product.id);
    const reservation = localPreferences.reservations.find((item) => item.productId === productId && item.status === "active");
    setLocalPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== productId), reservations: current.reservations.map((item) => item.productId === productId && item.status === "active" ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString() } : item) }));
    if (remoteReady && reservation && !reservation.id.startsWith("reservation-")) void updateRemoteReservation(reservation.id, { status: "cancelled" }).catch(() => setServiceMessage("errors:generic"));
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
    setUserProducts((current) => current.map((item) => item.id === product.id ? { ...item, ...product, source: "sample", ownedByCurrentUser: true } : item));
    if (remoteReady && typeof product.id === "string" && product.id.includes("-")) void updateRemoteListing(product).catch(() => setServiceMessage("errors:generic"));
    setEditingProduct(null); setSelectedProduct(null); setServiceMessage("common:saved");
  };
  const toggleProductFavorite = (product: MarketProduct) => {
    const id = String(product.id);
    setLocalPreferences((current) => ({ ...current, favoriteProductIds: current.favoriteProductIds.includes(id) ? current.favoriteProductIds.filter((item) => item !== id) : [...current.favoriteProductIds, id] }));
  };
  const updateServiceRequest = async (target: { productId?: string; taskId?: string }, mode: ServiceRequestMode, updates: Partial<LocalServiceRequest> = {}) => {
    const existing = localPreferences.serviceRequests.find((item) => item.productId === target.productId && item.taskId === target.taskId && item.mode === mode); const now = new Date().toISOString(); const next: LocalServiceRequest = { ...(existing ?? { id: `service-${Date.now()}`, createdAt: now }), ...target, mode, status: updates.status ?? existing?.status ?? "method-selected", updatedAt: now, ...updates };
    setLocalPreferences((current) => { const index = current.serviceRequests.findIndex((item) => item.id === next.id); return { ...current, serviceRequests: index >= 0 ? current.serviceRequests.map((item, i) => i === index ? next : item) : [next, ...current.serviceRequests] }; });
    if (!remoteReady) return;
    try {
      const saved = serverServiceToLocal(await upsertRemoteService(next));
      if (!saved) throw new Error("invalid_service_response");
      setLocalPreferences((current) => ({ ...current, serviceRequests: current.serviceRequests.some((item) => item.id === next.id) ? current.serviceRequests.map((item) => item.id === next.id ? saved : item) : [saved, ...current.serviceRequests] }));
      setServiceMessage("common:saved");
    } catch {
      // Do not leave an unsaved optimistic service request on screen. Re-read the
      // server state when possible so a concurrent administrator update wins.
      try {
        const remote = await fetchRemoteState();
        const requests = remote.serviceRequests.map(serverServiceToLocal).filter((item): item is LocalServiceRequest => Boolean(item));
        setLocalPreferences((current) => ({ ...current, serviceRequests: requests }));
      } catch {
        setLocalPreferences((current) => ({ ...current, serviceRequests: existing ? current.serviceRequests.map((item) => item.id === next.id ? existing : item) : current.serviceRequests.filter((item) => item.id !== next.id) }));
      }
      setServiceMessage("errors:generic");
    }
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
    const blob = new Blob([JSON.stringify({ version: 8, profile, done, products: userProducts, verified, preferences: localPreferences }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ku-settle-demo-data.json"; anchor.click(); URL.revokeObjectURL(url);
  };
  const importDemoData = (file: File) => {
    const reader = new FileReader(); reader.onload = () => { try { const parsed: unknown = JSON.parse(String(reader.result)); if (!isRecord(parsed) || !("profile" in parsed) || !("done" in parsed) || !("products" in parsed) || !("preferences" in parsed)) throw new Error("invalid data"); const data = migrateLocalData(parsed); const importedProducts = normalizeUserProducts(data.products); const active = data.profile ? getActiveTasks(data.profile.housing) : getActiveTasks("dorm"); const importedDone = normalizeDone(data.done, active, data.profile?.mode === "demo" ? demoDone : []); setProfile(data.profile); setDone(importedDone); setUserProducts(importedProducts.map((product) => ({ ...product, source: "sample", userCreated: true, ownedByCurrentUser: true }))); setVerified(data.verified); setLocalPreferences(data.preferences); setServiceMessage("common:saved"); } catch { setServiceMessage("errors:generic"); } }; reader.readAsText(file);
  };

  if (!localeReady || !hydrated) return <InitialLoading/>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go("home")} aria-label={tr(t, "accessibility:brandHome")}>
          <span className="brand-mark">KU</span><span><strong>KU Settle</strong><small>{tr(t, "navigation:brandTagline")}</small></span>
        </button>
        <nav className="desktop-nav" aria-label={tr(t, "navigation:primaryLabel")}>
          {navItems.map(({ key, labelKey }) => <button key={key} onClick={() => go(key)} className={page === key ? "active" : ""}>{labelKey === "__operationModel" ? serviceUi(locale, "operation") : tr(t, labelKey)}</button>)}
        </nav>
        <div className="header-actions">
          <LanguageSelector locale={locale} changeLocale={changeLocale} t={t}/>
          <button className="profile-button" onClick={() => setNotificationsOpen(true)} aria-label={locale === "ko" ? "알림함" : "Notifications"}><Bell size={20}/></button>
          <button className="profile-button" onClick={() => setSupportOpen(true)} aria-label={locale === "ko" ? "운영 문의" : "Support"}><HelpCircle size={20}/></button>
          <button className="profile-button" onClick={() => appMode === "authenticated" ? setAccountOpen(true) : setProfileMenuOpen((value) => !value)} aria-label={tr(t, "accessibility:profile")} aria-expanded={appMode !== "authenticated" ? profileMenuOpen : undefined}>
            {showVerifiedBadge ? <BadgeCheck size={20} className="verified-icon"/> : <CircleUserRound size={20}/>}<span>{currentProfile.name}</span>
           </button>
          {appMode !== "authenticated" && profileMenuOpen && <div className="profile-menu" role="menu">
            <div className="profile-menu-heading"><strong>{currentProfile.name}</strong><span>{locale === "ko" ? "익명 프로필" : locale === "ja" ? "匿名プロフィール" : locale === "zh-CN" ? "匿名资料" : "Anonymous profile"}</span></div>
            <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setProfileOpen(true); }}><CircleUserRound size={16}/>{locale === "ko" ? "프로필 확인" : locale === "ja" ? "プロフィール確認" : locale === "zh-CN" ? "查看资料" : "View profile"}</button>
            <button role="menuitem" onClick={() => { setProfileMenuOpen(false); setResetOpen(true); }}><RotateCcw size={16}/>{locale === "ko" ? "내 데이터 초기화" : locale === "ja" ? "自分のデータを初期化" : locale === "zh-CN" ? "重置我的数据" : "Reset my data"}</button>{appMode === "demo" && <button role="menuitem" onClick={() => { setProfileMenuOpen(false); go("admin"); }}><ShieldCheck size={16}/>{locale === "ko" ? "관리자 패널" : locale === "ja" ? "管理者パネル" : locale === "zh-CN" ? "管理员面板" : "Admin panel"}</button>}
          </div>}
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={tr(t, menuOpen ? "navigation:closeMenu" : "navigation:openMenu")} aria-expanded={menuOpen}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label={tr(t, "navigation:mobileLabel")}>{navItems.map(({ key, labelKey, icon: Icon }) => <button key={key} onClick={() => { go(key); setMenuOpen(false); }} className={page === key ? "active" : ""}><Icon size={18}/>{labelKey === "__operationModel" ? serviceUi(locale, "operation") : tr(t, labelKey)}</button>)}</nav>}

      <main>
        {page === "home" && <Dashboard locale={locale} t={t} profile={currentProfile} activeTasks={activeTasks} stageStats={stageStats} progress={progress} completedCount={completedCount} recommendedTask={recommendedTask} go={go}/>}
        {page === "onboarding" && <Onboarding locale={locale} t={t} activeTasks={activeTasks} stageStats={stageStats} progress={progress} done={done} recommendedTask={recommendedTask} selectedStage={selectedStage} setSelectedStage={setSelectedStage} focusTaskId={focusTaskId} highlightTaskId={highlightTaskId} go={go} openTaskAction={openTaskAction} toggleTask={toggleTask} preferences={localPreferences} setPreferences={setLocalPreferences}/>}
        {page === "marketplace" && <Marketplace locale={locale} t={t} profile={currentProfile} appMode={appMode} products={marketplaceProducts} search={marketSearch} setSearch={setMarketSearch} category={marketCategory} setCategory={setMarketCategory} mode={marketMode} setMode={setMarketMode} addProduct={addMarketplaceProduct} selectProduct={openProduct} selectSellerProduct={openSellerProduct} preferences={localPreferences} setPreferences={setLocalPreferences} toggleFavorite={toggleProductFavorite}/>}
        {page === "life-guide" && <LifeGuide locale={locale} search={lifeGuideSearch} setSearch={setLifeGuideSearch} category={lifeGuideCategory} setCategory={setLifeGuideCategory} go={go} preferences={localPreferences} done={done}/>}
        {page === "guide" && <LocalGuide locale={locale} t={t} category={guideCategory} setCategory={setGuideCategory} search={guideSearch} setSearch={setGuideSearch} places={localPlaces} preferences={localPreferences} setPreferences={setLocalPreferences}/>}
        {page === "operation-model" && <OperationModel locale={locale} />}
        {page === "admin" && appMode === "demo" && <><AdminServerPanel locale={locale} onAuthChange={setAdminAuthenticated}/>{adminAuthenticated && <OperationModel locale={locale} />}</>}
      </main>
      {page === "marketplace" && <MyReservations locale={locale} t={t} products={marketplaceProducts} preferences={localPreferences} cancelReservation={cancelMarketplaceReservation} selectReservation={(product) => openProduct(product)} editReservation={editMarketplaceReservation}/>}
      {page === "marketplace" && marketMode === "leaving" && <ListingReports locale={locale} t={t} products={userProducts} reports={localPreferences.reportDrafts}/>}
      {page === "home" && <LifecycleSummary locale={locale} t={t} activeTasks={activeTasks} done={done} preferences={localPreferences} products={marketplaceProducts} go={go}/>}

      <footer><div className="footer-brand"><span className="brand-mark small">KU</span><span><strong>KU Settle</strong><small>{tr(t, "common:copyright", { year: formatNumber(locale, new Date().getFullYear(), { useGrouping: false }) })}</small></span></div><div className="footer-actions"><span className="footer-notice">{tr(t, "navigation:footerNotice")}</span>{(["about", "terms", "privacy", "safety", "sources", "disclaimer"] as const).map((item) => <button key={item} onClick={() => setInfoPage(item)}>{item}</button>)}{appMode !== "authenticated" && <><button className="reset-demo" onClick={exportDemoData}>{locale === "ko" ? "내보내기" : locale === "ja" ? "エクスポート" : locale === "zh-CN" ? "导出" : "Export"}</button><label className="reset-demo">{locale === "ko" ? "가져오기" : locale === "ja" ? "インポート" : locale === "zh-CN" ? "导入" : "Import"}<input type="file" accept="application/json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) importDemoData(file); }}/></label></>}</div></footer>

      {(serverBusy || serviceMessage) && <div className={`service-status ${serviceMessage?.startsWith("errors:") ? "error" : ""}`} role="status">{serverBusy ? tr(t, "common:saving") : serviceMessage ? tr(t, serviceMessage) : ""}{serviceMessage && <button onClick={() => setServiceMessage(null)} aria-label={tr(t, "common:close")}><X size={14}/></button>}</div>}

      {setupOpen && (
        <SetupModal t={t} submit={startPersonalizedPlan} skip={skipForDemo}/>
      )}
      {resetOpen && <ResetModal t={t} close={() => setResetOpen(false)} confirm={resetDemo}/>}
      {infoPage && <PublicInfoModal locale={locale} page={infoPage} close={() => setInfoPage(null)}/>}
      {profileOpen && (
        <VerificationModal locale={locale} t={t} profile={currentProfile} email={email} setEmail={setEmail} verified={verified} verifyError={verifyError} close={() => setProfileOpen(false)} verify={() => { const ok = /^[^@\s]+@korea\.ac\.kr$/i.test(email); setVerifyError(!ok); if (ok) setVerified(true); }}/>
      )}
      {authOpen && <AuthModal locale={locale} t={t} close={() => setAuthOpen(false)} configured={isSupabaseConfigured()} />}
      {notificationsOpen && <NotificationsModal locale={locale} close={() => setNotificationsOpen(false)}/>} 
      {supportOpen && <SupportTicketsModal locale={locale} close={() => setSupportOpen(false)}/>} 
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
        <ProductModal locale={locale} t={t} profile={currentProfile} mode={selectedProductMode} product={selectedProduct} reservation={localPreferences.reservations.find((item) => item.productId === String(selectedProduct.id) && item.status === "active")} serviceRequests={localPreferences.serviceRequests.filter((item) => item.productId === String(selectedProduct.id))} updateService={(serviceMode, updates) => updateServiceRequest({ productId: String(selectedProduct.id) }, serviceMode, updates)} close={() => setSelectedProduct(null)} contact={() => { setSelectedProduct(null); setContactOpen(true); }} reserve={() => reserveMarketplaceProduct(selectedProduct)} cancelReservation={() => cancelMarketplaceReservation(selectedProduct)} edit={() => { setEditingProduct(selectedProduct); setSelectedProduct(null); }} changeStatus={(status) => void changeMarketplaceStatus(selectedProduct, status)}/>
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

function OperationModel({ locale }: { locale: Locale }) {
  const current = locale === "ko" ? ["익명 세션 기반 이용", "상품 등록·예약 흐름", "배송·보관 신청 정보 저장", "서버 상태 복원", "관리자 상태 관리"] : ["Anonymous-session access", "Listing and reservation flow", "Saved delivery and storage requests", "Server state restore", "Admin status management"];
  const planned = locale === "ko" ? ["실제 결제", "배송업체 연동", "보관업체 연동", "외부 메시지·문의 연동"] : ["Real payments", "Delivery provider integration", "Storage provider integration", "External messaging and inquiries"];
  const internal = locale === "ko" ? ["학생 간 수요와 공급", "배송·보관 이용 의향", "학교·기업 제휴 가능성"] : ["Student supply and demand", "Interest in delivery and storage", "School and company partnership potential"];
  const rows = [{ title: serviceUi(locale, "free"), items: current }, { title: serviceUi(locale, "paid"), items: planned }, { title: serviceUi(locale, "mvp"), items: internal }];
  return <section className="page section-pad"><div className="page-hero"><div><span className="eyebrow"><Banknote size={14}/>{serviceUi(locale, "operation")}</span><h1>{serviceUi(locale, "operation")}</h1><p>{serviceUi(locale, "notice")}</p></div></div><div className="feature-grid">{rows.map((row) => <article className="feature-card" key={row.title}><h2>{row.title}</h2><ul>{row.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div></section>;
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

function DepartureServiceFlow({ locale }: { locale: Locale }) {
  const modes: ServiceRequestMode[] = ["sale", "delivery", "storage", "donation", "disposal"];
  const [selectedMode, setSelectedMode] = useState<ServiceRequestMode | null>(null);
  return <article className="service-demo-box departure-service"><strong>{locale === "ko" ? "귀국 준비 서비스 안내" : "Departure service guide"}</strong><div className="service-option-grid">{modes.map((mode) => <button key={mode} className={selectedMode === mode ? "active" : ""} onClick={() => setSelectedMode(mode)}>{serviceUi(locale, mode)}</button>)}</div><p className="muted-copy">{locale === "ko" ? "배송·보관 신청은 실제 상품 상세에서 제출됩니다. 여기서 선택한 항목은 준비 안내용이며 신청 상태를 변경하지 않습니다." : "Delivery and storage requests are submitted from a live listing. This selection is only a preparation guide and does not change a request status."}</p>{selectedMode && <span className="status progress">{locale === "ko" ? `${serviceUi(locale, selectedMode)} 준비 안내를 확인하세요.` : `Review the preparation guidance for ${serviceUi(locale, selectedMode)}.`}</span>}</article>;
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
    {selectedStage === "departure" && <DepartureServiceFlow locale={locale}/>}<article className="listing-form"><h2>{ui(locale, "personal")}</h2><form className="listing-grid" onSubmit={(e) => { e.preventDefault(); if (!customTitle.trim()) return; setPreferences((p) => ({ ...p, customTasks: [...p.customTasks, { id: `personal-${Date.now()}`, title: customTitle.trim(), stage: selectedStage, dueDate: customDate, note: customNote, completed: false }] })); setCustomTitle(""); setCustomDate(""); setCustomNote(""); }}><label className="field"><span>{locale === "ko" ? "작업명" : "Task name"}</span><input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}/></label><label className="field"><span>{ui(locale, "due")}</span><input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}/></label><label className="field field-wide"><span>{ui(locale, "note")}</span><input value={customNote} onChange={(e) => setCustomNote(e.target.value)}/></label><button className="primary" type="submit">{ui(locale, "add")}</button></form>{preferences.customTasks.filter((task) => task.stage === selectedStage).map((task) => <div className="personal-task-tools" key={task.id}><button onClick={() => setPreferences((p) => ({ ...p, customTasks: p.customTasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item) }))}>{task.completed ? "✓" : "○"}</button><strong>{task.title}</strong><span>{task.dueDate || ui(locale, "none")}</span><button onClick={() => setPreferences((p) => ({ ...p, customTasks: p.customTasks.filter((item) => item.id !== task.id) }))}>{ui(locale, "delete")}</button></div>)}</article>
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

function LifecycleSummary({ locale, t, activeTasks, done, preferences, products, go }: { locale: Locale; t: TFunction; activeTasks: Task[]; done: string[]; preferences: LocalPreferences; products: MarketProduct[]; go: (page: Page, intent?: NavigationIntent) => void }) {
  const [now] = useState(() => new Date()); const today = localIsoDate(now); const limit = new Date(now); limit.setDate(limit.getDate() + 3); const limitDate = localIsoDate(limit);
  const due = activeTasks.map((task) => ({ task, due: preferences.dueDates[task.id] ?? "" })).filter(({ task, due }) => !done.includes(task.id) && due && due <= limitDate).sort((a, b) => a.due.localeCompare(b.due));
  const reservations = preferences.reservations.filter((item) => item.status === "active");
  const services = preferences.serviceRequests.filter((item) => item.status !== "completed");
  const hasItems = due.length || reservations.length || services.length;
  return <section className="lifecycle-summary section-pad" aria-label={tr(t, "home:todaySummary")}><div className="section-title"><span className="eyebrow"><CalendarClock size={14}/>{tr(t, "home:todaySummary")}</span><h2>{hasItems ? tr(t, "home:urgentItems") : tr(t, "home:noUpcoming")}</h2></div><div className="summary-metrics"><span>{tr(t, "home:incompleteCount", { count: activeTasks.filter((task) => !done.includes(task.id)).length })}</span><span>{tr(t, "home:progressSummaryShort", { progress: Math.round((done.length / Math.max(1, activeTasks.length)) * 100) })}</span></div>{hasItems ? <div className="summary-items">{due.slice(0, 4).map(({ task, due }) => <button key={task.id} onClick={() => go("onboarding", { stage: task.stage, taskId: task.id, highlight: true })}><strong>{due < today ? tr(t, "home:overdue") : due === today ? tr(t, "home:dueToday") : tr(t, "home:dueSoon")}</strong><span>{tr(t, task.titleKey)}</span></button>)}{reservations.slice(0, 3).map((reservation) => { const product = products.find((item) => String(item.id) === reservation.productId); return product ? <button key={reservation.id} onClick={() => go("marketplace")}><strong>{tr(t, "marketplace:myReservations")}</strong><span>{productName(product, t)}</span></button> : null; })}{services.slice(0, 3).map((service) => <button key={service.id} onClick={() => go(service.productId ? "marketplace" : "onboarding", service.productId ? {} : { stage: "departure" })}><strong>{serviceStatusUi(locale, service.status)}</strong><span>{serviceUi(locale, service.mode)}</span></button>)}</div> : <p className="empty-copy">{tr(t, "home:noUpcoming")}</p>}</section>;
}

type AdminOverviewData = { listings: Array<{ id: string; item_name: string; status: string; price_krw: number }>; reservations: Array<{ id: string; status: string; listing_id: string }>; serviceRequests: Array<{ id: string; service_type: string; status: string }>; reports: Array<{ id: string; status: string }>; placeOverrides: Array<{ place_key: string; status: string }>; guideOverrides: Array<{ guide_key: string; status: string }>; counts: Record<string, number> };

function LegacyAdminServerPanel({ locale }: { locale: Locale }) {
  const [token, setToken] = useState(""); const [authenticated, setAuthenticated] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [data, setData] = useState<AdminOverviewData | null>(null);
  const labels = locale === "ko" ? { auth: "관리자 API 인증", token: "ADMIN_API_TOKEN 입력", signIn: "관리자 세션 시작", signOut: "관리자 로그아웃", refresh: "서버 데이터 새로고침", forbidden: "관리자 권한이 필요합니다.", network: "서버 연결에 실패했습니다.", saved: "서버에 저장되었습니다." } : locale === "ja" ? { auth: "管理者API認証", token: "ADMIN_API_TOKENを入力", signIn: "管理者セッションを開始", signOut: "管理者ログアウト", refresh: "サーバーデータを更新", forbidden: "管理者権限が必要です。", network: "サーバーに接続できません。", saved: "サーバーに保存しました。" } : locale === "zh-CN" ? { auth: "管理员API认证", token: "输入ADMIN_API_TOKEN", signIn: "开始管理员会话", signOut: "管理员退出", refresh: "刷新服务器数据", forbidden: "需要管理员权限。", network: "无法连接服务器。", saved: "已保存到服务器。" } : { auth: "Admin API access", token: "Enter ADMIN_API_TOKEN", signIn: "Start admin session", signOut: "Log out admin", refresh: "Refresh server data", forbidden: "Admin permission is required.", network: "Could not connect to the server.", saved: "Saved to the server." };
  const load = async () => { setLoading(true); setError(""); try { const response = await fetch("/api/admin/overview", { credentials: "include" }); if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "forbidden" : "network"); setData(await response.json() as AdminOverviewData); setAuthenticated(true); } catch (cause) { setError(cause instanceof Error && cause.message === "forbidden" ? labels.forbidden : labels.network); setAuthenticated(false); } finally { setLoading(false); } };
  const signIn = async () => { if (!token.trim()) return; setLoading(true); setError(""); try { const response = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ token: token.trim() }) }); if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "forbidden" : "network"); setToken(""); await load(); } catch (cause) { setError(cause instanceof Error && cause.message === "forbidden" ? labels.forbidden : labels.network); } finally { setLoading(false); } };
  const signOut = async () => { await fetch("/api/admin/logout", { method: "POST", credentials: "include" }); setAuthenticated(false); setData(null); setNotice(""); };
  return <section className="admin-server-panel" aria-label={labels.auth}><div className="admin-server-heading"><div><span className="eyebrow"><ShieldCheck size={14}/>{labels.auth}</span><p>{locale === "ko" ? "토큰은 저장하지 않고 서버 HttpOnly 세션으로만 인증합니다." : locale === "ja" ? "トークンは保存せず、サーバーのHttpOnlyセッションだけで認証します。" : locale === "zh-CN" ? "不会保存令牌，仅使用服务器HttpOnly会话进行认证。" : "The token is not stored; authentication uses a server HttpOnly session."}</p></div>{authenticated && <button className="secondary" onClick={() => void signOut()}>{labels.signOut}</button>}</div>{!authenticated ? <div className="admin-auth-form"><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder={labels.token} aria-label={labels.token}/><button className="primary" disabled={loading || !token.trim()} onClick={() => void signIn()}>{loading ? "…" : labels.signIn}</button></div> : <><div className="admin-server-toolbar"><button className="secondary" onClick={() => void load()} disabled={loading}>{loading ? "…" : labels.refresh}</button>{notice && <span role="status">{notice || labels.saved}</span>}</div>{data && <div className="admin-server-metrics"><span><strong>{data.counts.listings ?? data.listings.length}</strong> listings</span><span><strong>{data.counts.reservations ?? data.reservations.length}</strong> reservations</span><span><strong>{data.counts.serviceRequests ?? data.serviceRequests.length}</strong> services</span><span><strong>{data.counts.reports ?? data.reports.length}</strong> reports</span><span><strong>{data.placeOverrides.length}</strong> place overrides</span><span><strong>{data.guideOverrides.length}</strong> guide overrides</span></div>}</>}{error && <p className="admin-server-error" role="alert">{error}</p>}</section>;
}

function AdminPanel({ locale, t, products, places: localPlaces, preferences, tasks: activeTasks, done, setProducts, setPreferences, reset, exportData, importData }: { locale: Locale; t: TFunction; products: MarketProduct[]; places: import("./data").Place[]; preferences: LocalPreferences; tasks: Task[]; done: string[]; setProducts: Dispatch<SetStateAction<MarketProduct[]>>; setPreferences: Dispatch<SetStateAction<LocalPreferences>>; reset: () => void; exportData: () => void; importData: (file: File) => void }) {
  const [adminTab, setAdminTab] = useState<"overview" | "guides" | "places">("overview");
  const [search, setSearch] = useState(""); const [category, setCategory] = useState("All"); const [newPlaceName, setNewPlaceName] = useState(""); const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [guideSearch, setGuideSearch] = useState(""); const [guideStatusFilter, setGuideStatusFilter] = useState("All"); const [placeSearch, setPlaceSearch] = useState(""); const [placeStatusFilter, setPlaceStatusFilter] = useState("All"); const [expandedGuides, setExpandedGuides] = useState<string[]>([]); const [expandedPlaces, setExpandedPlaces] = useState<number[]>([]);
  const [saveNotice, setSaveNotice] = useState(false);
  const visible = products.filter((product) => product.serviceStatus !== "deleted" && (category === "All" || product.category === category) && productName(product, t).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  const updateReservation = (productId: string) => setPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== productId), reservations: current.reservations.map((item) => item.productId === productId && item.status === "active" ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item) }));
  const updateProduct = (product: MarketProduct, status: "active" | "sold" | "hidden" | "deleted") => { if (status === "deleted" && !window.confirm(tr(t, "admin:confirmDelete"))) return; if (status === "deleted") { setProducts((current) => current.filter((item) => item.id !== product.id)); setPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.filter((item) => item.productId !== String(product.id)), reportDrafts: current.reportDrafts.filter((item) => item.productId !== String(product.id)) })); return; } setProducts((current) => current.map((item) => item.id === product.id ? { ...item, serviceStatus: status, status: status === "sold" ? "Reserved" : "Available" } : item)); if (status === "sold") updateReservation(String(product.id)); };
  const updateReport = (productId: string, status: ReportDraft["status"]) => setPreferences((current) => ({ ...current, reportDrafts: current.reportDrafts.map((item) => item.productId === productId ? { ...item, status } : item) }));
  const updatePlace = (place: import("./data").Place, field: "phone" | "hours" | "closedDays" | "address" | "officialUrl" | "sourceName" | "lastVerifiedAt" | "verificationStatus" | "halalStatus" | "veganStatus" | "operatingStatus", value: string) => setPreferences((current) => ({ ...current, placeOverrides: { ...current.placeOverrides, [place.id]: { ...current.placeOverrides[String(place.id)], id: place.id, [field]: value || undefined } } }));
  const updatePlaceCoordinates = (place: import("./data").Place, field: "lat" | "lng", value: string) => { const numeric = Number(value); if (value && !Number.isFinite(numeric)) return; const coordinates = { lat: place.coordinates?.lat ?? 0, lng: place.coordinates?.lng ?? 0, [field]: numeric }; setPreferences((current) => ({ ...current, placeOverrides: { ...current.placeOverrides, [place.id]: { ...current.placeOverrides[String(place.id)], id: place.id, coordinates } } })); };
  const deletePlace = (place: import("./data").Place) => { if (!window.confirm(locale === "ko" ? "이 장소를 삭제할까요?" : locale === "ja" ? "この場所を削除しますか？" : locale === "zh-CN" ? "要删除此地点吗？" : "Delete this place?")) return; setPreferences((current) => ({ ...current, deletedPlaceIds: places.includes(place) ? [...new Set([...current.deletedPlaceIds, place.id])] : current.deletedPlaceIds, customPlaces: current.customPlaces.filter((item) => item.id !== place.id) })); };
  const addPlace = () => { const name = newPlaceName.trim(); if (!name) return; const id = Date.now(); const place = { id, category: "Food" as const, nameKey: "localGuide:places.anamClinic.name" as const, descriptionKey: "localGuide:places.anamClinic.description" as const, locationKey: "localGuide:places.anamClinic.location" as const, tipKey: "localGuide:places.anamClinic.tip" as const, distanceMeters: 0, english: false, displayName: name, displayDescription: "", displayLocation: newPlaceAddress.trim(), verificationStatus: "needs_confirmation" as const }; setPreferences((current) => ({ ...current, customPlaces: [place, ...current.customPlaces] })); setNewPlaceName(""); setNewPlaceAddress(""); };
  const guideArticles = [...lifeGuideArticles, ...expandedLifeGuideArticles];
  const visibleGuides = guideArticles.filter((guide) => { const metadata = preferences.guideMetadata[guide.id]; const status = metadata?.sourceStatus ?? guide.sourceStatus ?? (guide.officialUrl ? "verified" : "unavailable"); return getGuideLocaleCopy(guide, locale).title.toLocaleLowerCase(locale).includes(guideSearch.toLocaleLowerCase(locale)) && (guideStatusFilter === "All" || status === guideStatusFilter); });
  const visiblePlaces = localPlaces.filter((place) => { const name = place.displayName ?? place.localizedName?.[locale] ?? tr(t, place.nameKey); const status = place.verificationStatus ?? "needs_confirmation"; return name.toLocaleLowerCase(locale).includes(placeSearch.toLocaleLowerCase(locale)) && (placeStatusFilter === "All" || status === placeStatusFilter); });
  useEffect(() => { const showTimer = window.setTimeout(() => setSaveNotice(true), 0); const hideTimer = window.setTimeout(() => setSaveNotice(false), 1800); return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); }; }, [preferences]);
  return <section className="page section-pad admin-page"><div className="page-hero"><div><span className="eyebrow"><ShieldCheck size={14}/>{tr(t, "admin:eyebrow")}</span><h1>{tr(t, "admin:title")}</h1><p>{tr(t, "admin:demoNotice")}</p></div></div><div className="admin-metrics"><span><strong>{products.length}</strong>{tr(t, "admin:products")}</span><span><strong>{preferences.reservations.length}</strong>{tr(t, "admin:reservations")}</span><span><strong>{preferences.reportDrafts.length}</strong>{tr(t, "admin:reports")}</span><span><strong>{activeTasks.length}</strong>{tr(t, "admin:tasks")}</span></div><div className="admin-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr(t, "marketplace:search")}/><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="All">{tr(t, "marketplace:all")}</option>{productCategories.map((item) => <option key={item} value={item}>{tr(t, `marketplace:categories.${item}`)}</option>)}</select><button className="secondary" onClick={exportData}>{tr(t, "admin:export")}</button><label className="secondary">{tr(t, "admin:import")}<input type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importData(file); }}/></label><button className="danger-link" onClick={() => { if (window.confirm(tr(t, "admin:confirmReset"))) reset(); }}>{tr(t, "admin:reset")}</button></div>{saveNotice && <p className="admin-save-notice" role="status">{locale === "ko" ? "변경사항이 저장되었습니다." : locale === "ja" ? "変更を保存しました。" : locale === "zh-CN" ? "更改已保存。" : "Changes saved."}</p>}<div className="admin-section-tabs" role="tablist"><button role="tab" aria-selected={adminTab === "overview"} className={adminTab === "overview" ? "active" : ""} onClick={() => setAdminTab("overview")}>{locale === "ko" ? "요약" : locale === "ja" ? "概要" : locale === "zh-CN" ? "概览" : "Overview"}</button><button role="tab" aria-selected={adminTab === "guides"} className={adminTab === "guides" ? "active" : ""} onClick={() => setAdminTab("guides")}>{locale === "ko" ? "가이드 출처 관리" : locale === "ja" ? "ガイド出典管理" : locale === "zh-CN" ? "指南来源管理" : "Guide sources"}</button><button role="tab" aria-selected={adminTab === "places"} className={adminTab === "places" ? "active" : ""} onClick={() => setAdminTab("places")}>{locale === "ko" ? "장소 관리" : locale === "ja" ? "場所管理" : locale === "zh-CN" ? "地点管理" : "Places"}</button></div><div className={`admin-grid admin-tab-${adminTab}`}><section><h2>{tr(t, "admin:productSection")}</h2>{visible.length ? visible.map((product) => <article className="admin-card" key={product.id}><div><strong>{productName(product, t)}</strong><span>{formatCurrency(locale, product.priceKrw)} · {product.category}</span><small>{product.serviceStatus ?? "active"} · {product.status}</small></div><div className="admin-card-actions"><button onClick={() => updateProduct(product, product.serviceStatus === "hidden" ? "active" : "hidden")}>{tr(t, product.serviceStatus === "hidden" ? "marketplace:showListing" : "marketplace:hideListing")}</button><button onClick={() => updateProduct(product, product.serviceStatus === "sold" ? "active" : "sold")}>{tr(t, product.serviceStatus === "sold" ? "marketplace:cancelSold" : "marketplace:markSold")}</button><button className="danger-link" onClick={() => updateProduct(product, "deleted")}>{tr(t, "marketplace:deleteListing")}</button></div></article>) : <p className="empty-copy">{tr(t, "admin:noData")}</p>}</section><section><h2>{tr(t, "admin:reservationSection")}</h2>{preferences.reservations.length ? preferences.reservations.map((reservation) => { const product = products.find((item) => String(item.id) === reservation.productId); return <article className="admin-card" key={reservation.id}><div><strong>{product ? productName(product, t) : reservation.productId}</strong><span>{reservation.buyerName} · {reservation.status}</span><small>{reservation.pickupDate ? `${reservation.pickupDate} ${reservation.pickupStartTime}–${reservation.pickupEndTime}` : tr(t, "marketplace:pickupNotSet")}</small></div>{reservation.status === "active" && product && <button onClick={() => updateReservation(String(product.id))}>{tr(t, "marketplace:cancelReservation")}</button>}</article>; }) : <p className="empty-copy">{tr(t, "admin:noData")}</p>}</section><section><h2>{tr(t, "admin:reportSection")}</h2>{preferences.reportDrafts.length ? preferences.reportDrafts.map((report) => <article className="admin-card" key={`${report.productId}-${report.createdAt}`}><div><strong>{report.productId}</strong><span>{report.reason} · {report.detail}</span><small>{new Date(report.createdAt).toLocaleString(locale)}</small></div><select value={report.status} onChange={(event) => updateReport(report.productId, event.target.value as ReportDraft["status"])}><option value="new">{tr(t, "admin:reportNew")}</option><option value="reviewed">{tr(t, "admin:reportReviewed")}</option><option value="resolved">{tr(t, "admin:reportResolved")}</option></select></article>) : <p className="empty-copy">{tr(t, "admin:noData")}</p>}</section><section><h2>{tr(t, "admin:lifecycleSection")}</h2><div className="admin-card"><span>{tr(t, "admin:completedTasks", { count: done.length })}</span><span>{tr(t, "admin:trackedTasks", { count: activeTasks.length })}</span><span>{tr(t, "admin:progress", { progress: Math.round(done.length / Math.max(1, activeTasks.length) * 100) })}</span></div></section><section><h2>{locale === "ko" ? "가이드 출처 관리" : locale === "ja" ? "ガイド出典管理" : locale === "zh-CN" ? "指南来源管理" : "Guide source management"}</h2><div className="admin-subtoolbar"><input aria-label={locale === "ko" ? "가이드 검색" : "Search guides"} placeholder={locale === "ko" ? "가이드 검색" : locale === "ja" ? "ガイドを検索" : locale === "zh-CN" ? "搜索指南" : "Search guides"} value={guideSearch} onChange={(event) => setGuideSearch(event.target.value)}/><select aria-label={locale === "ko" ? "가이드 출처 상태" : "Guide source status"} value={guideStatusFilter} onChange={(event) => setGuideStatusFilter(event.target.value)}><option value="All">{locale === "ko" ? "전체 상태" : locale === "ja" ? "すべての状態" : locale === "zh-CN" ? "全部状态" : "All statuses"}</option><option value="verified">{guideUi(locale, "sourceVerified")}</option><option value="needs_confirmation">{guideUi(locale, "sourceNeedsConfirmation")}</option><option value="unavailable">{guideUi(locale, "sourceUnavailable")}</option></select></div>{visibleGuides.map((guide) => { const metadata = preferences.guideMetadata[guide.id] ?? { contentCheckedAt: guide.contentCheckedAt ?? guide.lastVerifiedAt ?? "2026-08-29", contentOrigin: guide.contentOrigin ?? (guide.officialUrl ? "official-guide" : "demo"), sourceStatus: guide.sourceStatus ?? (guide.officialUrl ? "verified" : "unavailable"), officialUrl: guide.officialUrl, sourceName: guide.sourceName }; return <article className={`admin-card admin-guide-card ${expandedGuides.includes(guide.id) ? "is-expanded" : ""}`} key={guide.id}><strong>{getGuideLocaleCopy(guide, locale).title}</strong><span className="admin-collapsed-meta">{metadata.sourceName ?? guideUi(locale, "sourceNeedsConfirmation")} · {metadata.contentCheckedAt}</span><button className="admin-expand-button" aria-expanded={expandedGuides.includes(guide.id)} onClick={() => setExpandedGuides((current) => current.includes(guide.id) ? current.filter((id) => id !== guide.id) : [...current, guide.id])}>{expandedGuides.includes(guide.id) ? (locale === "ko" ? "간단히 보기" : "Collapse") : (locale === "ko" ? "상세 편집" : "Edit details")}</button><label>{locale === "ko" ? "콘텐츠 성격" : locale === "ja" ? "コンテンツ種別" : locale === "zh-CN" ? "内容类型" : "Content origin"}<select value={metadata.contentOrigin} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, contentOrigin: event.target.value as "official-guide" | "demo" } } }))}><option value="official-guide">{guideUi(locale, "officialOrigin")}</option><option value="demo">{guideUi(locale, "demoOrigin")}</option></select></label><input type="date" value={metadata.contentCheckedAt} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, contentCheckedAt: event.target.value } } }))}/><select value={metadata.sourceStatus} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, sourceStatus: event.target.value as "verified" | "needs_confirmation" | "unavailable" } } }))}><option value="verified">{guideUi(locale, "sourceVerified")}</option><option value="needs_confirmation">{guideUi(locale, "sourceNeedsConfirmation")}</option><option value="unavailable">{guideUi(locale, "sourceUnavailable")}</option></select><input placeholder={guideUi(locale, "sourceName")} value={metadata.sourceName ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, sourceName: event.target.value } } }))}/><input placeholder={guideUi(locale, "sourceUrl")} value={metadata.officialUrl ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, officialUrl: event.target.value } } }))}/>{(["en", "ko", "ja", "zh-CN"] as const).map((language) => <input key={language} placeholder={`${language} official URL`} value={metadata.officialUrls?.[language] ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, guideMetadata: { ...current.guideMetadata, [guide.id]: { ...metadata, officialUrls: { ...metadata.officialUrls, [language]: event.target.value } } } }))}/>) }</article>; })}</section><section><h2>{locale === "ko" ? "장소 관리" : locale === "ja" ? "場所管理" : locale === "zh-CN" ? "地点管理" : "Place management"}</h2><div className="admin-subtoolbar"><input aria-label={locale === "ko" ? "장소 검색" : "Search places"} placeholder={locale === "ko" ? "장소 검색" : locale === "ja" ? "場所を検索" : locale === "zh-CN" ? "搜索地点" : "Search places"} value={placeSearch} onChange={(event) => setPlaceSearch(event.target.value)}/><select aria-label={locale === "ko" ? "장소 상태" : "Place status"} value={placeStatusFilter} onChange={(event) => setPlaceStatusFilter(event.target.value)}><option value="All">{locale === "ko" ? "전체 상태" : locale === "ja" ? "すべての状態" : locale === "zh-CN" ? "全部状态" : "All statuses"}</option><option value="official">{locale === "ko" ? "확인된 정보" : "Verified"}</option><option value="verified">{locale === "ko" ? "확인된 정보" : "Verified"}</option><option value="needs_confirmation">{locale === "ko" ? "확인 필요" : "Needs confirmation"}</option><option value="demo">{locale === "ko" ? "데모 정보" : "Demo"}</option></select></div><div className="admin-card-actions"><input aria-label="장소명" placeholder={locale === "ko" ? "장소명" : "Place name"} value={newPlaceName} onChange={(event) => setNewPlaceName(event.target.value)}/><input aria-label="주소" placeholder={locale === "ko" ? "주소" : "Address"} value={newPlaceAddress} onChange={(event) => setNewPlaceAddress(event.target.value)}/><button className="primary" onClick={addPlace}>{locale === "ko" ? "장소 추가" : locale === "ja" ? "場所を追加" : locale === "zh-CN" ? "添加地点" : "Add place"}</button></div>{visiblePlaces.map((place) => <article className={`admin-card admin-place-card ${expandedPlaces.includes(place.id) ? "is-expanded" : ""}`} key={place.id}><div><strong>{place.displayName ?? place.localizedName?.[locale] ?? tr(t, place.nameKey)}</strong><span>{place.verificationStatus === "official" || place.verificationStatus === "verified" ? (locale === "ko" ? "확인된 정보" : "Verified information") : (locale === "ko" ? "확인 필요" : "Needs confirmation")}</span><small>{place.lastVerifiedAt ?? (locale === "ko" ? "확인일 없음" : "No checked date")}</small><button className="admin-expand-button" aria-expanded={expandedPlaces.includes(place.id)} onClick={() => setExpandedPlaces((current) => current.includes(place.id) ? current.filter((id) => id !== place.id) : [...current, place.id])}>{expandedPlaces.includes(place.id) ? (locale === "ko" ? "간단히 보기" : "Collapse") : (locale === "ko" ? "상세 편집" : "Edit details")}</button></div><div className="admin-card-actions"><input aria-label="전화번호" placeholder="전화번호" value={place.phone ?? ""} onChange={(event) => updatePlace(place, "phone", event.target.value)}/><input aria-label="영업시간" placeholder="영업시간" value={place.hours ?? ""} onChange={(event) => updatePlace(place, "hours", event.target.value)}/><input aria-label="휴무일" placeholder="휴무일" value={place.closedDays ?? ""} onChange={(event) => updatePlace(place, "closedDays", event.target.value)}/><input aria-label="위도" inputMode="decimal" placeholder="위도" value={place.coordinates?.lat ?? ""} onChange={(event) => updatePlaceCoordinates(place, "lat", event.target.value)}/><input aria-label="경도" inputMode="decimal" placeholder="경도" value={place.coordinates?.lng ?? ""} onChange={(event) => updatePlaceCoordinates(place, "lng", event.target.value)}/><input aria-label="확인일" type="date" value={place.lastVerifiedAt ?? ""} onChange={(event) => updatePlace(place, "lastVerifiedAt", event.target.value)}/><select aria-label="정보 상태" value={place.verificationStatus ?? "needs_confirmation"} onChange={(event) => updatePlace(place, "verificationStatus", event.target.value)}><option value="official">확인된 정보</option><option value="verified">확인된 정보</option><option value="needs_confirmation">확인 필요</option><option value="demo">데모 정보</option></select><select aria-label="할랄 상태" value={place.halalStatus ?? ""} onChange={(event) => updatePlace(place, "halalStatus", event.target.value)}><option value="">할랄 상태 없음</option><option value="certified">할랄 인증</option><option value="menu-available">할랄 메뉴 제공</option><option value="needs-menu-check">메뉴별 확인 필요</option><option value="visit-check">방문 전 확인 필요</option></select><select aria-label="비건 상태" value={place.veganStatus ?? ""} onChange={(event) => updatePlace(place, "veganStatus", event.target.value)}><option value="">비건 상태 없음</option><option value="specialist">비건 전문점</option><option value="menu-available">비건 메뉴 제공</option><option value="needs-menu-check">메뉴별 확인 필요</option><option value="visit-check">방문 전 확인 필요</option></select><select aria-label="운영 상태" value={place.operatingStatus ?? "active"} onChange={(event) => updatePlace(place, "operatingStatus", event.target.value)}><option value="active">운영 중</option><option value="needs_confirmation">운영 여부 확인 필요</option><option value="inactive">운영 종료·이전</option></select><button className="danger-link" onClick={() => deletePlace(place)}>{locale === "ko" ? "장소 삭제" : locale === "ja" ? "場所を削除" : locale === "zh-CN" ? "删除地点" : "Delete place"}</button></div></article>)}</section></div></section>;
}

function Marketplace({ locale, t, profile, appMode, products: marketplaceProducts, search, setSearch, category, setCategory, mode, setMode, addProduct, selectProduct: buyerSelectProduct, selectSellerProduct, preferences, setPreferences, toggleFavorite }: { locale: Locale; t: TFunction; profile: UserProfile; appMode: AppMode; products: MarketProduct[]; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; mode: MarketMode; setMode: (value: MarketMode) => void; addProduct: (product: MarketProduct) => Promise<void>; selectProduct: (product: MarketProduct) => void; selectSellerProduct: (product: MarketProduct) => void; preferences: LocalPreferences; setPreferences: Dispatch<SetStateAction<LocalPreferences>>; toggleFavorite: (product: MarketProduct) => void }) {
  const [success, setSuccess] = useState(false);
  const [sort, setSort] = useState<"latest" | "price">("latest");
  const [sourceFilter, setSourceFilter] = useState<"all" | "live" | "sample">("all");
  const categories = ["All", ...productCategories];
  const selectProduct = mode === "leaving" ? selectSellerProduct : buyerSelectProduct;
  const categoryLabel = (value: string) => value === "All" ? tr(t, "marketplace:all") : tr(t, `marketplace:categories.${value}`);
  const filtered = useMemo(() => [...marketplaceProducts.filter((product) => product.serviceStatus !== "hidden" && product.serviceStatus !== "deleted" && (sourceFilter === "all" || product.source === sourceFilter) && (category === "All" || product.category === category) && productName(product, t).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)))].sort((a, b) => sort === "price" ? a.priceKrw - b.priceKrw : Number(b.id) - Number(a.id)), [marketplaceProducts, sourceFilter, category, search, locale, t, sort]);
const changeMode = (nextMode: MarketMode) => { setMode(nextMode); setSuccess(false); };
  const completeListing = async (product: MarketProduct) => { await addProduct(product); setSearch(""); setCategory("All"); setMode("incoming"); setSuccess(true); };

  return <section className="page section-pad market-page">
<div className="page-hero market-hero"><div><span className="eyebrow"><ShoppingBag size={14}/>{tr(t, "marketplace:eyebrow")}</span><h1>{tr(t, "marketplace:title")}</h1><p>{tr(t, "marketplace:body")}</p></div><div className="mode-switch" aria-label={tr(t, "accessibility:marketMode")}><button aria-pressed={mode === "incoming"} className={mode === "incoming" ? "active" : ""} onClick={() => changeMode("incoming")}><ShoppingBag size={18}/>{tr(t, "marketplace:incoming")}</button><button aria-pressed={mode === "leaving"} className={mode === "leaving" ? "active" : ""} onClick={() => changeMode("leaving")}><Tag size={18}/>{tr(t, "marketplace:leaving")}</button></div><button className="primary market-list-cta" onClick={() => changeMode("leaving")}><Tag size={17}/>{tr(t, "marketplace:form.submit")}</button></div>
    <div className="market-flow">{(["verification", "listing", "pickup", "transaction"] as const).map((step, index) => <div key={step}><span>{index === 0 ? <BadgeCheck/> : index === 1 ? <ShoppingBag/> : index === 2 ? <MapPin/> : <Banknote/>}</span><strong>{tr(t, `marketplace:flow.${step}`)}</strong>{index < 3 && <ChevronRight/>}</div>)}</div>
{mode === "leaving" ? !(["authenticated", "demo", "guest"] as AppMode[]).includes(appMode) ? <article className="listing-form auth-gate"><ShieldCheck/><h2>{tr(t, "marketplace:authRequiredTitle")}</h2><p>{tr(t, "marketplace:authRequiredBody")}</p></article> : <><ListingForm locale={locale} t={t} submit={completeListing}/><UserListingManager locale={locale} products={marketplaceProducts} preferences={preferences} selectProduct={selectProduct} cancelReservation={(product) => setPreferences((current) => ({ ...current, reservedProductIds: current.reservedProductIds.filter((id) => id !== String(product.id)), reservations: current.reservations.map((item) => item.productId === String(product.id) && item.status === "active" ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString() } : item) }))}/></> : <>
      {success && <div className="success-banner" role="status"><CheckCircle2 size={18}/>{tr(t, "marketplace:form.success")}</div>}
      <div className="filters"><label className="search-box"><Search size={19}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr(t, "marketplace:search")}/>{search && <button onClick={() => setSearch("")} aria-label={tr(t, "marketplace:clearSearch")}><X size={16}/></button>}</label><label className="sort-control"><span>{locale === "ko" ? "정렬" : "Sort"}</span><select value={sort} onChange={(event) => setSort(event.target.value as "latest" | "price")}><option value="latest">{locale === "ko" ? "최신순" : "Latest"}</option><option value="price">{locale === "ko" ? "가격순" : "Price"}</option></select></label><div className="chips source-filter"><button aria-pressed={sourceFilter === "all"} className={sourceFilter === "all" ? "active" : ""} onClick={() => setSourceFilter("all")}>{locale === "ko" ? "전체" : "All"}</button><button aria-pressed={sourceFilter === "live"} className={sourceFilter === "live" ? "active" : ""} onClick={() => setSourceFilter("live")}>{locale === "ko" ? "실제 등록 상품" : "Live listings"}</button><button aria-pressed={sourceFilter === "sample"} className={sourceFilter === "sample" ? "active" : ""} onClick={() => setSourceFilter("sample")}>{locale === "ko" ? "샘플 데이터" : "Sample data"}</button></div><div className="chips">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div></div>
      {preferences.reservedProductIds.length > 0 && <section className="reservation-summary"><strong>{locale === "ko" ? "내 예약 상품" : "My reservations"}</strong><span>{preferences.reservedProductIds.length}</span><button className="secondary" onClick={() => setPreferences((current) => ({ ...current, reservedProductIds: [] }))}>{locale === "ko" ? "예약 전체 취소" : "Cancel all"}</button></section>}
      {filtered.length ? <div className="product-grid">{filtered.map((product) => {
        const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t);
        const favorite = preferences.favoriteProductIds.includes(String(product.id));
        return <div className="product-card-wrap" key={product.id}><button className="product-card" aria-label={tr(t, "accessibility:productDetails", { product: name })} onClick={() => selectProduct(product)}><div className={`product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}>{product.imageDataUrl ? <img className="product-image" src={product.imageDataUrl} alt=""/> : <Icon/>}<span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span><span className="source-pill">{tr(t, product.source === "live" ? "common:liveData" : product.source === "demo" ? "common:demoData" : "common:sampleData")}</span></div><div className="product-info"><div><h2>{name}</h2><strong className="price">{formatCurrency(locale, product.priceKrw)}</strong></div><dl><div><dt>{tr(t, "marketplace:condition")}</dt><dd>{tr(t, `marketplace:conditions.${product.condition}`)}</dd></div><div><dt>{tr(t, "marketplace:pickup")}</dt><dd><MapPin size={14}/>{productPickup(product, t)}</dd></div></dl><span className="seller"><SellerIcon size={16}/>{productSeller(product, t, profile)}</span>{product.source === "live" && !product.imageDataUrl && <small className="image-prompt">{locale === "ko" ? "상품 이미지를 추가하면 상태를 더 쉽게 확인할 수 있습니다." : "Add an image to help buyers understand the condition."}</small>}<span className="details-link">{tr(t, "marketplace:details")}<ArrowRight size={16}/></span></div></button><button className="favorite-button" aria-pressed={favorite} aria-label={tr(t, favorite ? "marketplace:unfavorite" : "marketplace:favorite")} title={tr(t, favorite ? "marketplace:unfavorite" : "marketplace:favorite")} onClick={() => toggleFavorite(product)}>{favorite ? "★" : "☆"}</button></div>;
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

function kakaoTip(locale: Locale, place: import("./data").Place) {
  const tips: Record<string, Record<Locale, string>> = {
    HP8: { ko: "방문 전에 진료과, 접수 방법과 운영시간을 공식 채널에서 확인하세요.", en: "Check departments, registration, and hours through the official channel before visiting.", ja: "訪問前に診療科、受付方法、営業時間を公式チャンネルで確認してください。", "zh-CN": "就诊前请通过官方渠道确认科室、挂号方式和时间。" },
    PM9: { ko: "약 이름이나 사진을 준비하고 복용 중인 약이 있으면 약사에게 알려주세요.", en: "Bring the medicine name or a photo and tell the pharmacist about current medicines.", ja: "薬の名前や写真を用意し、服用中の薬を薬剤師に伝えてください。", "zh-CN": "请准备药品名称或照片，并告知药师正在服用的药物。" },
    FD6: { ko: "알레르기와 식재료는 주문 전에 직원에게 확인하세요.", en: "Ask staff about ingredients and allergies before ordering.", ja: "注文前に食材とアレルギーについてスタッフに確認してください。", "zh-CN": "点餐前请向店员确认食材和过敏原。" },
    CE7: { ko: "좌석 이용시간과 주문 규칙은 방문 전에 확인하면 좋습니다.", en: "Check seating time limits and ordering rules before visiting.", ja: "訪問前に席の利用時間と注文ルールを確認しましょう。", "zh-CN": "到店前建议确认座位使用时间和点单规则。" },
    MT1: { ko: "운영시간과 결제 수단은 방문 전에 확인하세요.", en: "Check opening hours and payment methods before visiting.", ja: "訪問前に営業時間と支払い方法を確認してください。", "zh-CN": "到店前请确认营业时间和支付方式。" },
    keyword: { ko: "카카오 검색 결과이며 세부 분류와 운영 정보는 방문 전에 확인하세요.", en: "This is a Kakao search result; confirm the detailed category and operating information before visiting.", ja: "Kakaoの検索結果です。詳細な分類と営業情報は訪問前に確認してください。", "zh-CN": "这是 Kakao 搜索结果，请在到店前确认详细分类和营业信息。" }
  };
  return (tips[place.kakaoCategoryCode ?? "keyword"] ?? tips.keyword)[locale];
}

function dietaryStatusLabel(locale: Locale, place: import("./data").Place) {
  const status = place.category === "Halal" ? place.halalStatus : place.category === "Vegan" ? place.veganStatus : undefined;
  if (!status) return null;
  const isVegan = place.category === "Vegan";
  const labels = locale === "ko" ? { certified: "할랄 인증", "menu-available": isVegan ? "비건 메뉴 제공" : "할랄 메뉴 제공", specialist: "비건 전문점", "needs-menu-check": "메뉴별 확인 필요", "visit-check": "방문 전 확인 필요" } : locale === "ja" ? { certified: "ハラール認証", "menu-available": isVegan ? "ビーガンメニューあり" : "ハラールメニューあり", specialist: "ビーガン専門店", "needs-menu-check": "メニューごとに要確認", "visit-check": "訪問前に要確認" } : locale === "zh-CN" ? { certified: "清真认证", "menu-available": isVegan ? "提供纯素菜单" : "提供清真菜单", specialist: "纯素专门店", "needs-menu-check": "需按菜单确认", "visit-check": "到店前请确认" } : { certified: "Halal certified", "menu-available": isVegan ? "Vegan menu available" : "Halal menu available", specialist: "Vegan specialist", "needs-menu-check": "Check each menu", "visit-check": "Confirm before visiting" };
  return labels[status];
}

function LocalGuide({ locale, t, category, setCategory, search, setSearch, places: localPlaces, preferences, setPreferences }: { locale: Locale; t: TFunction; category: string; setCategory: (value: string) => void; search: string; setSearch: (value: string) => void; places: import("./data").Place[]; preferences: import("./lib/local-data").LocalPreferences; setPreferences: Dispatch<SetStateAction<import("./lib/local-data").LocalPreferences>> }) {
  const categories: Array<"All" | PlaceCategory> = ["All", "Food", "Halal", "Vegan", "Hospital", "Pharmacy", "Hair Salon", "Cafe", "Grocery"];
  const categoryLabel = (value: string) => value === "All" ? tr(t, "localGuide:all") : tr(t, `localGuide:categories.${value}`);
  const [kakaoPlaces, setKakaoPlaces] = useState<import("./data").Place[]>([]); const [kakaoStatus, setKakaoStatus] = useState<"idle" | "loading" | "ready" | "error">("idle"); const [kakaoError, setKakaoError] = useState<string | null>(null); const [kakaoOnlyFavorites, setKakaoOnlyFavorites] = useState(false); const [campusFilter, setCampusFilter] = useState<CampusFilter>("all"); const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null); const [kakaoPage, setKakaoPage] = useState(1); const [kakaoTotalCount, setKakaoTotalCount] = useState(0); const [kakaoHasMore, setKakaoHasMore] = useState(false); const requestId = useRef(0);
  const mapCenter = campusFilter === "science" ? KU_SCIENCE_CENTER : KU_CENTER;
  const fetchKakaoPlaces = useCallback(async (nextPage = 1, append = false) => { const id = ++requestId.current; setKakaoStatus("loading"); setKakaoError(null); try { const params = new URLSearchParams({ category, query: search, radius: "4000", page: String(nextPage), lat: String(mapCenter.lat), lng: String(mapCenter.lng) }); const response = await fetch(`/api/places/search?${params.toString()}`); const payload = await response.json() as Partial<KakaoSearchResponse> & { error?: string }; if (!response.ok) throw new Error(payload.error ?? "kakao_error"); if (id !== requestId.current) return; setKakaoPlaces((current) => dedupePlaces(append ? [...current, ...(payload.places ?? [])] : (payload.places ?? []))); setKakaoPage(nextPage); setKakaoTotalCount(payload.totalCount ?? 0); setKakaoHasMore((payload.totalCount ?? 0) > nextPage * 15 || (payload.places?.length ?? 0) === 15); setKakaoStatus("ready"); } catch (error) { if (id !== requestId.current) return; if (!append) { setKakaoPlaces([]); setKakaoTotalCount(0); } setKakaoStatus("error"); setKakaoError(error instanceof Error ? error.message : "kakao_error"); } }, [category, mapCenter.lat, mapCenter.lng, search]);
  useEffect(() => { const timer = window.setTimeout(() => void fetchKakaoPlaces(), 350); return () => window.clearTimeout(timer); }, [fetchKakaoPlaces]);
  const filtered = localPlaces.filter((place) => (campusFilter === "all" || place.campusScope === campusFilter || place.campusScope === "shared") && matchesPlaceCategory(place, category) && `${place.displayName ?? place.localizedName?.[locale] ?? tr(t, place.nameKey)} ${place.displayDescription ?? tr(t, place.descriptionKey)} ${place.address ?? place.displayLocation ?? tr(t, place.locationKey)} ${place.phone ?? ""}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  const campusPlaces = kakaoPlaces.filter((place) => (campusFilter === "all" || place.campusScope === campusFilter || place.campusScope === "shared") && matchesPlaceCategory(place, category));
  const mergedPlaces = dedupePlaces([...filtered, ...campusPlaces]);
  const displayPlaces = kakaoOnlyFavorites ? mergedPlaces.filter((place) => preferences.placeFavorites.includes(place.id)) : mergedPlaces;
  const mapPlaces = displayPlaces;
  const mapReadyPlaces = mapPlaces.filter((place) => isValidCoordinates(place.coordinates));
  const locationPendingPlaces = displayPlaces.length - mapReadyPlaces.length;
  void locationPendingPlaces;
  return <section className="page section-pad guide-page"><div className="page-hero"><div><span className="eyebrow"><MapPin size={14}/>{tr(t, "localGuide:eyebrow")}</span><h1>{tr(t, "localGuide:title")}</h1><p>{tr(t, "localGuide:body")}</p></div><div className="guide-visual"><span><MapPin/></span><i/><b>KU</b><i/><span><Utensils/></span></div></div>
    <div className="kakao-guide-toolbar"><span>{locale === "ko" ? "카카오 장소 검색 · 반경 4km" : locale === "ja" ? "Kakao場所検索 · 半径4km" : locale === "zh-CN" ? "Kakao地点搜索 · 半径4公里" : "Kakao place search · 4 km radius"}</span><label><input type="checkbox" checked={kakaoOnlyFavorites} onChange={(event) => setKakaoOnlyFavorites(event.target.checked)}/>{locale === "ko" ? "즐겨찾기 장소만 보기" : locale === "ja" ? "お気に入りだけ表示" : locale === "zh-CN" ? "仅显示收藏地点" : "Show favorites only"}</label><select aria-label={locale === "ko" ? "캠퍼스 선택" : locale === "ja" ? "キャンパス選択" : locale === "zh-CN" ? "选择校区" : "Campus selection"} value={campusFilter} onChange={(event) => setCampusFilter(event.target.value as CampusFilter)}><option value="all">{locale === "ko" ? "전체 캠퍼스" : locale === "ja" ? "全キャンパス" : locale === "zh-CN" ? "全部校区" : "All campuses"}</option><option value="main">{locale === "ko" ? "안암캠퍼스" : locale === "ja" ? "安岩キャンパス" : locale === "zh-CN" ? "安岩校区" : "Anam Campus"}</option><option value="science">{locale === "ko" ? "이공계 캠퍼스" : locale === "ja" ? "理工系キャンパス" : locale === "zh-CN" ? "理工科校区" : "Science & Engineering"}</option></select></div><p className="map-result-summary">{locale === "ko" ? `현재 범위: ${campusFilter === "all" ? "전체 캠퍼스" : campusFilter === "main" ? "안암캠퍼스" : "이공계 캠퍼스"} · 현재 표시 중 ${displayPlaces.length}개 · 지도 표시 가능 ${mapReadyPlaces.length}개 · 위치 확인 필요 ${locationPendingPlaces}개 · Kakao API 후보 ${kakaoTotalCount.toLocaleString()}개 · 내부 검증 ${filtered.filter((place) => place.source !== "kakao").length}개` : locale === "ja" ? `範囲: ${campusFilter === "all" ? "全キャンパス" : campusFilter === "main" ? "安岩キャンパス" : "理工系キャンパス"} · 表示中 ${displayPlaces.length}件 · 地図表示可能 ${mapReadyPlaces.length}件 · 位置確認が必要 ${locationPendingPlaces}件 · Kakao API候補 ${kakaoTotalCount.toLocaleString()}件 · 内部確認 ${filtered.filter((place) => place.source !== "kakao").length}件` : locale === "zh-CN" ? `范围：${campusFilter === "all" ? "全部校区" : campusFilter === "main" ? "安岩校区" : "理工科校区"} · 当前显示 ${displayPlaces.length}个 · 可在地图显示 ${mapReadyPlaces.length}个 · 需确认位置 ${locationPendingPlaces}个 · Kakao API候选 ${kakaoTotalCount.toLocaleString()}个 · 内部确认 ${filtered.filter((place) => place.source !== "kakao").length}个` : `Scope: ${campusFilter === "all" ? "All campuses" : campusFilter === "main" ? "Anam Campus" : "Science & Engineering"} · Showing ${displayPlaces.length} · Map-ready ${mapReadyPlaces.length} · Location check needed ${locationPendingPlaces} · Kakao API candidates ${kakaoTotalCount.toLocaleString()} · Internal verified ${filtered.filter((place) => place.source !== "kakao").length}`}</p>{kakaoStatus === "loading" && <p className="map-status">{locale === "ko" ? "카카오 장소를 검색하는 중입니다…" : locale === "ja" ? "Kakaoの場所を検索中…" : locale === "zh-CN" ? "正在搜索 Kakao 地点…" : "Searching Kakao places…"}</p>}{kakaoStatus === "error" && <div className="map-status map-error">{kakaoError === "not_configured" ? (locale === "ko" ? "Kakao API 키가 설정되지 않아 데모 장소를 표시합니다." : "Kakao API key is not configured. Showing demo places.") : kakaoError === "free_quota_limit" ? (locale === "ko" ? "이번 달 무료 Kakao 호출 한도에 도달해 데모 장소를 표시합니다." : locale === "ja" ? "今月のKakao無料呼び出し上限に達したため、デモ地点を表示しています." : locale === "zh-CN" ? "已达到本月 Kakao 免费调用上限，正在显示演示地点。" : "The monthly free Kakao call limit was reached. Showing demo places.") : (locale === "ko" ? "Kakao 장소 검색에 실패했습니다. 데모 장소를 표시합니다." : "Kakao place search failed. Showing demo places.")}<button className="secondary" onClick={() => void fetchKakaoPlaces()}>{locale === "ko" ? "다시 시도" : locale === "ja" ? "再試行" : locale === "zh-CN" ? "重试" : "Retry"}</button></div>}<KakaoMap places={mapPlaces} center={mapCenter} selectedId={selectedPlaceId} onSelect={(place) => { setSelectedPlaceId(place.id); document.querySelector(`[data-place-id="${place.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} labels={{ ready: locale === "ko" ? "지도 표시 완료" : locale === "ja" ? "地図を表示しました" : locale === "zh-CN" ? "地图已显示" : "Map ready", loading: locale === "ko" ? "지도를 불러오는 중입니다…" : locale === "ja" ? "地図を読み込み中…" : locale === "zh-CN" ? "正在加载地图…" : "Loading map…", failed: locale === "ko" ? "카카오 지도를 불러오지 못했습니다. 목록과 외부 지도 링크를 이용하세요." : locale === "ja" ? "Kakaoマップを読み込めません。リストと外部地図リンクをご利用ください." : locale === "zh-CN" ? "无法加载 Kakao 地图。请使用列表和外部地图链接。" : "Kakao map could not be loaded. Use the list and external map links.", attribution: "Kakao Maps", noCoordinates: locale === "ko" ? "표시할 좌표가 없습니다." : locale === "ja" ? "表示できる座標がありません." : locale === "zh-CN" ? "没有可显示的坐标。" : "No coordinates to display.", category: (place) => place.kakaoCategoryGroupName ?? categoryLabel(place.category), dietary: (place) => dietaryStatusLabel(locale, place), mapLink: locale === "ko" ? "카카오맵에서 보기" : locale === "ja" ? "Kakaoマップで見る" : locale === "zh-CN" ? "在 Kakao 地图查看" : "View on Kakao Map", directions: locale === "ko" ? "길찾기" : locale === "ja" ? "ルート検索" : locale === "zh-CN" ? "路线" : "Directions" }}/><label className="search-field"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "ko" ? "장소 검색" : locale === "ja" ? "場所を検索" : locale === "zh-CN" ? "搜索地点" : "Search places"}/></label><div className="chips guide-chips">{categories.map((item) => <button key={item} aria-pressed={category === item} aria-label={tr(t, "accessibility:placeCategory", { category: categoryLabel(item) })} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryLabel(item)}</button>)}</div>
    {displayPlaces.length ? <><div className="place-grid">{displayPlaces.map((place) => { const Icon = categoryIcons[place.category] || MapPin; const favorite = preferences.placeFavorites.includes(place.id); const reportKey = String(place.id); const location = place.address ?? place.displayLocation ?? tr(t, place.locationKey); const displayName = place.displayName ?? place.localizedName?.[locale] ?? tr(t, place.nameKey); const categoryText = place.kind === "campus" ? (locale === "ko" ? "캠퍼스" : locale === "ja" ? "キャンパス" : locale === "zh-CN" ? "校区" : "Campus") : place.source === "kakao" ? (place.kakaoCategoryGroupName ?? place.kakaoCategoryName ?? categoryLabel(place.category)) : categoryLabel(place.category); const dietary = dietaryStatusLabel(locale, place); const sourceText = place.source === "kakao" ? (locale === "ko" ? "카카오 검색 결과" : locale === "ja" ? "Kakao検索結果" : locale === "zh-CN" ? "Kakao搜索结果" : "Kakao search result") : place.verificationStatus === "official" || place.verificationStatus === "verified" ? (locale === "ko" ? "확인된 정보" : locale === "ja" ? "確認済み" : locale === "zh-CN" ? "已确认信息" : "Verified information") : place.verificationStatus === "needs_confirmation" ? (locale === "ko" ? "확인 필요" : locale === "ja" ? "確認が必要" : locale === "zh-CN" ? "需要确认" : "Needs confirmation") : (locale === "ko" ? "데모 정보" : locale === "ja" ? "デモ情報" : locale === "zh-CN" ? "演示信息" : "Demo information"); return <article className={`place-card ${selectedPlaceId === place.id ? "is-selected" : ""}`} data-place-id={place.id} key={place.id} onClick={() => setSelectedPlaceId(place.id)}><div className="place-top"><span className="place-icon"><Icon/></span><span className={`demo-pill ${place.verificationStatus === "official" || place.verificationStatus === "verified" ? "verified-pill" : ""}`}>{sourceText}</span><button aria-pressed={favorite} onClick={() => setPreferences((p) => ({ ...p, placeFavorites: favorite ? p.placeFavorites.filter((id) => id !== place.id) : [...p.placeFavorites, place.id] }))}>{favorite ? "★" : "☆"}</button></div><span className="place-category">{categoryText}</span>{dietary && <span className="dietary-status">{dietary}</span>}<h2>{displayName}</h2><p>{place.displayDescription ?? tr(t, place.descriptionKey)}</p>{!isValidCoordinates(place.coordinates) && <span className="location-pending">{locale === "ko" ? "지도 위치 확인 필요" : locale === "ja" ? "地図位置の確認が必要" : locale === "zh-CN" ? "需要确认地图位置" : "Map location needs confirmation"}</span>}<div className="place-meta"><span className="no"><MessageCircle size={16}/>{locale === "ko" ? "언어 지원은 업체 문의 필요" : "Ask the provider about language support"}</span><span><MapPin size={16}/>{location} · {tr(t, "localGuide:distanceFromKu", { distance: formatDistance(locale, place.distanceMeters) })}</span>{place.phone && <a href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>☎ {place.phone}</a>}{place.hours && <span>🕒 {place.hours}</span>}{place.closedDays && <span>· {place.closedDays}</span>}</div><div className="guide-map-links"><a href={place.mapUrl ?? googleMapsSearchUrl(`${displayName} ${location}`)} target="_blank" rel="noopener noreferrer">{locale === "ko" ? "지도에서 보기" : "View map"}</a><a href={googleMapsDirectionsUrl(`${displayName} ${location}`)} target="_blank" rel="noopener noreferrer">{locale === "ko" ? "길찾기" : "Directions"}</a></div>{(place.sourceName || place.officialUrl || place.lastVerifiedAt) && <div className="place-source"><span>{place.sourceName ?? (locale === "ko" ? "공식 출처" : "Official source")}</span>{place.officialUrl && <a href={place.officialUrl} target="_blank" rel="noopener noreferrer">{locale === "ko" ? "출처 보기" : "View source"}</a>}{place.lastVerifiedAt && <small>{locale === "ko" ? `정보 확인일: ${place.lastVerifiedAt}` : `Checked: ${place.lastVerifiedAt}`}</small>}</div>}<div className="student-tip"><Lightbulb size={17}/><div><strong>{tr(t, "localGuide:studentTip")}</strong><p>{place.source === "kakao" ? kakaoTip(locale, place) : tr(t, place.tipKey)}</p></div></div><label className="field"><span>{locale === "ko" ? "정보 수정 제보 초안(외부 전송 안 됨)" : "Correction draft (not sent externally)"}</span><input value={preferences.reports[reportKey] ?? ""} onChange={(e) => setPreferences((p) => ({ ...p, reports: { ...p.reports, [reportKey]: e.target.value } }))}/></label></article>; })}</div>{kakaoStatus === "ready" && kakaoHasMore && <button className="secondary load-more-places" onClick={() => void fetchKakaoPlaces(kakaoPage + 1, true)}>{locale === "ko" ? "더 보기" : locale === "ja" ? "さらに表示" : locale === "zh-CN" ? "加载更多" : "Load more"}</button>}</> : <><EmptyState icon={MapPin} text={tr(t, "localGuide:empty")}/>{(category === "Halal" || category === "Vegan") && <p className="map-status">{locale === "ko" ? "현재 확인된 장소가 없습니다. 주변 검색을 넓히거나 방문 전 매장에 메뉴와 조리 환경을 확인하세요." : locale === "ja" ? "現在確認できる場所がありません。周辺検索を広げ、訪問前にメニューと調理環境を確認してください。" : locale === "zh-CN" ? "目前没有已确认的地点。请扩大周边搜索，并在到店前确认菜单和烹饪环境。" : "No confirmed places are available. Expand the nearby search and confirm the menu and preparation environment before visiting."}</p>}</>}
  </section>;
}

function GuideCard({ article, locale, labels, preferences, done, go }: { article: (typeof lifeGuideArticles)[number]; locale: Locale; labels: Record<string, string>; preferences: LocalPreferences; done: string[]; go: (page: Page, intent?: NavigationIntent) => void }) {
  const copy = getGuideLocaleCopy(article, locale);
  const metadata = preferences.guideMetadata[article.id];
  const checked = metadata?.contentCheckedAt ?? article.contentCheckedAt ?? article.lastVerifiedAt;
  const checkedDate = checked ? (() => { try { return formatDate(locale, checked); } catch { return checked; } })() : "";
  const sourceStatus = metadata?.sourceStatus ?? article.sourceStatus ?? (article.officialUrl ? "verified" : article.verificationStatus === "needs_confirmation" ? "needs_confirmation" : "unavailable");
  const sourceUrl = sourceStatus === "verified" ? (metadata?.officialUrls?.[locale] ?? article.officialUrls?.[locale] ?? metadata?.officialUrl ?? article.officialUrl) : undefined;
  const sourceName = sourceStatus === "verified" ? (metadata?.sourceName ?? article.sourceName) : undefined;
  const contentOrigin = metadata?.contentOrigin ?? article.contentOrigin ?? (article.officialUrl ? "official-guide" : "demo");
  const relatedTaskId = article.relatedTaskIds[0];
  const taskDone = Boolean(relatedTaskId && done.includes(relatedTaskId));
  const Icon = guideCategoryIcons[article.category] ?? BookOpen;
  return <article className="guide-article" id={`guide-${article.id}`}>
    <div className="guide-card-top"><span className="guide-category-icon" aria-hidden="true"><Icon size={18} /></span><span className="place-category">{labels[article.category]}</span><span className={`guide-status ${contentOrigin === "demo" ? "is-demo" : "is-verified"}`}>{contentOrigin === "demo" ? guideUi(locale, "demoOrigin") : guideUi(locale, "officialOrigin")}</span></div>
    <h2>{copy.title}</h2><p className="guide-summary">{copy.summary}</p>
    <div className="guide-summary-badges"><span className="guide-badge guide-badge-time"><Clock3 size={13}/>{article.estimatedMinutes ? `${guideUi(locale, "duration")}: ${guideDuration(locale, article.estimatedMinutes[0], article.estimatedMinutes[1])}` : guideUi(locale, "status")}</span><span className="guide-badge guide-badge-check"><CheckCircle2 size={13}/>{checkedDate ? `${guideUi(locale, "checked")}: ${checkedDate}` : guideUi(locale, "sourceNeedsConfirmation")}</span><span className={`guide-badge guide-badge-progress ${taskDone ? "is-done" : relatedTaskId ? "is-active" : "is-pending"}`}><span aria-hidden="true">{taskDone ? "✓" : relatedTaskId ? "•" : "○"}</span>{guideProgressUi(locale, taskDone, Boolean(relatedTaskId))}</span></div>
    {relatedTaskId && <button className="task-action guide-primary-cta" onClick={() => go("onboarding", { taskId: relatedTaskId, highlight: true })}>{locale === "ko" ? "관련 라이프사이클 작업 보기" : locale === "ja" ? "関連するライフサイクルを見る" : locale === "zh-CN" ? "查看相关留学周期任务" : "View related lifecycle task"}<ArrowRight size={15} /></button>}
    <details className="guide-details"><summary className="guide-details-toggle" role="button" aria-label={guideViewUi(locale, "details")}><span>{guideViewUi(locale, "details")}</span><span className="guide-details-hint"><span>{guideViewUi(locale, "status")}</span><ChevronDown size={16} /></span></summary><div className="guide-details-content">
      <div className="article-meta"><span>{sourceName ?? guideUi(locale, sourceStatus === "unavailable" ? "sourceUnavailable" : "sourceNeedsConfirmation")}</span><span>{checkedDate ? `${guideUi(locale, "checked")}: ${checkedDate}` : ""}</span></div>
      {checkedDate && <small className="article-note">{guideUi(locale, "checkedNote")}</small>}<p>{copy.content}</p>
      {(article.category === "immigration" || article.category === "healthcare" || article.category === "mobile-banking") && <p className="student-tip"><AlertTriangle size={15} />{guideUi(locale, "changing")}</p>}
      {copy.steps?.length ? <><h3>{guideUi(locale, "steps")}</h3><ol>{copy.steps.map((step) => <li key={step}>{step}</li>)}</ol></> : null}
      {copy.checklist?.length ? <><h3>{guideUi(locale, "checklist")}</h3><ul>{copy.checklist.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
      {copy.cautions?.map((caution) => <p className="student-tip" key={caution}><AlertTriangle size={15} />{caution}</p>)}
      {sourceUrl ? <a className="task-action" href={sourceUrl} target="_blank" rel="noopener noreferrer">{guideUi(locale, "officialSource")}<ArrowRight size={15} /></a> : <span className="article-note">{sourceStatus === "unavailable" ? guideUi(locale, "sourceUnavailable") : guideUi(locale, "sourceNeedsConfirmation")}</span>}
    </div></details>
  </article>;
}

function LifeGuide({ locale, search, setSearch, category, setCategory, go, preferences, done }: { locale: Locale; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; go: (page: Page, intent?: NavigationIntent) => void; preferences: LocalPreferences; done: string[] }) {
  const labels: Record<string, string> = locale === "ko" ? { All: "전체", housing: "주거", arrival: "입국·교통", immigration: "체류·행정", "mobile-banking": "통신·은행", academic: "학사생활", healthcare: "의료·응급", daily: "일상생활", departure: "귀국 준비" } : locale === "ja" ? { All: "すべて", housing: "住居", arrival: "入国・交通", immigration: "在留・行政", "mobile-banking": "通信・銀行", academic: "学業生活", healthcare: "医療・緊急", daily: "日常生活", departure: "帰国準備" } : locale === "zh-CN" ? { All: "全部", housing: "住房", arrival: "入境·交通", immigration: "居留·行政", "mobile-banking": "通信·银行", academic: "学业生活", healthcare: "医疗·紧急", daily: "日常生活", departure: "回国准备" } : { All: "All", housing: "Housing", arrival: "Arrival & Transportation", immigration: "Immigration", "mobile-banking": "Mobile & Banking", academic: "Academic Life", healthcare: "Healthcare & Emergency", daily: "Daily Life", departure: "Departure" };
  const articles = [...lifeGuideArticles, ...expandedLifeGuideArticles];
  const filtered = articles.filter((article) => { const copy = getGuideLocaleCopy(article, locale); const searchable = [copy.title, copy.summary, copy.content, ...(copy.checklist ?? []), ...(copy.steps ?? []), ...(copy.cautions ?? [])].join(" "); return (category === "All" || article.category === category) && searchable.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)); });
  const recommended = filtered[0];
  return <section className="page section-pad"><div className="page-hero"><div><span className="eyebrow"><BookOpen size={14} /> {locale === "ko" ? "생활 가이드" : locale === "ja" ? "生活ガイド" : locale === "zh-CN" ? "生活指南" : "Life Guide"}</span><h1>{locale === "ko" ? "생활 가이드" : locale === "ja" ? "生活ガイド" : locale === "zh-CN" ? "生活指南" : "Life Guide"}</h1><p>{locale === "ko" ? "공식 정보를 찾고 확인할 수 있는 생활정보 허브입니다." : locale === "ja" ? "公式情報を確認できる生活情報ハブです。" : locale === "zh-CN" ? "查找和确认官方信息的生活指南。" : "Find, check, and save practical information from official sources."}</p></div></div>
    {recommended && <aside className="guide-recommendation"><span className="eyebrow"><Zap size={14} /> {guideViewUi(locale, "recommendation")}</span><h2>{getGuideLocaleCopy(recommended, locale).title}</h2><p>{getGuideLocaleCopy(recommended, locale).summary}</p><span className="guide-recommendation-status"><CheckCircle2 size={15} /> {guideViewUi(locale, "status")}</span></aside>}
    <label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "ko" ? "제목 또는 본문 검색" : locale === "ja" ? "タイトルまたは本文を検索" : locale === "zh-CN" ? "搜索标题或正文" : "Search title or content"} /></label>
    <div className="chips">{["All", ...Object.keys(labels).filter((key) => key !== "All")].map((key) => <button key={key} aria-pressed={category === key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{labels[key]}</button>)}</div>
    {filtered.length ? <div className="guide-article-grid">{filtered.map((article) => <GuideCard key={article.id} article={article} locale={locale} labels={labels} preferences={preferences} done={done} go={go} />)}</div> : <EmptyState icon={BookOpen} text={locale === "ko" ? "검색 결과가 없습니다." : locale === "ja" ? "検索結果がありません." : locale === "zh-CN" ? "没有找到指南。" : "No guides found."} />}
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
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [signupEnabled, setSignupEnabled] = useState(false);
  useEffect(() => { void fetch("/api/account/config", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((value) => setSignupEnabled(value?.signupEnabled === true)).catch(() => setSignupEnabled(false)); }, []);
  const signIn = async () => { if (!isKuEmail(email) || !password) { setError(locale === "ko" ? "@korea.ac.kr 이메일과 비밀번호를 확인하세요." : "Enter your KU email and password."); return; } setBusy(true); setError(""); try { await signInWithPassword(email, password); close(); } catch { setError(locale === "ko" ? "로그인에 실패했습니다. 이메일, 비밀번호, 이메일 인증 상태를 확인하세요." : "Sign-in failed. Check your email, password, and verification status."); } finally { setBusy(false); } };
  return <Modal close={close} label={tr(t, "verification:authTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon verify"><ShieldCheck/></div><h2>{locale === "ko" ? "KU 계정 로그인" : "KU account sign in"}</h2><p>{locale === "ko" ? "기존 @korea.ac.kr 계정으로 로그인합니다. 익명 세션 데이터는 로그인 후 연결할 수 있습니다." : "Sign in with an existing @korea.ac.kr account. You can connect this browser's anonymous data after signing in."}</p>{!configured ? <div className="configuration-warning" role="alert">{tr(t, "errors:supabaseNotConfigured")}</div> : <><label className="field"><span>{tr(t, "verification:email")}</span><input autoFocus value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="name@korea.ac.kr"/></label><label className="field"><span>{locale === "ko" ? "비밀번호" : "Password"}</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password"/></label><button className="primary full" disabled={busy} onClick={() => void signIn()}>{busy ? (locale === "ko" ? "로그인 중…" : "Signing in…") : (locale === "ko" ? "로그인" : "Sign in")}</button><div className="configuration-warning" role="status"><strong>{locale === "ko" ? "가입·이메일 인증 준비 중" : "Sign-up and email verification are being prepared"}</strong><p>{signupEnabled ? (locale === "ko" ? "가입 기능은 이메일 발송 설정 후 활성화됩니다." : "Sign-up is available after email delivery is configured.") : (locale === "ko" ? "현재 무료 운영 설정에서는 신규 가입·인증 메일 재발송·비밀번호 재설정을 요청하지 않습니다. 기존 계정 로그인만 가능합니다." : "For the current free-operation setup, sign-up, resend verification, and password reset do not send email. Existing accounts can sign in.")}</p>{password && !validAccountPassword(password) && <small>{locale === "ko" ? "새 계정 비밀번호 정책: 12자 이상, 대문자·소문자·숫자 포함" : "New-account password policy: 12+ characters with upper, lower, and number."}</small>}</div></>}{error && <p className="error-text" role="alert">{error}</p>}<p className="auth-security-note">{locale === "ko" ? "관리자 토큰과 계정 비밀번호는 이 화면 외에 저장하거나 표시하지 않습니다." : "Administrator tokens and account passwords are not stored or displayed outside this screen."}</p></Modal>;
}

type AppNotification = { id: string; title: string; body: string; type: string; read_at: string | null; created_at: string };
function NotificationsModal({ locale, close }: { locale: Locale; close: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await accountFetch("/api/notifications"); setItems((response.notifications ?? []) as AppNotification[]); } catch { setError(locale === "ko" ? "알림을 불러오지 못했습니다." : "Could not load notifications."); } finally { setLoading(false); } }, [locale]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const markRead = async (id: string) => { try { await accountFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ id }) }); setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item)); } catch { setError(locale === "ko" ? "읽음 처리에 실패했습니다." : "Could not mark the notification as read."); } };
  return <Modal close={close} label={locale === "ko" ? "알림함" : "Notifications"}><button className="modal-close" onClick={close} aria-label="Close"><X/></button><h2>{locale === "ko" ? "알림함" : "Notifications"}</h2><p>{locale === "ko" ? "예약, 배송·보관 신청, 운영 문의의 처리 상태를 이곳에서 확인합니다." : "Check reservation, fulfillment, and support-ticket updates here."}</p>{loading ? <div className="loading-state" role="status"><Loader2 className="spin"/><span>{locale === "ko" ? "알림을 불러오는 중입니다…" : "Loading notifications…"}</span></div> : error ? <p className="error-text" role="alert">{error}</p> : items.length ? <div className="admin-data-list">{items.map((item) => <button className="admin-data-card" key={item.id} onClick={() => { if (!item.read_at) void markRead(item.id); }}><div><strong>{item.title}</strong><span>{new Date(item.created_at).toLocaleString(locale)}{item.read_at ? "" : " · new"}</span></div><p>{item.body}</p></button>)}</div> : <p className="empty-copy">{locale === "ko" ? "새 알림이 없습니다." : "No notifications yet."}</p>}</Modal>;
}

type SupportTicket = { id: string; reference_code?: string; subject: string; body: string; status: string; operator_response?: string | null; handled_at?: string | null; first_response_due_at?: string | null; created_at: string };
function SupportTicketsModal({ locale, close }: { locale: Locale; close: () => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]); const [subject, setSubject] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [submittedReference, setSubmittedReference] = useState("");
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch("/api/support-tickets", { credentials: "include", cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(String(body.error)); setTickets(body.tickets as SupportTicket[]); } catch { setError(locale === "ko" ? "문의 내역을 불러오지 못했습니다." : "Could not load support tickets."); } finally { setLoading(false); } }, [locale]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const submit = async () => { if (!subject.trim() || !message.trim()) { setError(locale === "ko" ? "제목과 내용을 입력하세요." : "Enter a subject and message."); return; } setSaving(true); setError(""); try { const response = await fetch("/api/support-tickets", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, body: message }) }); const body = await response.json(); if (!response.ok) throw new Error("ticket_create_failed"); setSubmittedReference(String(body.ticket?.reference_code ?? "")); setSubject(""); setMessage(""); await load(); } catch { setError(locale === "ko" ? "문의 접수에 실패했습니다." : "Could not create the ticket."); } finally { setSaving(false); } };
  return <Modal close={close} label={locale === "ko" ? "운영 문의" : "Support"}><button className="modal-close" onClick={close} aria-label="Close"><X/></button><h2>{locale === "ko" ? "운영 문의" : "Support"}</h2><p>{locale === "ko" ? "외부 메시지 대신 앱 안에서 처리 상태와 운영자 답변을 확인합니다. 첫 답변은 영업일 기준 2일 이내를 목표로 하며, 주말·지정 휴무일은 다음 영업일로 계산합니다." : "Use this in-app ticket instead of external messaging. Our first-response target is within two business days."}</p>{submittedReference && <div className="success-banner" role="status">{locale === "ko" ? `접수번호 ${submittedReference} · 검토 중 · 운영자 확인 후 앱에서 안내합니다.` : `Reference ${submittedReference} · Under review.`}</div>}<label className="field"><span>{locale === "ko" ? "제목" : "Subject"}</span><input value={subject} maxLength={160} onChange={(event) => setSubject(event.target.value)}/></label><label className="field"><span>{locale === "ko" ? "내용" : "Message"}</span><textarea value={message} maxLength={3000} onChange={(event) => setMessage(event.target.value)}/></label><button className="primary full" disabled={saving} onClick={() => void submit()}>{saving ? "…" : locale === "ko" ? "문의 접수" : "Submit ticket"}</button>{error && <p className="error-text" role="alert">{error}</p>}<div className="admin-data-list">{loading ? <div className="loading-state" role="status"><Loader2 className="spin"/><span>{locale === "ko" ? "문의 내역을 불러오는 중입니다…" : "Loading support tickets…"}</span></div> : tickets.map((ticket) => <article className="admin-data-card" key={ticket.id}><div><strong>{ticket.subject}</strong><span>{ticket.reference_code ? `${ticket.reference_code} · ` : ""}{ticket.status} · {new Date(ticket.created_at).toLocaleString(locale)}</span>{ticket.first_response_due_at && <small>{locale === "ko" ? `첫 답변 목표: ${new Date(ticket.first_response_due_at).toLocaleString(locale)}` : `First-response target: ${new Date(ticket.first_response_due_at).toLocaleString(locale)}`}</small>}</div><p>{ticket.body}</p>{ticket.operator_response && <p><strong>{locale === "ko" ? "운영자 답변" : "Operator response"}</strong><br/>{ticket.operator_response}</p>}</article>)}</div></Modal>;
}

function AccountModal({ t, user, profile, taskCount, listingCount, close, save, signout, openDelete }: { t: TFunction; user: User; profile: UserProfile; taskCount: number; listingCount: number; close: () => void; save: (profile: UserProfile) => void; signout: () => void; openDelete: () => void }) {
  const [name, setName] = useState(profile.name); const [arrivalDate, setArrivalDate] = useState(profile.arrivalDate); const [housing, setHousing] = useState<Housing>(profile.housing); const [claim, setClaim] = useState<{ listings: number; reservations: number; serviceRequests: number; lifecycle: number } | null>(null); const [claimError, setClaimError] = useState(""); const [claiming, setClaiming] = useState(false);
  const previewClaim = async () => { setClaiming(true); setClaimError(""); try { const result = await accountFetch("/api/account/claim-preview"); setClaim(result.counts as typeof claim); } catch { setClaimError("익명 데이터 정보를 불러오지 못했습니다."); } finally { setClaiming(false); } };
  const confirmClaim = async () => { setClaiming(true); setClaimError(""); try { await accountFetch("/api/account/claim", { method: "POST" }); setClaim(null); } catch { setClaimError("이 데이터는 이미 다른 계정에 연결되었거나 연결에 실패했습니다."); } finally { setClaiming(false); } };
  return <Modal close={close} label={tr(t, "profile:accountTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon verify"><BadgeCheck/></div><h2>{tr(t, "profile:accountTitle")}</h2><span className="verified-badge"><BadgeCheck size={15}/>{tr(t, "verification:verifiedKu")}</span><div className="import-summary"><span><strong>{taskCount}</strong>{tr(t, "profile:accountTasks")}</span><span><strong>{listingCount}</strong>{tr(t, "profile:accountListings")}</span></div><label className="field"><span>{tr(t, "verification:email")}</span><input value={user.email ?? ""} readOnly/></label><label className="field"><span>{tr(t, "profile:name")}</span><input value={name} onChange={(event) => setName(event.target.value)}/></label><label className="field"><span>{tr(t, "profile:arrivalDate")}</span><input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)}/></label><label className="field"><span>{tr(t, "profile:housingType")}</span><select value={housing} onChange={(event) => setHousing(event.target.value as Housing)}><option value="dorm">{tr(t, "profile:dorm")}</option><option value="off-campus">{tr(t, "profile:offCampus")}</option></select></label><button className="primary full" onClick={() => save({ name, arrivalDate, housing, mode: "personalized" })}>{tr(t, "profile:save")}</button><div className="configuration-warning"><strong>익명 데이터 연결</strong><p>현재 브라우저의 상품·예약·배송·보관·라이프사이클 데이터만 이 계정에 한 번 연결합니다. 다른 브라우저에서 계정으로 조회할 수 있으며, 다른 세션 데이터는 변경하지 않습니다.</p>{claim ? <><p>상품 {claim.listings}개 · 예약 {claim.reservations}개 · 배송/보관 {claim.serviceRequests}개 · 완료 작업 {claim.lifecycle}개</p><button className="primary full" disabled={claiming} onClick={() => void confirmClaim()}>이 데이터 연결</button></> : <button className="secondary" disabled={claiming} onClick={() => void previewClaim()}>연결할 데이터 미리보기</button>}{claimError && <p className="error-text" role="alert">{claimError}</p>}</div><div className="account-actions"><button className="secondary" onClick={signout}>{tr(t, "verification:signOut")}</button><button className="danger-link" onClick={openDelete}>{tr(t, "profile:deleteAccount")}</button></div></Modal>;
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

function PublicInfoModal({ locale, page, close }: { locale: Locale; page: "about" | "terms" | "privacy" | "safety" | "sources" | "disclaimer"; close: () => void }) {
  const contents: Record<Locale, Record<typeof page, [string, string]>> = {
    ko: {
      about: ["KU Settle 소개", "KU Settle은 익명 세션 기반의 정착 준비, 상품 등록·예약, 수동 배송·보관 신청 현황을 제공합니다. 고려대학교 공식 서비스가 아닙니다."],
      terms: ["이용약관 초안", "배송·보관 신청은 운영자가 수동으로 검토합니다. 비용은 운영자 확인 후 안내하며, 서비스 내 결제는 지원하지 않습니다. 이 문서는 법률 자문이 아닌 정책 초안입니다."],
      privacy: ["개인정보 처리 안내 초안", "익명 세션 데이터는 이 브라우저와 서비스 운영을 위해 저장됩니다. 금융·신원·민감정보를 입력하지 마세요. 이 문서는 정식 검토 전 정책 초안입니다."],
      safety: ["마켓·배송·보관 안전 안내", "안전한 공개 장소에서 거래하고 물품 상태와 인계 기록을 확인하세요. 진행 중 이전에는 취소할 수 있고, 이후 취소는 운영자 검토가 필요합니다. 분실·파손 기준은 운영 정책 초안입니다."],
      sources: ["정보 출처와 정정 기준", "생활 가이드에는 공식 출처를 표시합니다. 내부 검증 장소와 카카오 검색 후보는 구분해 표시합니다. 운영자 문의는 준비 중이며, 현재 신청 진행은 상태 업데이트에서 확인하세요."],
      disclaimer: ["서비스 안내", "현재 익명 세션, 상품 등록·예약, 수동 배송·보관 신청을 제공합니다. 결제, 업체 연동, 외부 메시지는 향후 연동 예정입니다. 중요한 결정은 담당 기관의 최신 안내를 확인하세요."]
    },
    en: {
      about: ["About KU Settle", "KU Settle provides anonymous planning, listing and reservation flows, and manual delivery or storage request tracking. It is not an official Korea University service."],
      terms: ["Terms of use — policy draft", "Delivery and storage requests are reviewed manually. Costs are confirmed by an operator; payment is not processed in this service. This is a policy draft, not legal advice."],
      privacy: ["Privacy notice — policy draft", "Anonymous session data is stored for this browser and service operations. Do not submit financial, identity, or sensitive information. This draft awaits formal review."],
      safety: ["Marketplace and fulfillment safety", "Meet in a safe public place, inspect items, and keep handover records. Cancellation is available before work is in progress; later cancellation requires operator review. Loss and damage handling is an operational policy draft."],
      sources: ["Information sources and correction policy", "Life Guide articles identify official sources. Internal verified places and Kakao search candidates are shown separately. Operator contact is being prepared; check request status updates for progress."],
      disclaimer: ["Service notice", "Current features include anonymous sessions, listings, reservations, and manually processed delivery or storage requests. Payment, providers, and external messaging are planned integrations. Confirm important decisions with the responsible organization."]
    },
    ja: {
      about: ["KU Settleについて", "KU Settleは、匿名セッションによる準備、出品・予約、手動配送・保管申請の状況確認を提供します。高麗大学の公式サービスではありません。"],
      terms: ["利用規約（草案）", "配送・保管申請は運営者が手動で確認します。費用は確認後に案内され、サービス内決済には対応していません。これは法的助言ではない運用方針の草案です。"],
      privacy: ["プライバシー案内（草案）", "匿名セッションのデータは、このブラウザとサービス運営のために保存されます。金融・本人確認・機微情報は入力しないでください。"],
      safety: ["マーケット・配送・保管の安全案内", "安全な公共の場所で取引し、物品と引き渡し記録を確認してください。作業開始前はキャンセルでき、以降は運営者の確認が必要です。"],
      sources: ["情報源と訂正方針", "生活ガイドでは公式情報源を表示します。内部確認済みの場所とKakao検索候補は分けて表示します。運営者への問い合わせは準備中です。"],
      disclaimer: ["サービス案内", "現在、匿名セッション、出品・予約、手動の配送・保管申請を提供しています。決済、事業者連携、外部メッセージは今後の連携予定です。"]
    },
    "zh-CN": {
      about: ["关于 KU Settle", "KU Settle 提供匿名会话准备、商品发布与预约，以及人工配送和寄存申请进度查询。它不是高丽大学官方服务。"],
      terms: ["使用条款（草案）", "配送和寄存申请由运营人员人工审核。费用将在确认后说明，服务内暂不提供支付。本文件为政策草案，并非法律意见。"],
      privacy: ["隐私说明（草案）", "匿名会话数据会为当前浏览器和服务运营而保存。请勿提交金融、身份或敏感信息。本草案有待正式审查。"],
      safety: ["市场、配送和寄存安全说明", "请在安全的公共场所交易，检查商品并保留交接记录。开始处理前可取消；之后取消需运营人员审核。"],
      sources: ["信息来源与更正政策", "生活指南会标明官方来源。内部验证地点与 Kakao 搜索候选会分别显示。运营咨询正在准备中，请通过申请状态查看进度。"],
      disclaimer: ["服务说明", "当前提供匿名会话、商品发布与预约、人工配送和寄存申请。支付、服务商对接和外部消息为后续计划。"]
    }
  };
  const content = contents[locale][page];
  return <Modal close={close} label={content[0]}><button className="modal-close" onClick={close} aria-label="Close"><X/></button><h2>{content[0]}</h2><p>{content[1]}</p></Modal>;
}

function ProductEditModal({ locale, t, product, close, save }: { locale: Locale; t: TFunction; product: MarketProduct; close: () => void; save: (product: MarketProduct) => void }) {
  const [name, setName] = useState(product.name ?? ""); const [description, setDescription] = useState(product.description ?? ""); const [price, setPrice] = useState(String(product.priceKrw)); const [pickup, setPickup] = useState(product.pickup ?? ""); const [hours, setHours] = useState(product.availableHours ?? ""); const [imageDataUrl, setImageDataUrl] = useState(product.imageDataUrl ?? ""); const [error, setError] = useState<string | null>(null);
  const submit = () => { const next = { ...product, name: name.trim(), description: description.trim(), priceKrw: Number(price.trim()), pickup: pickup.trim(), availableHours: hours.trim(), imageDataUrl }; const validation = validateMarketplaceInput(next); if (!validation.valid) { setError(validation.error); return; } save(next); };
  return <Modal close={close} label={locale === "ko" ? "상품 수정" : "Edit listing"}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><h2>{locale === "ko" ? "상품 수정" : locale === "ja" ? "商品を編集" : locale === "zh-CN" ? "编辑商品" : "Edit listing"}</h2><label className="field"><span>{locale === "ko" ? "상품명" : "Item name"}</span><input value={name} onChange={(e) => setName(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "설명" : "Description"}</span><textarea value={description} onChange={(e) => setDescription(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "가격" : "Price"}</span><input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "픽업 장소" : "Pickup"}</span><input value={pickup} onChange={(e) => setPickup(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "거래 가능 시간" : "Available hours"}</span><input value={hours} onChange={(e) => setHours(e.target.value)}/></label><label className="field"><span>{locale === "ko" ? "상품 이미지" : "Product image"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void compressImage(file).then(setImageDataUrl).catch((error) => setError(error instanceof Error ? error.message : "errors:imageInvalid")); e.currentTarget.value = ""; }}/>{imageDataUrl && <><img className="listing-image-preview" src={imageDataUrl} alt=""/><button type="button" className="skip-button" onClick={() => setImageDataUrl("")}><Trash2 size={14}/>{tr(t, "marketplace:removeImage")}</button></>}</label>{error && <p className="error-text" role="alert">{tr(t, error)}</p>}<button className="primary full" onClick={submit}>{locale === "ko" ? "저장" : locale === "ja" ? "保存" : locale === "zh-CN" ? "保存" : "Save"}</button></Modal>;
}

function serviceNextGuide(locale: Locale, status: LocalServiceRequest["status"]) {
  const copy = locale === "ko" ? { "not-selected": "신청 정보를 준비 중입니다.", "method-selected": "신청이 접수되었습니다. 운영자가 상담 준비 상태로 변경할 때까지 기다려 주세요.", "consultation-ready": "운영자가 요청 내용을 검토 중입니다.", "quote-viewed": "견적 안내를 확인해 주세요. 결제는 이 서비스에서 진행하지 않습니다.", "application-ready": "운영자가 접수 완료를 확인하고 있습니다.", "in-progress": "서비스가 진행 중입니다. 변경이 필요하면 운영자에게 문의해 주세요.", completed: "처리가 완료되었습니다.", cancelled: "신청이 취소되었습니다." } : locale === "ja" ? { "not-selected": "申請情報を準備しています。", "method-selected": "申請を受け付けました。", "consultation-ready": "運営者が内容を確認しています。", "quote-viewed": "見積もり案内を確認してください。", "application-ready": "申請完了を確認しています。", "in-progress": "サービス進行中です。", completed: "処理が完了しました。", cancelled: "申請はキャンセルされました。" } : locale === "zh-CN" ? { "not-selected": "正在准备申请信息。", "method-selected": "申请已提交。", "consultation-ready": "运营人员正在确认申请内容。", "quote-viewed": "请确认报价说明。", "application-ready": "正在确认申请完成。", "in-progress": "服务正在进行中。", completed: "处理已完成。", cancelled: "申请已取消。" } : { "not-selected": "Your request information is being prepared.", "method-selected": "Your request has been submitted.", "consultation-ready": "The operations team is reviewing your request.", "quote-viewed": "Review the estimate guidance.", "application-ready": "The application is being confirmed.", "in-progress": "Service is in progress.", completed: "Processing is complete.", cancelled: "The request was cancelled." };
  return copy[status] ?? copy["method-selected"];
}

function ServiceOptions({ locale, requests, update }: { locale: Locale; requests: LocalServiceRequest[]; update: (mode: ServiceRequestMode, updates?: Partial<LocalServiceRequest>) => void }) {
  const modes: ServiceRequestMode[] = ["pickup", "delivery", "storage"];
  const days = locale === "ko" ? "일" : locale === "ja" ? "日" : locale === "zh-CN" ? "天" : " days";
  const canCancel = (status: LocalServiceRequest["status"]) => ["not-selected", "method-selected", "consultation-ready", "quote-viewed", "application-ready"].includes(status);
  const [rules, setRules] = useState<Array<{ id: string; operation_type: string; title: string; address: string; cost_label: string; rules: string; duration_days: number[]; checked_at: string }>>([]);
  useEffect(() => { let active = true; void fetch("/api/operations", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((body) => { if (active && body?.rules) setRules(body.rules); }).catch(() => undefined); return () => { active = false; }; }, []);
  return <div className="service-demo-box"><strong>{serviceUi(locale, "method")}</strong><div className="service-option-grid">{modes.map((mode) => { const request = requests.find((item) => item.mode === mode); return <button key={mode} className={request ? "active" : ""} disabled={Boolean(request)} onClick={() => update(mode, { status: "method-selected", ...(mode === "delivery" ? { deliveryMethod: "undecided", estimatedCostLabel: locale === "ko" ? "견적 확인 필요" : "Quote required" } : {}), ...(mode === "storage" ? { storageDuration: "30", storageLocation: "campus", estimatedCostLabel: locale === "ko" ? "견적 확인 필요" : "Quote required" } : {}) })}>{request ? `${serviceUi(locale, mode)} · ${serviceStatusUi(locale, request.status)}` : serviceUi(locale, mode)}</button>; })}</div><p className="muted-copy">{locale === "ko" ? "신청 후 운영자가 상태와 견적 안내를 갱신합니다. 결제는 이 서비스에서 진행하지 않습니다." : "After submission, the operations team updates the status and estimate guidance. Payments are not processed in this service."}</p>{rules.length > 0 && <div className="operation-rule-list">{rules.map((rule) => <article key={rule.id}><strong>{rule.operation_type === "storage" ? (locale === "ko" ? "보관" : "Storage") : (locale === "ko" ? "배송" : "Delivery")} · {rule.title}</strong><span>{rule.address} · {rule.cost_label}</span><small>{rule.rules} · {locale === "ko" ? `확인일 ${rule.checked_at}` : `Checked ${rule.checked_at}`}</small></article>)}</div>}{requests.map((request) => <div className="service-demo-details" key={request.id}><strong>{serviceUi(locale, request.mode)} · {serviceStatusUi(locale, request.status)}</strong>{request.referenceCode && <span className="service-reference">{locale === "ko" ? "접수번호: " : "Reference: "}{request.referenceCode}</span>}<span>{serviceNextGuide(locale, request.status)}</span>{request.estimatedCostLabel && <span>{locale === "ko" ? "비용 안내: " : "Cost guidance: "}{request.estimatedCostLabel}</span>}<time dateTime={request.createdAt}>{locale === "ko" ? "신청 시각: " : "Submitted: "}{new Date(request.createdAt ?? request.updatedAt).toLocaleString(locale)}</time><time dateTime={request.updatedAt}>{locale === "ko" ? "최근 갱신: " : "Last updated: "}{new Date(request.updatedAt).toLocaleString(locale)}</time>{request.mode === "delivery" && <label>{locale === "ko" ? "배송 방식" : locale === "ja" ? "配送方法" : locale === "zh-CN" ? "配送方式" : "Delivery method"}<select disabled={!canCancel(request.status)} value={request.deliveryMethod ?? "undecided"} onChange={(event) => update("delivery", { deliveryMethod: event.target.value as "parcel" | "courier" | "undecided" })}><option value="undecided">{locale === "ko" ? "선택 전" : "Not selected"}</option><option value="parcel">{locale === "ko" ? "택배" : "Parcel"}</option><option value="courier">{locale === "ko" ? "퀵·당일 배송" : "Courier"}</option></select></label>}{request.mode === "storage" && <><label>{serviceUi(locale, "duration")}<select disabled={!canCancel(request.status)} value={request.storageDuration ?? "30"} onChange={(event) => update("storage", { storageDuration: event.target.value as "7" | "30" | "90" })}><option value="7">7{days}</option><option value="30">30{days}</option><option value="90">90{days}</option></select></label><label>{serviceUi(locale, "location")}<select disabled={!canCancel(request.status)} value={request.storageLocation ?? "campus"} onChange={(event) => update("storage", { storageLocation: event.target.value as "campus" | "partner" })}><option value="campus">{locale === "ko" ? "캠퍼스 보관소" : "Campus storage"}</option><option value="partner">{locale === "ko" ? "제휴 보관소" : "Partner storage"}</option></select></label></>}{canCancel(request.status) && <button className="danger-link" onClick={() => update(request.mode, { status: "cancelled" })}>{locale === "ko" ? "신청 취소" : "Cancel request"}</button>}</div>)}</div>;
}

function ProductModal({ locale, t, profile, mode, product: rawProduct, reservation, serviceRequests, updateService, close, contact, changeStatus, reserve, cancelReservation, edit }: { locale: Locale; t: TFunction; profile: UserProfile; mode: ProductModalMode; product: MarketProduct; reservation?: import("./lib/local-data").LocalReservation; serviceRequests: LocalServiceRequest[]; updateService: (mode: ServiceRequestMode, updates?: Partial<LocalServiceRequest>) => void; close: () => void; contact: () => void; reserve: () => void; cancelReservation: () => void; edit: () => void; changeStatus: (status: "active" | "sold" | "hidden" | "deleted") => void }) {
  const product = { ...rawProduct, ownedByCurrentUser: mode === "seller" }; const isSample = product.source === "sample"; const Icon = productIcons[product.icon]; const SellerIcon = product.userCreated ? Tag : BadgeCheck; const name = productName(product, t); const reservationLabel = reservation ? reservation.buyerName : "";
 return <Modal close={close} label={name}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className={`modal-product-visual ${product.userCreated ? "tone-user" : `tone-${product.id}`}`}><Icon/><span className={`availability ${product.status === "Reserved" ? "reserved" : ""}`}>{tr(t, product.status === "Available" ? "common:available" : "common:reserved")}</span></div><span className="seller"><SellerIcon size={16}/>{product.source === "live" ? tr(t, "common:liveData") : tr(t, "common:sampleData")}</span><h2>{name}</h2><strong className="modal-price">{formatCurrency(locale, product.priceKrw)}</strong>{product.imageDataUrl && <img className="modal-listing-image" src={product.imageDataUrl} alt={name}/>} {product.description && <p className="listing-description">{product.description}</p>} {product.availableHours && <p className="listing-hours">{product.availableHours}</p>}<div className="product-modal-details"><div><span>{tr(t, "marketplace:condition")}</span><strong>{tr(t, `marketplace:conditions.${product.condition}`)}</strong></div><div><span>{tr(t, "marketplace:pickup")}</span><strong><MapPin size={16}/>{productPickup(product, t)}</strong></div><div><span>{tr(t, "marketplace:seller")}</span><strong>{productSeller(product, t, profile)}</strong></div></div>{isSample ? <p className="sample-notice" role="note">{tr(t, "common:sampleOnly")}</p> : <ServiceOptions locale={locale} requests={serviceRequests} update={updateService}/>} {mode === "seller" ? <div className="owner-listing-actions">{reservation && <div className="reservation-owner-note"><strong>{tr(t, "marketplace:reservationHolder")}</strong><span>{reservationLabel}</span><button className="secondary" onClick={cancelReservation}>{tr(t, "marketplace:cancelReservation")}</button></div>}<button className="secondary" onClick={edit}>{locale === "ko" ? "상품 수정" : locale === "ja" ? "商品を編集" : locale === "zh-CN" ? "编辑商品" : "Edit listing"}</button><button className="secondary" onClick={() => changeStatus(product.serviceStatus === "sold" ? "active" : "sold")}>{tr(t, product.serviceStatus === "sold" ? "marketplace:cancelSold" : "marketplace:markSold")}</button><button className="secondary" onClick={() => changeStatus(product.serviceStatus === "hidden" ? "active" : "hidden")}>{tr(t, product.serviceStatus === "hidden" ? "marketplace:showListing" : "marketplace:hideListing")}</button><button className="danger-link" onClick={() => changeStatus("deleted")}>{tr(t, "marketplace:deleteListing")}</button></div> : isSample ? <p className="muted-copy">{tr(t, "common:sampleOnly")}</p> : <div className="product-actions"><button className="primary full" disabled={product.serviceStatus === "sold"} onClick={product.status === "Reserved" ? cancelReservation : reserve}>{locale === "ko" ? (product.status === "Reserved" ? "예약 취소" : "예약하기") : locale === "ja" ? (product.status === "Reserved" ? "予約を取り消す" : "予約する") : locale === "zh-CN" ? (product.status === "Reserved" ? "取消预约" : "预约商品") : (product.status === "Reserved" ? "Cancel reservation" : "Reserve item")}</button><button className="secondary full" onClick={contact}><MessageCircle size={18}/>{tr(t, "marketplace:contact")}</button><button className="danger-link" onClick={() => window.localStorage.setItem(`ku-settle-market-report-${product.id}`, "draft")}>{locale === "ko" ? "상품 신고" : locale === "ja" ? "商品を報告" : locale === "zh-CN" ? "举报商品" : "Report listing"}</button></div>}</Modal>;
}

function ContactModal({ t, close }: { t: TFunction; close: () => void }) {
  const [ready, setReady] = useState(false);
  return <Modal close={close} label={tr(t, "marketplace:contactTitle")}><button className="modal-close" onClick={close} aria-label={tr(t, "common:close")}><X/></button><div className="modal-icon"><MessageCircle/></div><h2>{tr(t, "marketplace:contactTitle")}</h2><p>{tr(t, "marketplace:contactBody")}</p><div className="message-preview">“{tr(t, "marketplace:message")}”</div><button className="primary full" onClick={() => setReady(true)}>{ready ? <Check/> : <MessageCircle/>}{tr(t, ready ? "marketplace:messageReady" : "marketplace:contact")}</button></Modal>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Search; text: string }) {
  return <div className="empty-state"><Icon/><p>{text}</p></div>;
}
