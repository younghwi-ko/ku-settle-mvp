"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, LogOut, RefreshCw, ShieldCheck, Trash2, RotateCcw } from "lucide-react";
import type { Locale } from "../i18n";

type Listing = { id: string; item_name: string; seller_name?: string; price_krw?: number; status: string; version: number; category?: string; pickup_location?: string };
type Reservation = { id: string; listing_id: string; status: string; version: number; guest_listings?: { item_name?: string; seller_name?: string } };
type Service = { id: string; service_type: string; status: string; version: number; listing_id?: string; task_id?: string; storage_duration?: string; storage_location?: string; delivery_method?: string };
type Override = { id?: string; place_key?: string; guide_key?: string; status: string; version: number; payload?: Record<string, unknown>; updated_at?: string };
type Report = { id: string; status: string; version: number; reason: string; detail?: string };
type AuditEntry = { id: string; resource_type: string; resource_key: string; action: string; reason?: string | null; created_at: string };
type AdminData = { listings: Listing[]; reservations: Reservation[]; serviceRequests: Service[]; placeOverrides: Override[]; guideOverrides: Override[]; reports: Report[]; auditLog: AuditEntry[]; counts: Record<string, number> };
type Tab = "overview" | "listings" | "reservations" | "services" | "places" | "guides" | "reports";

const copy = {
  ko: { auth: "관리자 API 인증", token: "관리자 토큰 입력", login: "관리자 세션 시작", logout: "로그아웃", refresh: "새로고침", required: "관리자 권한이 필요합니다.", network: "서버 연결에 실패했습니다.", saved: "서버에 저장되었습니다.", tabs: { overview: "요약", listings: "상품", reservations: "예약", services: "배송·보관", places: "장소", guides: "가이드", reports: "신고" }, empty: "데이터가 없습니다.", status: "상태", save: "상태 저장", delete: "소프트 삭제", restore: "복구", create: "상품 등록", item: "상품명", seller: "판매자", price: "가격", category: "카테고리", pickup: "픽업 장소", invalid: "입력값을 확인하세요.", rate: "요청이 많습니다. 잠시 후 다시 시도하세요." },
  en: { auth: "Admin API access", token: "Enter admin token", login: "Start admin session", logout: "Log out", refresh: "Refresh", required: "Admin permission is required.", network: "Could not connect to the server.", saved: "Saved to the server.", tabs: { overview: "Overview", listings: "Listings", reservations: "Reservations", services: "Delivery & storage", places: "Places", guides: "Guides", reports: "Reports" }, empty: "No data.", status: "Status", save: "Save status", delete: "Soft delete", restore: "Restore", create: "Create listing", item: "Item name", seller: "Seller", price: "Price", category: "Category", pickup: "Pickup location", invalid: "Check the input.", rate: "Too many requests. Try again later." },
  ja: { auth: "管理者API認証", token: "管理者トークンを入力", login: "管理者セッションを開始", logout: "ログアウト", refresh: "更新", required: "管理者権限が必要です。", network: "サーバーに接続できません。", saved: "サーバーに保存しました。", tabs: { overview: "概要", listings: "商品", reservations: "予約", services: "配送・保管", places: "場所", guides: "ガイド", reports: "報告" }, empty: "データがありません。", status: "状態", save: "状態を保存", delete: "ソフト削除", restore: "復元", create: "商品を登録", item: "商品名", seller: "出品者", price: "価格", category: "カテゴリ", pickup: "受取場所", invalid: "入力を確認してください。", rate: "リクエストが多すぎます。後で再試行してください。" },
  "zh-CN": { auth: "管理员API认证", token: "输入管理员令牌", login: "开始管理员会话", logout: "退出", refresh: "刷新", required: "需要管理员权限。", network: "无法连接服务器。", saved: "已保存到服务器。", tabs: { overview: "概览", listings: "商品", reservations: "预约", services: "配送·保管", places: "地点", guides: "指南", reports: "举报" }, empty: "暂无数据。", status: "状态", save: "保存状态", delete: "软删除", restore: "恢复", create: "创建商品", item: "商品名", seller: "卖家", price: "价格", category: "分类", pickup: "取货地点", invalid: "请检查输入。", rate: "请求过多，请稍后重试。" },
} as const;

function label(locale: Locale) { return copy[locale]; }
function money(value: number | undefined) { return typeof value === "number" ? `${value.toLocaleString()} KRW` : "—"; }

