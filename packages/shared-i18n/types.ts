// ─── Types ───

export type LocaleTag =
  | "en" | "fr" | "es" | "de" | "it" | "pt" | "nl" | "sv" | "da"
  | "fi" | "no" | "pl" | "cs" | "hu" | "ro" | "bg" | "uk" | "el"
  | "ar" | "he" | "fa" | "tr" | "hi" | "id" | "ms" | "th" | "zh"
  | "ja" | "ko" | "vi" | "ru";

export type Dict = Record<string, string>;
export type NamespaceDict = Record<string, Dict>;
