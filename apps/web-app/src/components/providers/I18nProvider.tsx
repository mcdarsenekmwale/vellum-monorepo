// lib/i18n/index.ts

import { DEFAULT_LOCALE, STORAGE_LOCALE_RAW, SUPPORTED_LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { LocaleTag } from "@/lib/i18n/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_V1 } from "./ThemeProvider";



// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// CONTEXT
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

type I18nContextValue = {
  locale: LocaleTag;
  setLocale: (locale: LocaleTag) => void;
  t: (key: string, args?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];
  getLocaleName: (locale: LocaleTag) => string;
  supportedLocales: LocaleTag[];
  isRTL: boolean;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── RTL Locales ───

const RTL_LOCALES: LocaleTag[] = ["ar", "he", "fa"];

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// PROVIDER
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: LocaleTag;
  storageKey?: string;
}

export function I18nProvider({
  children,
  defaultLocale = DEFAULT_LOCALE,
  storageKey = STORAGE_LOCALE_RAW,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<LocaleTag>(defaultLocale);
  const [isLoaded, setIsLoaded] = useState(false);

  // ─── Load from storage ───
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) as LocaleTag | null;
      const settingsRaw = localStorage.getItem(STORAGE_V1);
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};

      const detectedLocale = stored || settings.locale || defaultLocale;
      const validated = SUPPORTED_LOCALES.includes(detectedLocale as LocaleTag)
        ? (detectedLocale as LocaleTag)
        : defaultLocale;

      setLocaleState(validated);
    } catch {
      setLocaleState(defaultLocale);
    } finally {
      setIsLoaded(true);
    }
  }, [defaultLocale, storageKey]);

  // ─── Set locale ───
  const setLocale = useCallback(
    (newLocale: LocaleTag) => {
      if (!SUPPORTED_LOCALES.includes(newLocale)) {
        console.warn(`Unsupported locale: ${newLocale}`);
        return;
      }

      setLocaleState(newLocale);

      try {
        // Update both storage locations
        localStorage.setItem(storageKey, newLocale);

        const settingsRaw = localStorage.getItem(STORAGE_V1);
        const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
        localStorage.setItem(
          STORAGE_V1,
          JSON.stringify({ ...settings, locale: newLocale }),
        );
      } catch (error) {
        console.error("Failed to save locale preference:", error);
      }
    },
    [storageKey],
  );

  // ─── Translation function ───
  const t = useCallback(
    (key: string, args?: Record<string, string | number>): string => {
      // ─── Parse namespace and key ───
      const parts = key.split(".");
      const namespace = parts.length > 1 ? parts[0] : "common";
      const translationKey = parts.length > 1 ? parts.slice(1).join(".") : key;

      // ─── Get dictionary ───
      const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];

      // ─── Try to find translation ───
      let value: string | undefined;

      // Check if the translation exists in the current locale
      if (dict[namespace] && dict[namespace][translationKey]) {
        value = dict[namespace][translationKey];
      }

      // ─── Fallback to English ───
      if (!value && locale !== DEFAULT_LOCALE) {
        const fallbackDict = DICTIONARIES[DEFAULT_LOCALE];
        if (fallbackDict[namespace] && fallbackDict[namespace][translationKey]) {
          value = fallbackDict[namespace][translationKey];
        }
      }

      // ─── Fallback to key with namespace ───
      if (!value) {
        value = `${namespace}.${translationKey}`;
      }

      // ─── Substitute placeholders ({{variable}}) ───
      if (args) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
          Object.prototype.hasOwnProperty.call(args, k) ? String(args[k]) : `{{${k}}}`
        );
      }
      return value;
    },
    [locale],
  );

  // ─── Translation array function ───
  const tArray = useCallback(
    (key: string): string[] => {
      const value = t(key);
      return value.split(",").map((s) => s.trim());
    },
    [t],
  );

  // ─── Get locale name ───
  const getLocaleName = useCallback(
    (localeCode: LocaleTag): string => {
      return LOCALE_NAMES[localeCode] || localeCode;
    },
    [],
  );

  // ─── Check if RTL ───
  const isRTL = RTL_LOCALES.includes(locale);

  // ─── Format number ───
  const formatNumber = useCallback(
    (num: number, options?: Intl.NumberFormatOptions): string => {
      try {
        return new Intl.NumberFormat(locale, options).format(num);
      } catch {
        return num.toLocaleString();
      }
    },
    [locale],
  );

  // ─── Format date ───
  const formatDate = useCallback(
    (date: Date, options?: Intl.DateTimeFormatOptions): string => {
      try {
        return new Intl.DateTimeFormat(locale, options).format(date);
      } catch {
        return date.toLocaleString();
      }
    },
    [locale],
  );

  // ─── Memoized value ───
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      tArray,
      getLocaleName,
      supportedLocales: SUPPORTED_LOCALES,
      isRTL,
      formatNumber,
      formatDate,
    }),
    [locale, setLocale, t, tArray, getLocaleName, isRTL, formatNumber, formatDate],
  );

  // ─── Don't render until loaded ───
  if (!isLoaded) {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// HOOKS
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
}

export function useTranslate(): (key: string, args?: Record<string, string | number>) => string {
  const { t } = useI18n();
  return t;
}

export function useLocale(): LocaleTag {
  const { locale } = useI18n();
  return locale;
}

export function useSetLocale(): (locale: LocaleTag) => void {
  const { setLocale } = useI18n();
  return setLocale;
}

export function useRTL(): boolean {
  const { isRTL } = useI18n();
  return isRTL;
}

export function useFormatNumber(): (num: number, options?: Intl.NumberFormatOptions) => string {
  const { formatNumber } = useI18n();
  return formatNumber;
}

export function useFormatDate(): (date: Date, options?: Intl.DateTimeFormatOptions) => string {
  const { formatDate } = useI18n();
  return formatDate;
}
