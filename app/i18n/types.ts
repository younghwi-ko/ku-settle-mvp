export const supportedLocales = ["en", "ko", "ja", "zh-CN", "uz", "vi", "mn", "ms"] as const;
// Locale remains open at the content boundary because some legacy guide records
// contain only the original four locale keys. Runtime input is still restricted
// by isLocale/supportedLocales and the locale validation script.
export type Locale = string;

export const localeNames: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  "zh-CN": "简体中文",
  uz: "O‘zbekcha",
  vi: "Tiếng Việt",
  mn: "Монгол",
  ms: "Bahasa Melayu"
};

export function isLocale(value: unknown): boolean {
  return typeof value === "string" && supportedLocales.some((locale) => locale === value);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const normalized = value.trim().replace("_", "-");
  if (isLocale(normalized)) return normalized as Locale;
  const lower = normalized.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-sg" || lower.startsWith("zh-hans")) return "zh-CN";
  if (lower === "uz" || lower.startsWith("uz-")) return "uz";
  if (lower === "vi" || lower.startsWith("vi-")) return "vi";
  if (lower === "mn" || lower.startsWith("mn-")) return "mn";
  if (lower === "ms" || lower.startsWith("ms-")) return "ms";
  return null;
}

export function detectLocale(queryLocale: string | null, storedLocale: string | null, browserLocales: readonly string[]): Locale {
  const fromQuery = normalizeLocale(queryLocale);
  if (fromQuery) return fromQuery;
  const fromStorage = normalizeLocale(storedLocale);
  if (fromStorage) return fromStorage;
  for (const browserLocale of browserLocales) {
    const normalized = normalizeLocale(browserLocale);
    if (normalized) return normalized;
  }
  return "en";
}
