"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, LogOut, RefreshCw, ShieldCheck, Trash2, RotateCcw } from "lucide-react";
import { normalizeLocale, type Locale } from "../i18n";
import { legacyCopy } from "../i18n/legacy-copy";

type Listing = { id: string; item_name: string; seller_name?: string; price_krw?: number; status: string; version: number; category?: string; pickup_location?: string };
type Reservation = { id: string; listing_id: string; status: string; version: number; guest_listings?: { item_name?: string; seller_name?: string } };
type Service = { id: string; reference_code?: string; service_type: string; status: string; version: number; listing_id?: string; task_id?: string; storage_duration?: string; storage_location?: string; delivery_method?: string; origin?: string; destination?: string; estimated_cost_label?: string | null; admin_note?: string | null; admin_cancel_reason?: string | null; admin_updated_at?: string | null; admin_updated_by?: string | null; created_at?: string };
type Override = { id?: string; place_key?: string; guide_key?: string; status: string; version: number; payload?: Record<string, unknown>; updated_at?: string };
type Report = { id: string; status: string; version: number; reason: string; detail?: string };
type Ticket = { id: string; reference_code?: string | null; status: string; version: number; subject: string; body: string; operator_response?: string | null; handled_by?: string | null; handled_at?: string | null; first_response_due_at?: string | null; first_response_at?: string | null; created_at?: string };
type OperationRule = { id: string; operation_type: "delivery" | "storage"; title: string; address: string; cost_label: string; rules: string; duration_days: number[]; source_url?: string | null; checked_at: string; status: string; version: number; updated_at?: string };
type AuditEntry = { id: string; actor?: string | null; resource_type: string; resource_key: string; action: string; reason?: string | null; created_at: string };
type AdminData = { auditLog: AuditEntry[]; catalogCounts?: { places?: number; guides?: number }; counts: Record<string, number> };
type AdminLists = { listings: Listing[]; reservations: Reservation[]; serviceRequests: Service[]; placeOverrides: Override[]; guideOverrides: Override[]; reports: Report[]; tickets: Ticket[]; operationRules: OperationRule[]; auditLog: AuditEntry[] };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type Tab = "overview" | "listings" | "reservations" | "delivery" | "storage" | "operations" | "places" | "guides" | "reports" | "tickets" | "audit";

