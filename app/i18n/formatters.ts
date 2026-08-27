import type { Locale } from "./types";

const localeTags: Record<Locale, string> = { en: "en-US", ko: "ko-KR", ja: "ja-JP", "zh-CN": "zh-CN" };

export function formatNumber(locale: Locale, value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(localeTags[locale], options).format(value);
}

export function formatPercent(locale: Locale, value: number) {
  return new Intl.NumberFormat(localeTags[locale], { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
}

export function formatCurrency(locale: Locale, value: number) {
  return new Intl.NumberFormat(localeTags[locale], { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(locale: Locale, isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTags[locale], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDistance(locale: Locale, meters: number) {
  return new Intl.NumberFormat(localeTags[locale], { style: "unit", unit: "meter", unitDisplay: "short" }).format(meters);
}
