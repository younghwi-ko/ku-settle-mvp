export const supportedLocales = ["en", "ko", "ja", "zh-CN"] as const;
export type Locale = (typeof supportedLocales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  "zh-CN": "简体中文"
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const normalized = value.trim().replace("_", "-");
  if (isLocale(normalized)) return normalized;
  const lower = normalized.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-sg" || lower.startsWith("zh-hans")) return "zh-CN";
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