const copy = {
  ko: { auth: "관리자 API 인증", token: "관리자 토큰 입력", login: "관리자 세션 시작", logout: "로그아웃", refresh: "새로고침", required: "관리자 권한이 필요합니다.", network: "서버 연결에 실패했습니다.", saved: "서버에 저장되었습니다.", tabs: { overview: "요약", listings: "상품", reservations: "예약", delivery: "배송", storage: "보관", operations: "운영 기준", places: "장소", guides: "가이드", reports: "신고", tickets: "문의", audit: "감사 로그" }, empty: "데이터가 없습니다.", status: "상태", save: "운영 내용 저장", delete: "소프트 삭제", cancel: "취소 처리", restore: "복구", showDeleted: "삭제됨 포함", hideDeleted: "일반 목록만 보기", create: "상품 등록", item: "상품명", seller: "판매자", price: "가격", category: "카테고리", pickup: "픽업 장소", invalid: "입력값을 확인하세요.", rate: "요청이 많습니다. 잠시 후 다시 시도하세요.", note: "내부 처리 메모", cost: "견적·비용 안내", updated: "마지막 처리", details: "신청 정보" },
  en: { auth: "Admin API access", token: "Enter admin token", login: "Start admin session", logout: "Log out", refresh: "Refresh", required: "Admin permission is required.", network: "Could not connect to the server.", saved: "Saved to the server.", tabs: { overview: "Overview", listings: "Listings", reservations: "Reservations", delivery: "Delivery", storage: "Storage", operations: "Operating rules", places: "Places", guides: "Guides", reports: "Reports", tickets: "Tickets", audit: "Audit log" }, empty: "No data.", status: "Status", save: "Save operations", delete: "Soft delete", cancel: "Cancel", restore: "Restore", showDeleted: "Include deleted", hideDeleted: "Show active only", create: "Create listing", item: "Item name", seller: "Seller", price: "Price", category: "Category", pickup: "Pickup location", invalid: "Check the input.", rate: "Too many requests. Try again later.", note: "Internal processing note", cost: "Estimate / cost guidance", updated: "Last processed", details: "Request details" },
  ja: { auth: "管理者API認証", token: "管理者トークンを入力", login: "管理者セッションを開始", logout: "ログアウト", refresh: "更新", required: "管理者権限が必要です。", network: "サーバーに接続できません。", saved: "サーバーに保存しました。", tabs: { overview: "概要", listings: "商品", reservations: "予約", delivery: "配送", storage: "保管", operations: "運用基準", places: "場所", guides: "ガイド", reports: "報告", tickets: "問い合わせ", audit: "監査ログ" }, empty: "データがありません。", status: "状態", save: "運用内容を保存", delete: "ソフト削除", cancel: "キャンセル", restore: "復元", showDeleted: "削除済みを含む", hideDeleted: "有効な項目のみ", create: "商品を登録", item: "商品名", seller: "出品者", price: "価格", category: "カテゴリ", pickup: "受取場所", invalid: "入力を確認してください。", rate: "リクエストが多すぎます。後で再試行してください。", note: "内部処理メモ", cost: "見積もり・費用案内", updated: "最終処理", details: "申請情報" },
  "zh-CN": { auth: "管理员API认证", token: "输入管理员令牌", login: "开始管理员会话", logout: "退出", refresh: "刷新", required: "需要管理员权限。", network: "无法连接服务器。", saved: "已保存到服务器。", tabs: { overview: "概览", listings: "商品", reservations: "预约", delivery: "配送", storage: "保管", operations: "运营规则", places: "地点", guides: "指南", reports: "举报", tickets: "咨询", audit: "审计日志" }, empty: "暂无数据。", status: "状态", save: "保存运营内容", delete: "软删除", cancel: "取消", restore: "恢复", showDeleted: "包含已删除", hideDeleted: "仅显示有效", create: "创建商品", item: "商品名", seller: "卖家", price: "价格", category: "分类", pickup: "取货地点", invalid: "请检查输入。", rate: "请求过多，请稍后重试。", note: "内部处理备注", cost: "报价／费用说明", updated: "最近处理", details: "申请信息" },
} as const;

function activeLocale(locale: Locale): Locale { return normalizeLocale(locale) ?? "en"; }
function label(locale: Locale): (typeof copy)["en"] { const resolved = activeLocale(locale); return (copy[resolved as keyof typeof copy] ?? legacyCopy(resolved, copy.en)) as (typeof copy)["en"]; }
function adminText(locale: Locale, value: string) { return legacyCopy(activeLocale(locale), value); }
function statusText(locale: Locale, value: string) { return legacyCopy(activeLocale(locale), value).replaceAll("_", " ").replaceAll("-", " "); }
function money(value: number | undefined) { return typeof value === "number" ? `${value.toLocaleString()} KRW` : "—"; }

