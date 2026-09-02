import type { Locale } from "./types";

const localeTags: Record<string, string> = {
  en: "en-US", ko: "ko-KR", ja: "ja-JP", "zh-CN": "zh-CN",
  uz: "uz-UZ", vi: "vi-VN", mn: "mn-MN", ms: "ms-MY"
};
const localeTag = (locale: Locale) => localeTags[locale] ?? localeTags.en;

export function formatNumber(locale: Locale, value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(localeTag(locale), options).format(value);
}

export function formatPercent(locale: Locale, value: number) {
  return new Intl.NumberFormat(localeTag(locale), { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
}

export function formatCurrency(locale: Locale, value: number) {
  return new Intl.NumberFormat(localeTag(locale), { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(locale: Locale, isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (locale === "uz" || locale.startsWith("uz-")) {
    const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
    return `${day}-${months[month - 1]}, ${year}`;
  }
  if (locale === "mn" || locale.startsWith("mn-")) {
    const months = ["нэгдүгээр", "хоёрдугаар", "гуравдугаар", "дөрөвдүгээр", "тавдугаар", "зургадугаар", "долдугаар", "наймдугаар", "есдүгээр", "аравдугаар", "арван нэгдүгээр", "арван хоёрдугаар"];
    return `${year} оны ${months[month - 1]} сарын ${day}`;
  }
  return new Intl.DateTimeFormat(localeTag(locale), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDateTime(locale: Locale, value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "—";
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDistance(locale: Locale, meters: number) {
  return new Intl.NumberFormat(localeTag(locale), { style: "unit", unit: "meter", unitDisplay: "short" }).format(meters);
}

export function joinOptionalLabel(label: string, detail?: string | null) {
  return [label.trim(), detail?.trim()].filter(Boolean).join(" · ");
}
