import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ko from "./locales/ko.json";
import ja from "./locales/ja.json";
import zhCN from "./locales/zh-CN.json";
import uz from "./locales/uz.json";
import vi from "./locales/vi.json";
import mn from "./locales/mn.json";
import ms from "./locales/ms.json";
import { detectLocale, supportedLocales, type Locale } from "./types";

export const namespaces = ["common", "navigation", "home", "onboarding", "marketplace", "localGuide", "verification", "profile", "admin", "reset", "validation", "errors", "accessibility"] as const;
type JsonObject = Record<string, unknown>;
function deepMerge(base: JsonObject, override: JsonObject): JsonObject {
  const output: JsonObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    output[key] = value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])
      ? deepMerge(base[key] as JsonObject, value as JsonObject)
      : value;
  }
  return output;
}

const localeSources: Record<string, JsonObject> = { en, ko, ja, "zh-CN": zhCN, uz, vi, mn, ms };
export const resources = Object.fromEntries(supportedLocales.map((locale) => {
  const source = locale === "en" ? en : deepMerge(en, localeSources[locale]);
  return [locale, Object.fromEntries(namespaces.map((namespace) => [namespace, source[namespace]]))];
})) as Resource;

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  let storedLocale: string | null = null;
  try { storedLocale = window.localStorage.getItem("ku-settle-language"); } catch { /* Use URL and browser preferences when storage is unavailable. */ }
  return detectLocale(
    new URLSearchParams(window.location.search).get("lang"),
    storedLocale,
    window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language]
  );
}

export const initialLocale = resolveInitialLocale();

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: initialLocale,
    fallbackLng: "en",
    supportedLngs: [...supportedLocales],
    nonExplicitSupportedLngs: false,
    ns: [...namespaces],
    defaultNS: "common",
    fallbackNS: "common",
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    saveMissing: process.env.NODE_ENV !== "production",
    missingKeyHandler: (languages: readonly string[], namespace: string, key: string) => {
      if (process.env.NODE_ENV !== "production") console.warn(`[i18n] Missing translation: ${languages.join(",")} ${namespace}:${key}`);
    },
    parseMissingKeyHandler: () => en.errors.missingTranslation,
    initAsync: false
  });
} else if (i18n.language !== initialLocale) {
  void i18n.changeLanguage(initialLocale);
}

export default i18n;
