import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useSettingsStore, LocaleTag, DEFAULT_SETTINGS } from './SettingsStore';
import { DICTIONARIES } from '@shared-i18n/dictionaries';
import {
  SUPPORTED_LOCALES as SHARED_LOCALES,
  LOCALE_NAMES as SHARED_LOCALE_NAMES,
  RTL_LOCALES,
} from '@shared-i18n/locales';
import type { LocaleTag as SharedLocaleTag } from '@shared-i18n/types';

// Re-export so existing mobile-app files that import LocaleTag from this
// module keep compiling.
export type { LocaleTag };

type Dict = Record<string, string | ((...args: any[]) => string)>;

// Flag emojis for each supported language. Falls back to 🌐 for anything missing.
const FLAG_MAP: Partial<Record<SharedLocaleTag, string>> = {
  en: '🇺🇸', fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', it: '🇮🇹', pt: '🇵🇹', nl: '🇳🇱',
  sv: '🇸🇪', da: '🇩🇰', fi: '🇫🇮', no: '🇳🇴', pl: '🇵🇱', cs: '🇨🇿', hu: '🇭🇺',
  ro: '🇷🇴', bg: '🇧🇬', uk: '🇺🇦', el: '🇬🇷', ar: '🇸🇦', he: '🇮🇱', fa: '🇮🇷',
  tr: '🇹🇷', hi: '🇮🇳', id: '🇮🇩', ms: '🇲🇾', th: '🇹🇭', zh: '🇨🇳', ja: '🇯🇵',
  ko: '🇰🇷', vi: '🇻🇳', ru: '🇷🇺',
};

export const SUPPORTED_LOCALES: { tag: LocaleTag; label: string; flag: string }[] = SHARED_LOCALES.map((tag) => ({
  tag,
  label: SHARED_LOCALE_NAMES[tag] || tag,
  flag: FLAG_MAP[tag] || '🌐',
}));

function flatten(dict: Record<string, Dict>): Record<string, string | ((...args: any[]) => string)> {
  const out: Record<string, string | ((...args: any[]) => string)> = {};
  for (const ns of Object.keys(dict)) {
    const section = dict[ns];
    for (const key of Object.keys(section)) {
      out[`${ns}.${key}`] = section[key];
    }
  }
  return out;
}

const FLAT_CACHE: { [k in LocaleTag]?: Record<string, string | ((...args: any[]) => string)> } = {};

function getFlat(locale: LocaleTag) {
  if (!FLAT_CACHE[locale]) FLAT_CACHE[locale] = flatten(DICTIONARIES[locale]);
  return FLAT_CACHE[locale]!;
}

export function translate(
  locale: LocaleTag,
  key: string,
  args?: Record<string, string | number>,
): string {
  const primary = getFlat(locale);
  const fallback = getFlat(DEFAULT_SETTINGS.locale);
  let entry: string | ((...args: any[]) => string) | undefined = primary[key];
  if (entry === undefined) entry = fallback[key];
  if (entry === undefined) return key;
  const rendered = typeof entry === 'function' ? entry(args) : entry;
  if (args) {
    return rendered.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
      Object.prototype.hasOwnProperty.call(args, k) ? String((args as any)[k]) : `{{${k}}}`,
    );
  }
  return rendered;
}

interface I18nContextValue {
  locale: LocaleTag;
  setLocale: (next: LocaleTag) => void;
  t: (key: string, args?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { settings, setLocale } = useSettingsStore();

  const t = useCallback(
    (key: string, args?: Record<string, string | number>) => translate(settings.locale, key, args),
    [settings.locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale: settings.locale, setLocale, t }),
    [settings.locale, setLocale, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for test usage.
    return {
      locale: DEFAULT_SETTINGS.locale,
      setLocale: () => {},
      t: (k, args) => translate(DEFAULT_SETTINGS.locale, k, args),
    };
  }
  return ctx;
}
