import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ko from "./locales/ko.json";
import ja from "./locales/ja.json";
import zhCN from "./locales/zh-CN.json";
import { detectLocale, type Locale } from "./types";

export const namespaces = ["common", "navigation", "home", "onboarding", "marketplace", "localGuide", "verification", "profile", "reset", "validation", "errors", "accessibility"] as const;
export const resources = {
  en: Object.fromEntries(namespaces.map((namespace) => [namespace, en[namespace]])),
  ko: Object.fromEntries(namespaces.map((namespace) => [namespace, ko[namespace]])),
  ja: Object.fromEntries(namespaces.map((namespace) => [namespace, ja[namespace]])),
  "zh-CN": Object.fromEntries(namespaces.map((namespace) => [namespace, zhCN[namespace]]))
};

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
    supportedLngs: ["en", "ko", "ja", "zh-CN"],
    nonExplicitSupportedLngs: false,
    ns: [...namespaces],
    defaultNS: "common",
    fallbackNS: "common",
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    saveMissing: process.env.NODE_ENV !== "production",
    missingKeyHandler: (languages, namespace, key) => {
      if (process.env.NODE_ENV !== "production") console.warn(`[i18n] Missing translation: ${languages.join(",")} ${namespace}:${key}`);
    },
    parseMissingKeyHandler: () => en.errors.missingTranslation,
    initAsync: false
  });
} else if (i18n.language !== initialLocale) {
  void i18n.changeLanguage(initialLocale);
}

export default i18n;
