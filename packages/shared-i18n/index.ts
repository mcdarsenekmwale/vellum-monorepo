// ─── @vellum/shared-i18n ───
// Shared i18n package consumed by both web-app and mobile-app.
//
// Exports:
//   - Types:        LocaleTag, Dict, NamespaceDict
//   - Locales:      DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_NAMES, RTL_LOCALES, isRTL
//   - Dictionaries: DICTIONARIES (Record<LocaleTag, NamespaceDict>) and each
//                   per-locale dict (EN_DICT, FR_DICT, ...)

export * from "./types";
export * from "./locales";
export * from "./dictionaries";