function ServiceOperationCard({ item, locale, l, save, remove }: { item: Service; locale: Locale; l: ReturnType<typeof label>; save: (body: Record<string, unknown>) => void; remove: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [adminNote, setAdminNote] = useState(item.admin_note ?? "");
  const [estimatedCostLabel, setEstimatedCostLabel] = useState(item.estimated_cost_label ?? "");
  const [cancelReason, setCancelReason] = useState(item.admin_cancel_reason ?? "");
  const statuses = ["method-selected", "consultation-ready", "quote-viewed", "application-ready", "in-progress", "completed", "cancelled", "soft_deleted"];
  const requestDetails = [item.delivery_method && `${adminText(locale, "Method")}: ${statusText(locale, item.delivery_method)}`, item.origin && `${adminText(locale, "From")}: ${item.origin}`, item.destination && `${adminText(locale, "To")}: ${item.destination}`, item.storage_duration && `${adminText(locale, "Duration")}: ${item.storage_duration} ${adminText(locale, "days")}`, item.storage_location && `${adminText(locale, "Location")}: ${item.storage_location}`].filter(Boolean).join(" · ");
  const processed = item.admin_updated_at ? new Date(item.admin_updated_at).toLocaleString(locale) : "—";
  return <article className="admin-data-card admin-service-card"><div><strong>{item.service_type === "delivery" ? l.tabs.delivery : l.tabs.storage}</strong><span>{item.reference_code ?? item.id} · {statusText(locale, item.status)} · {item.created_at ? new Date(item.created_at).toLocaleString(locale) : "—"}</span></div><p className="admin-service-details"><b>{l.details}</b> {requestDetails || "—"}</p><label className="admin-service-field"><span>{l.status}</span><select aria-label={l.status} value={status} onChange={(event) => { const nextStatus = event.target.value; setStatus(nextStatus); save({ status: nextStatus, version: item.version, adminNote, estimatedCostLabel, cancelReason }); }}>{statuses.map((candidate) => <option key={candidate} value={candidate}>{statusText(locale, candidate)}</option>)}</select></label><label className="admin-service-field"><span>{l.cost}</span><input value={estimatedCostLabel} maxLength={120} onChange={(event) => setEstimatedCostLabel(event.target.value)} placeholder={l.cost}/></label><label className="admin-service-field"><span>{l.note}</span><textarea value={adminNote} maxLength={2000} onChange={(event) => setAdminNote(event.target.value)} placeholder={l.note}/></label><label className="admin-service-field"><span>{adminText(locale, "Internal cancellation reason")}</span><input value={cancelReason} maxLength={500} onChange={(event) => setCancelReason(event.target.value)} placeholder={adminText(locale, "Record when cancelling")}/></label><div className="admin-inline-actions"><span className="admin-processed"><b>{l.updated}</b> {processed} · {item.admin_updated_by ?? "—"}</span><button className="secondary" onClick={() => save({ status, version: item.version, adminNote, estimatedCostLabel, cancelReason })}>{l.save}</button>{item.status === "soft_deleted" ? <button className="secondary" onClick={() => save({ status: "cancelled", version: item.version, adminNote, estimatedCostLabel, cancelReason })}><RotateCcw size={15}/>{l.restore}</button> : <button className="danger-link" onClick={remove}><Trash2 size={15}/>{l.delete}</button>}</div></article>;
}

function TicketCard({ item, locale, l, save }: { item: Ticket; locale: Locale; l: ReturnType<typeof label>; save: (body: Record<string, unknown>) => void }) {
  const [status, setStatus] = useState(item.status); const [response, setResponse] = useState(item.operator_response ?? "");
  const overdue = Boolean(item.first_response_due_at && !item.first_response_at && !["closed", "deleted"].includes(item.status) && new Date(item.first_response_due_at) < new Date());
  return <article className="admin-data-card"><div><strong>{item.subject}</strong><span>{item.reference_code ?? item.id} · {statusText(locale, item.status)} · {item.handled_by ?? "—"}</span><small>{item.created_at ? `${new Date(item.created_at).toLocaleString(locale)}` : ""}{item.first_response_due_at ? ` · ${new Date(item.first_response_due_at).toLocaleString(locale)}` : ""}{overdue ? ` · ${adminText(locale, "Overdue")}` : ""}</small></div><p>{item.body}</p><label className="admin-service-field"><span>{l.status}</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{["open", "reviewing", "resolved", "closed", "deleted"].map((value) => <option key={value} value={value}>{statusText(locale, value)}</option>)}</select></label><label className="admin-service-field"><span>{l.note}</span><textarea value={response} maxLength={3000} onChange={(event) => setResponse(event.target.value)}/></label><button className="secondary" onClick={() => save({ status, operatorResponse: response, version: item.version })}>{l.save}</button></article>;
}

export default function AdminServerPanel({ locale, onAuthChange }: { locale: Locale; onAuthChange?: (authenticated: boolean) => void }) {
  const l = useMemo(() => label(locale), [locale]);
  const [token, setToken] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [lists, setLists] = useState<AdminLists>({ listings: [], reservations: [], serviceRequests: [], placeOverrides: [], guideOverrides: [], reports: [], tickets: [], operationRules: [], auditLog: [] });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [newListing, setNewListing] = useState({ itemName: "", sellerName: "", priceKrw: "", category: "Home", condition: "good", pickupLocation: "" });
  const [newRule, setNewRule] = useState({ operationType: "storage" as "delivery" | "storage", title: "", address: "", costLabel: "", rules: "", durationDays: "7,30", sourceUrl: "", checkedAt: new Date().toISOString().slice(0, 10), status: "draft" });

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    let body: Record<string, unknown> = {};
    try { body = await response.json() as Record<string, unknown>; } catch { /* empty response */ }
    if (!response.ok) { const code = String(body.error ?? "network"); throw new Error(code); }
    return body;
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const body = await request("/api/admin/overview"); setData(body as unknown as AdminData); setAuthenticated(true); onAuthChange?.(true); }
    catch (cause) { const code = cause instanceof Error ? cause.message : "network"; setAuthenticated(false); setData(null); onAuthChange?.(false); setError(code === "admin_required" ? l.required : code === "rate_limited" ? l.rate : l.network); }
    finally { setLoading(false); }
  }, [l.network, l.rate, l.required, onAuthChange, request]);

  const loadTab = useCallback(async (selectedTab: Tab, selectedPage = page) => {
    if (selectedTab === "overview") return;
    const routes: Record<Exclude<Tab, "overview">, { path: string; key: keyof AdminLists }> = {
      listings: { path: "/api/admin/listings", key: "listings" }, reservations: { path: "/api/admin/reservations", key: "reservations" },
      delivery: { path: "/api/admin/service-requests?type=delivery", key: "serviceRequests" }, storage: { path: "/api/admin/service-requests?type=storage", key: "serviceRequests" },
      operations: { path: "/api/admin/operations", key: "operationRules" }, places: { path: "/api/admin/places", key: "placeOverrides" },
      guides: { path: "/api/admin/guides", key: "guideOverrides" }, reports: { path: "/api/admin/reports", key: "reports" },
      tickets: { path: "/api/admin/tickets", key: "tickets" }, audit: { path: "/api/admin/audit", key: "auditLog" },
    };
    const route = routes[selectedTab];
    const separator = route.path.includes("?") ? "&" : "?";
    const query = new URLSearchParams({ page: String(selectedPage), pageSize: "20", includeDeleted: String(showDeleted) });
    if (search.trim()) query.set("search", search.trim());
    if (statusFilter) query.set("status", statusFilter);
    setLoading(true); setError("");
    try {
      const body = await request(`${route.path}${separator}${query}`);
      const rows = Array.isArray(body[route.key]) ? body[route.key] as AdminLists[typeof route.key] : [];
      setLists((current) => ({ ...current, [route.key]: rows }));
      setPagination((body.pagination as Pagination | undefined) ?? { page: selectedPage, pageSize: 20, total: rows.length, totalPages: 1 });
      setAuthenticated(true); onAuthChange?.(true);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "network";
      if (code === "admin_required") { setAuthenticated(false); setData(null); onAuthChange?.(false); }
      setError(code === "admin_required" ? l.required : code === "rate_limited" ? l.rate : l.network);
    } finally { setLoading(false); }
  }, [l.network, l.rate, l.required, onAuthChange, page, request, search, showDeleted, statusFilter]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!authenticated || tab === "overview") return;
    const timer = window.setTimeout(() => void loadTab(tab, page), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [authenticated, loadTab, page, search, showDeleted, statusFilter, tab]);

  const signIn = async () => {
    if (!token.trim()) return;
    setLoading(true); setError("");
    try { await request("/api/admin/session", { method: "POST", body: JSON.stringify({ token: token.trim(), operatorName: operatorName.trim() }) }); setToken(""); setOperatorName(""); await load(); }
    catch (cause) { const code = cause instanceof Error ? cause.message : "network"; setError(code === "rate_limited" ? l.rate : code === "invalid_admin_token" ? l.required : l.network); setLoading(false); }
  };
  const signOut = async () => { try { await request("/api/admin/logout", { method: "POST" }); } finally { setAuthenticated(false); onAuthChange?.(false); setData(null); setNotice(""); } };
  const mutate = async (path: string, body: Record<string, unknown>, method = "PATCH") => { setLoading(true); setError(""); setNotice(""); try { await request(path, { method, body: JSON.stringify(body) }); setNotice(l.saved); await Promise.all([load(), loadTab(tab, page)]); } catch (cause) { const code = cause instanceof Error ? cause.message : "network"; setError(code === "rate_limited" ? l.rate : code === "version_conflict" ? adminText(locale, "Conflict: refresh and retry.") : l.network); setLoading(false); } };

  const create = async () => {
    const price = Number(newListing.priceKrw);
    if (!newListing.itemName.trim() || !newListing.sellerName.trim() || !newListing.pickupLocation.trim() || !Number.isInteger(price) || price <= 0) { setError(l.invalid); return; }
    await mutate("/api/admin/listings", { sellerName: newListing.sellerName, itemName: newListing.itemName, description: "", priceKrw: price, category: newListing.category, condition: newListing.condition, pickupLocation: newListing.pickupLocation }, "POST");
    setNewListing({ itemName: "", sellerName: "", priceKrw: "", category: "Home", condition: "good", pickupLocation: "" });
  };
  const createRule = async () => {
    const durationDays = newRule.durationDays.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value));
    if (!newRule.title.trim() || !newRule.address.trim() || !newRule.costLabel.trim() || !newRule.rules.trim() || !newRule.checkedAt || (newRule.operationType === "storage" && !durationDays.length)) { setError(l.invalid); return; }
    await mutate("/api/admin/operations", { ...newRule, durationDays }, "POST");
    setNewRule({ operationType: "storage", title: "", address: "", costLabel: "", rules: "", durationDays: "7,30", sourceUrl: "", checkedAt: new Date().toISOString().slice(0, 10), status: "draft" });
  };

  const visibleListings = useMemo(() => lists.listings, [lists.listings]);
  const visibleReservations = useMemo(() => lists.reservations, [lists.reservations]);
  const visibleServices = useMemo(() => lists.serviceRequests, [lists.serviceRequests]);
  const visibleDelivery = useMemo(() => visibleServices.filter((item) => item.service_type === "delivery"), [visibleServices]);
  const visibleStorage = useMemo(() => visibleServices.filter((item) => item.service_type === "storage"), [visibleServices]);
  const visiblePlaces = useMemo(() => lists.placeOverrides, [lists.placeOverrides]);
  const visibleGuides = useMemo(() => lists.guideOverrides, [lists.guideOverrides]);
  const visibleReports = useMemo(() => lists.reports, [lists.reports]);
  const visibleTickets = useMemo(() => lists.tickets, [lists.tickets]);
  const visibleRules = useMemo(() => lists.operationRules, [lists.operationRules]);

  if (!authenticated) return <section className="admin-server-panel" aria-label={l.auth}><div className="admin-server-heading"><div><span className="eyebrow"><ShieldCheck size={14}/>{l.auth}</span><p>{adminText(locale, "Authentication uses an HttpOnly cookie. The token and operator name are not saved in browser storage.")}</p></div></div><div className="admin-auth-form"><input autoComplete="off" value={operatorName} maxLength={80} onChange={(event) => setOperatorName(event.target.value)} placeholder={adminText(locale, "Operator name")} aria-label={adminText(locale, "Operator name")}/><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder={l.token} aria-label={l.token}/><button className="primary" disabled={loading || !token.trim() || !operatorName.trim()} onClick={() => void signIn()}>{loading ? <Loader2 className="spin"/> : l.login}</button></div>{error && <p className="admin-server-error" role="alert">{error}</p>}</section>;

  const statusEditor = (path: string, item: { id?: string; place_key?: string; guide_key?: string; version: number; status: string }, statuses: string[], removalStatus = "deleted", restoreStatus = "active") => <div className="admin-inline-actions"><select aria-label={l.status} value={item.status} onChange={(event) => void mutate(path, { status: event.target.value, version: item.version })}>{statuses.map((status) => <option key={status} value={status}>{statusText(locale, status)}</option>)}</select><button className="secondary" onClick={() => void mutate(path, { status: item.status, version: item.version })}>{l.save}</button>{item.status === removalStatus ? <button className="secondary" onClick={() => void mutate(path, { status: restoreStatus, version: item.version })}><RotateCcw size={15}/>{l.restore}</button> : <button className="danger-link" onClick={() => { if (window.confirm(l.delete)) void mutate(path, { status: removalStatus, version: item.version, deletionReason: "test data cleanup" }); }}><Trash2 size={15}/>{l.delete}</button>}</div>;
  const serviceRows = (items: Service[]) => items.map((item) => <ServiceOperationCard key={`${item.id}-${item.version}`} item={item} locale={locale} l={l} save={(body) => void mutate(`/api/admin/service-requests/${item.id}`, body)} remove={() => { if (window.confirm(l.delete)) void mutate(`/api/admin/service-requests/${item.id}`, { status: "soft_deleted", version: item.version, deletionReason: "admin cleanup" }); }}/>) ;
  const rows = tab === "listings" ? visibleListings.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.item_name}</strong><span>{item.seller_name ?? "—"} · {money(item.price_krw)} · {statusText(locale, item.status)}</span></div>{statusEditor(`/api/admin/listings/${item.id}`, item, ["active", "reserved", "sold", "hidden", "deleted"])}</article>) : tab === "reservations" ? visibleReservations.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.guest_listings?.item_name ?? item.listing_id}</strong><span>{item.id} · {statusText(locale, item.status)}</span></div>{statusEditor(`/api/admin/reservations/${item.id}`, item, ["active", "cancelled", "completed", "expired", "soft_deleted"], "soft_deleted", "cancelled")}</article>) : tab === "delivery" ? serviceRows(visibleDelivery) : tab === "storage" ? serviceRows(visibleStorage) : tab === "operations" ? visibleRules.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.title}</strong><span>{statusText(locale, item.operation_type)} · {statusText(locale, item.status)} · {item.address} · {item.cost_label}</span><small>{item.checked_at} · {item.duration_days.join(", ") || "—"}</small><p>{item.rules}</p></div>{statusEditor(`/api/admin/operations/${item.id}`, item, ["draft", "active", "inactive", "deleted"])}</article>) : tab === "places" ? visiblePlaces.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.place_key}</strong><span>{statusText(locale, item.status)} · {item.updated_at ?? "—"}</span></div>{statusEditor(`/api/admin/places/${item.place_key}`, item, ["active", "inactive", "needs_confirmation", "deleted"])}</article>) : tab === "guides" ? visibleGuides.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.guide_key}</strong><span>{statusText(locale, item.status)} · {item.updated_at ?? "—"}</span></div>{statusEditor(`/api/admin/guides/${item.guide_key}`, item, ["active", "inactive", "needs_confirmation", "deleted"])}</article>) : tab === "reports" ? visibleReports.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.reason}</strong><span>{statusText(locale, item.status)} · {item.detail ?? ""}</span></div>{statusEditor(`/api/admin/reports/${item.id}`, item, ["new", "reviewed", "resolved", "deleted"])}</article>) : tab === "tickets" ? visibleTickets.map((item) => <TicketCard key={item.id} item={item} locale={locale} l={l} save={(body) => void mutate(`/api/admin/tickets/${item.id}`, body)}/>) : tab === "audit" ? lists.auditLog.map((entry) => <article className="admin-data-card" key={entry.id}><div><strong>{statusText(locale, entry.action)}</strong><span>{statusText(locale, entry.resource_type)} · {entry.resource_key} · {entry.actor ?? "—"}</span><small>{new Date(entry.created_at).toLocaleString(locale)}</small></div>{entry.reason && <p>{entry.reason}</p>}</article>) : null;

  return <section className="admin-server-panel admin-server-panel-full" aria-label={l.auth}><div className="admin-server-heading"><div><span className="eyebrow"><ShieldCheck size={14}/>{l.auth}</span><p>{adminText(locale, "Server-stored operations · administrators only")}</p></div><div className="admin-inline-actions"><button className="secondary" onClick={() => void (tab === "overview" ? load() : loadTab(tab, page))} disabled={loading}><RefreshCw size={15}/>{l.refresh}</button><button className="secondary" onClick={() => void signOut()}><LogOut size={15}/>{l.logout}</button></div></div>{error && <p className="admin-server-error" role="alert">{error}</p>}{notice && <p className="admin-server-notice" role="status"><CheckCircle2 size={15}/>{notice}</p>}<nav className="admin-server-tabs" aria-label={l.auth}>{(Object.keys(l.tabs) as Tab[]).map((key) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setSearch(""); setStatusFilter(""); setPage(1); }}>{l.tabs[key]}</button>)}</nav>{tab === "overview" && data && <><div className="admin-server-metrics"><span><strong>{data.counts.listings ?? 0}</strong>{l.tabs.listings}</span><span><strong>{data.counts.reservations ?? 0}</strong>{l.tabs.reservations}</span><span><strong>{data.counts.delivery ?? 0}</strong>{l.tabs.delivery}</span><span><strong>{data.counts.storage ?? 0}</strong>{l.tabs.storage}</span><span><strong>{data.counts.operationRules ?? 0}</strong>{l.tabs.operations}</span><span><strong>{data.counts.overdueTickets ?? 0}</strong>{l.tabs.tickets}</span><span><strong>{data.catalogCounts?.places ?? 0}</strong>{l.tabs.places}</span><span><strong>{data.counts.placeOverrides ?? 0}</strong>{adminText(locale, "Overrides")}</span><span><strong>{data.catalogCounts?.guides ?? 0}</strong>{l.tabs.guides}</span><span><strong>{data.counts.guideOverrides ?? 0}</strong>{adminText(locale, "Overrides")}</span></div><div className="admin-audit-log"><h3>{l.tabs.audit}</h3>{data.auditLog.length ? data.auditLog.map((entry) => <div className="admin-audit-row" key={entry.id}><strong>{statusText(locale, entry.action)}</strong><span>{statusText(locale, entry.resource_type)} · {entry.resource_key} · {entry.actor ?? "—"}</span><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString(locale)}</time></div>) : <p>{l.empty}</p>}</div></>}{tab === "listings" && <div className="admin-create-form"><h3>{l.create}</h3><input placeholder={l.item} value={newListing.itemName} onChange={(e) => setNewListing({ ...newListing, itemName: e.target.value })}/><input placeholder={l.seller} value={newListing.sellerName} onChange={(e) => setNewListing({ ...newListing, sellerName: e.target.value })}/><input type="number" placeholder={l.price} value={newListing.priceKrw} onChange={(e) => setNewListing({ ...newListing, priceKrw: e.target.value })}/><input placeholder={l.pickup} value={newListing.pickupLocation} onChange={(e) => setNewListing({ ...newListing, pickupLocation: e.target.value })}/><button className="primary" onClick={() => void create()}>{l.create}</button></div>}{tab === "operations" && <div className="admin-create-form admin-operation-form"><h3>{l.tabs.operations}</h3><select value={newRule.operationType} onChange={(e) => setNewRule({ ...newRule, operationType: e.target.value as "delivery" | "storage" })}><option value="storage">{l.tabs.storage}</option><option value="delivery">{l.tabs.delivery}</option></select><select value={newRule.status} onChange={(e) => setNewRule({ ...newRule, status: e.target.value })}><option value="draft">{statusText(locale, "draft")}</option><option value="active">{statusText(locale, "active")}</option><option value="inactive">{statusText(locale, "inactive")}</option></select><input placeholder={l.item} value={newRule.title} onChange={(e) => setNewRule({ ...newRule, title: e.target.value })}/><input placeholder={l.pickup} value={newRule.address} onChange={(e) => setNewRule({ ...newRule, address: e.target.value })}/><input placeholder={l.cost} value={newRule.costLabel} onChange={(e) => setNewRule({ ...newRule, costLabel: e.target.value })}/><input placeholder="7,30" value={newRule.durationDays} disabled={newRule.operationType === "delivery"} onChange={(e) => setNewRule({ ...newRule, durationDays: e.target.value })}/><input type="date" value={newRule.checkedAt} onChange={(e) => setNewRule({ ...newRule, checkedAt: e.target.value })}/><input type="url" placeholder={adminText(locale, "Source URL")} value={newRule.sourceUrl} onChange={(e) => setNewRule({ ...newRule, sourceUrl: e.target.value })}/><textarea placeholder={l.details} value={newRule.rules} onChange={(e) => setNewRule({ ...newRule, rules: e.target.value })}/><button className="primary" onClick={() => void createRule()}>{l.save}</button></div>}{tab !== "overview" && <div className="admin-list-toolbar"><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={adminText(locale, "Search")} aria-label={adminText(locale, "Search admin data")}/><input value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} placeholder={l.status} aria-label={l.status}/>{tab !== "audit" && <button className="secondary" aria-pressed={showDeleted} onClick={() => { setShowDeleted((value) => !value); setPage(1); }}>{showDeleted ? l.hideDeleted : l.showDeleted}</button>}<span>{pagination.total}</span></div>}{tab !== "overview" && <><div className="admin-data-list">{loading && !rows?.length ? <div className="loading-state"><Loader2 className="spin"/></div> : rows && rows.length ? rows : <div className="empty-state"><CircleAlert/><p>{l.empty}</p></div>}</div><div className="admin-pagination"><button className="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>←</button><span>{pagination.page} / {pagination.totalPages}</span><button className="secondary" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>→</button></div></>}</section>;
}
