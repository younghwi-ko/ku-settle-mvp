"use client";

import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import i18n, { initialLocale, namespaces } from "./config";
import { detectLocale, type Locale } from "./types";

const languageStorageKey = "ku-settle-language";
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function localeFromUrl() {
  return new URLSearchParams(window.location.search).get("lang");
}

export function useAppI18n() {
  const { t } = useTranslation([...namespaces]);
  const [locale, setLocale] = useState<Locale>(() => initialLocale);
  const localeReady = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const syncLocaleMetadata = useCallback((nextLocale: Locale, updateUrl: boolean) => {
    document.documentElement.lang = nextLocale;
    document.documentElement.dataset.locale = nextLocale;
    try { localStorage.setItem(languageStorageKey, nextLocale); } catch { /* The UI can still use the selected locale without persistent storage. */ }
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", nextLocale);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const applyLocale = useCallback(async (nextLocale: Locale, updateUrl: boolean) => {
    await i18n.changeLanguage(nextLocale);
    setLocale(nextLocale);
    syncLocaleMetadata(nextLocale, updateUrl);
  }, [syncLocaleMetadata]);

  useLayoutEffect(() => {
    syncLocaleMetadata(initialLocale, true);
  }, [syncLocaleMetadata]);

  useEffect(() => {
    const onPopState = () => {
      let storedLocale: string | null = null;
      try { storedLocale = localStorage.getItem(languageStorageKey); } catch { /* Use URL and browser preferences when storage is unavailable. */ }
      const nextLocale = detectLocale(localeFromUrl(), storedLocale, navigator.languages ?? []);
      void applyLocale(nextLocale, false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyLocale]);

  const changeLocale = useCallback((nextLocale: Locale) => applyLocale(nextLocale, true), [applyLocale]);
  return { t, locale, localeReady, changeLocale };
}
