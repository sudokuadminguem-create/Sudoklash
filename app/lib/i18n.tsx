"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  detectLocale,
  LOCALE_KEY,
  translator,
  type Locale,
  type Translate,
} from "./i18n-core";

type I18n = { locale: Locale; setLocale: (locale: Locale) => void; t: Translate };
const Context = createContext<I18n>({
  locale: defaultLocale,
  setLocale: () => {},
  t: translator(defaultLocale),
});

/**
 * The language of the interface. The server always renders French; a visitor whose browser or
 * saved choice says otherwise gets their language right after hydration.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(LOCALE_KEY);
    } catch {
      // Unreadable storage: the browser language decides.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detectLocale(saved, navigator.language));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Not saved, but still applied for this visit.
    }
  }, []);
  const value = useMemo(() => ({ locale, setLocale, t: translator(locale) }), [locale, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Current language and translator; French outside an I18nProvider. */
export const useI18n = () => useContext(Context);
