"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, { namespaces } from "./config";
import { detectLocale, type Locale } from "./types";

const languageStorageKey = "ku-settle-language";

function localeFromUrl() {
  return new URLSearchParams(window.location.search).get("lang");
}

export function useAppI18n() {
  const { t } = useTranslation([...namespaces]);
  const [locale, setLocale] = useState<Locale>("en");
  const [localeReady, setLocaleReady] = useState(false);

  const applyLocale = useCallback(async (nextLocale: Locale, updateUrl: boolean) => {
    await i18n.changeLanguage(nextLocale);
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dataset.locale = nextLocale;
    localStorage.setItem(languageStorageKey, nextLocale);
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", nextLocale);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    const initialLocale = detectLocale(localeFromUrl(), localStorage.getItem(languageStorageKey), navigator.languages?.length ? navigator.languages : [navigator.language]);
    const frame = requestAnimationFrame(() => { void applyLocale(initialLocale, true).then(() => setLocaleReady(true)); });
    const onPopState = () => {
      const nextLocale = detectLocale(localeFromUrl(), localStorage.getItem(languageStorageKey), navigator.languages ?? []);
      void applyLocale(nextLocale, false);
    };
    window.addEventListener("popstate", onPopState);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("popstate", onPopState); };
  }, [applyLocale]);

  const changeLocale = useCallback((nextLocale: Locale) => applyLocale(nextLocale, true), [applyLocale]);
  return { t, locale, localeReady, changeLocale };
}
