// ─── Locale constants ───

import { LocaleTag } from "./types";

export const DEFAULT_LOCALE: LocaleTag = "en";

export const SUPPORTED_LOCALES: LocaleTag[] = [
  "en", "fr", "es", "de", "it", "pt", "nl", "sv", "da",
  "fi", "no", "pl", "cs", "hu", "ro", "bg", "uk", "el",
  "ar", "he", "fa", "tr", "hi", "id", "ms", "th", "zh",
  "ja", "ko", "vi", "ru",
];

export const LOCALE_NAMES: Record<LocaleTag, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  no: "Norsk",
  pl: "Polski",
  cs: "Čeština",
  hu: "Magyar",
  ro: "Română",
  bg: "Български",
  uk: "Українська",
  el: "Ελληνικά",
  ar: "العربية",
  he: "עברית",
  fa: "فارسی",
  tr: "Türkçe",
  hi: "हिन्दी",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  th: "ไทย",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
  ru: "Русский",
};

export const RTL_LOCALES: LocaleTag[] = ["ar", "he", "fa"];

export function isRTL(locale: LocaleTag): boolean {
  return RTL_LOCALES.includes(locale);
}