export default function AdminServerPanel({ locale }: { locale: Locale }) {
  const l = useMemo(() => label(locale), [locale]);
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [newListing, setNewListing] = useState({ itemName: "", sellerName: "", priceKrw: "", category: "Home", condition: "good", pickupLocation: "" });

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    let body: Record<string, unknown> = {};
    try { body = await response.json() as Record<string, unknown>; } catch { /* empty response */ }
    if (!response.ok) { const code = String(body.error ?? "network"); throw new Error(code); }
    return body;
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const body = await request("/api/admin/overview"); setData(body as unknown as AdminData); setAuthenticated(true); }
    catch (cause) { const code = cause instanceof Error ? cause.message : "network"; setAuthenticated(false); setData(null); setError(code === "admin_required" ? l.required : code === "rate_limited" ? l.rate : l.network); }
    finally { setLoading(false); }
  }, [l.network, l.rate, l.required, request]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const signIn = async () => {
    if (!token.trim()) return;
    setLoading(true); setError("");
    try { await request("/api/admin/session", { method: "POST", body: JSON.stringify({ token: token.trim() }) }); setToken(""); await load(); }
    catch (cause) { const code = cause instanceof Error ? cause.message : "network"; setError(code === "rate_limited" ? l.rate : code === "invalid_admin_token" ? l.required : l.network); setLoading(false); }
  };
  const signOut = async () => { try { await request("/api/admin/logout", { method: "POST" }); } finally { setAuthenticated(false); setData(null); setNotice(""); } };
  const mutate = async (path: string, body: Record<string, unknown>, method = "PATCH") => { setLoading(true); setError(""); setNotice(""); try { await request(path, { method, body: JSON.stringify(body) }); setNotice(l.saved); await load(); } catch (cause) { const code = cause instanceof Error ? cause.message : "network"; setError(code === "rate_limited" ? l.rate : code === "version_conflict" ? "Conflict: refresh and retry." : l.network); setLoading(false); } };

  const create = async () => {
    const price = Number(newListing.priceKrw);
    if (!newListing.itemName.trim() || !newListing.sellerName.trim() || !newListing.pickupLocation.trim() || !Number.isInteger(price) || price <= 0) { setError(l.invalid); return; }
    await mutate("/api/admin/listings", { sellerName: newListing.sellerName, itemName: newListing.itemName, description: "", priceKrw: price, category: newListing.category, condition: newListing.condition, pickupLocation: newListing.pickupLocation }, "POST");
    setNewListing({ itemName: "", sellerName: "", priceKrw: "", category: "Home", condition: "good", pickupLocation: "" });
  };

  const filtered = useCallback(<T extends object>(items: T[], getText: (item: T) => string) => items.filter((item) => getText(item).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))), [locale, search]);
  const visibleListings = useMemo(() => filtered(data?.listings ?? [], (item) => `${item.item_name} ${item.seller_name ?? ""}`), [data?.listings, filtered]);
  const visibleReservations = useMemo(() => filtered(data?.reservations ?? [], (item) => `${item.id} ${item.listing_id} ${item.status}`), [data?.reservations, filtered]);
  const visibleServices = useMemo(() => filtered(data?.serviceRequests ?? [], (item) => `${item.service_type} ${item.status} ${item.id}`), [data?.serviceRequests, filtered]);
  const visiblePlaces = useMemo(() => filtered(data?.placeOverrides ?? [], (item) => `${item.place_key ?? ""} ${item.status}`), [data?.placeOverrides, filtered]);
  const visibleGuides = useMemo(() => filtered(data?.guideOverrides ?? [], (item) => `${item.guide_key ?? ""} ${item.status}`), [data?.guideOverrides, filtered]);
  const visibleReports = useMemo(() => filtered(data?.reports ?? [], (item) => `${item.reason} ${item.status} ${item.id}`), [data?.reports, filtered]);

  if (!authenticated) return <section className="admin-server-panel" aria-label={l.auth}><div className="admin-server-heading"><div><span className="eyebrow"><ShieldCheck size={14}/>{l.auth}</span><p>HttpOnly 쿠키로만 인증되며 토큰은 저장되지 않습니다.</p></div></div><div className="admin-auth-form"><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder={l.token} aria-label={l.token}/><button className="primary" disabled={loading || !token.trim()} onClick={() => void signIn()}>{loading ? <Loader2 className="spin"/> : l.login}</button></div>{error && <p className="admin-server-error" role="alert">{error}</p>}</section>;

  const statusEditor = (path: string, item: { id?: string; place_key?: string; guide_key?: string; version: number; status: string }, statuses: string[]) => <div className="admin-inline-actions"><select aria-label={l.status} value={item.status} onChange={(event) => void mutate(path, { status: event.target.value, version: item.version })}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="secondary" onClick={() => void mutate(path, { status: item.status, version: item.version })}>{l.save}</button>{item.status === "deleted" ? <button className="secondary" onClick={() => void mutate(path, { status: "active", version: item.version })}><RotateCcw size={15}/>{l.restore}</button> : <button className="danger-link" onClick={() => { if (window.confirm(l.delete)) void mutate(path, { status: "deleted", version: item.version }); }}><Trash2 size={15}/>{l.delete}</button>}</div>;
  const rows = tab === "listings" ? visibleListings.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.item_name}</strong><span>{item.seller_name ?? "—"} · {money(item.price_krw)} · {item.status}</span></div>{statusEditor(`/api/admin/listings/${item.id}`, item, ["active", "reserved", "sold", "hidden", "deleted"])}</article>) : tab === "reservations" ? visibleReservations.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.guest_listings?.item_name ?? item.listing_id}</strong><span>{item.id} · {item.status}</span></div>{statusEditor(`/api/admin/reservations/${item.id}`, item, ["active", "cancelled", "completed"])}</article>) : tab === "services" ? visibleServices.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.service_type}</strong><span>{item.id} · {item.status} {item.storage_duration ? `· ${item.storage_duration}` : ""}</span></div>{statusEditor(`/api/admin/service-requests/${item.id}`, item, ["not-selected", "method-selected", "consultation-ready", "quote-viewed", "application-ready", "in-progress", "completed", "cancelled"])}</article>) : tab === "places" ? visiblePlaces.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.place_key}</strong><span>{item.status} · {item.updated_at ?? "—"}</span></div>{statusEditor(`/api/admin/places/${item.place_key}`, item, ["active", "inactive", "needs_confirmation", "deleted"])}</article>) : tab === "guides" ? visibleGuides.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.guide_key}</strong><span>{item.status} · {item.updated_at ?? "—"}</span></div>{statusEditor(`/api/admin/guides/${item.guide_key}`, item, ["active", "inactive", "needs_confirmation", "deleted"])}</article>) : tab === "reports" ? visibleReports.map((item) => <article className="admin-data-card" key={item.id}><div><strong>{item.reason}</strong><span>{item.status} · {item.detail ?? ""}</span></div>{statusEditor(`/api/admin/reports/${item.id}`, item, ["new", "reviewed", "resolved", "deleted"])}</article>) : null;

  return <section className="admin-server-panel admin-server-panel-full" aria-label={l.auth}><div className="admin-server-heading"><div><span className="eyebrow"><ShieldCheck size={14}/>{l.auth}</span><p>서버 저장 운영 데이터 · 관리자 전용</p></div><div className="admin-inline-actions"><button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{l.refresh}</button><button className="secondary" onClick={() => void signOut()}><LogOut size={15}/>{l.logout}</button></div></div>{error && <p className="admin-server-error" role="alert">{error}</p>}{notice && <p className="admin-server-notice" role="status"><CheckCircle2 size={15}/>{notice}</p>}<nav className="admin-server-tabs" aria-label={l.auth}>{(Object.keys(l.tabs) as Tab[]).map((key) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setSearch(""); }}>{l.tabs[key]}</button>)}</nav>{tab === "overview" && data && <><div className="admin-server-metrics"><span><strong>{data.counts.listings ?? data.listings.length}</strong>{l.tabs.listings}</span><span><strong>{data.counts.reservations ?? data.reservations.length}</strong>{l.tabs.reservations}</span><span><strong>{data.counts.serviceRequests ?? data.serviceRequests.length}</strong>{l.tabs.services}</span><span><strong>{data.counts.reports ?? data.reports.length}</strong>{l.tabs.reports}</span><span><strong>{data.placeOverrides.length}</strong>{l.tabs.places}</span><span><strong>{data.guideOverrides.length}</strong>{l.tabs.guides}</span></div><div className="admin-audit-log"><h3>최근 관리자 작업</h3>{data.auditLog.length ? data.auditLog.slice(0, 10).map((entry) => <div className="admin-audit-row" key={entry.id}><strong>{entry.action}</strong><span>{entry.resource_type} · {entry.resource_key}</span><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString(locale)}</time></div>) : <p>{l.empty}</p>}</div></>}{tab === "listings" && <div className="admin-create-form"><h3>{l.create}</h3><input placeholder={l.item} value={newListing.itemName} onChange={(e) => setNewListing({ ...newListing, itemName: e.target.value })}/><input placeholder={l.seller} value={newListing.sellerName} onChange={(e) => setNewListing({ ...newListing, sellerName: e.target.value })}/><input type="number" placeholder={l.price} value={newListing.priceKrw} onChange={(e) => setNewListing({ ...newListing, priceKrw: e.target.value })}/><input placeholder={l.pickup} value={newListing.pickupLocation} onChange={(e) => setNewListing({ ...newListing, pickupLocation: e.target.value })}/><button className="primary" onClick={() => void create()}>{l.create}</button></div>}{tab !== "overview" && <div className="admin-list-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search admin data"/><span>{rows?.length ?? 0}</span></div>}{tab !== "overview" && <div className="admin-data-list">{rows && rows.length ? rows : <div className="empty-state"><CircleAlert/><p>{l.empty}</p></div>}</div>}</section>;
}
