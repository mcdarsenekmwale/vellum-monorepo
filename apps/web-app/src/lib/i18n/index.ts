// ─── Constants (web-app-specific storage keys + shared locale constants) ───

// Re-export types so existing `@/lib/i18n/types` & `@/lib/i18n` consumers keep working.
export type { LocaleTag, Dict, NamespaceDict } from "@shared-i18n/types";

// Shared locale constants from @vellum/shared-i18n.
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
} from "@shared-i18n/locales";

// ─── Web-app-specific storage keys ───

export const STORAGE_V1 = "vellum.web.settings.v1";
export const STORAGE_LOCALE_RAW = "vellum.web.locale";
