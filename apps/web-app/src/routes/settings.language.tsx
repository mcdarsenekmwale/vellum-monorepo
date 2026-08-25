import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { ArrowLeft, Check } from "lucide-react";
import { useMemo } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { type LocaleTag } from "@/lib/i18n/types";

export const Route = createFileRoute("/settings/language")({
  head: () => ({
    meta: [{ title: "Language — Vellbase" }],
  }),
  component: LanguagePage,
});

type Option = { tag: LocaleTag; label: string; flag: string };

function LanguagePage() {
  const { t, locale, setLocale } = useI18n();

  const options: Option[] = useMemo(
    () => [
      { tag: "en", label: "English", flag: "🇺🇸" },
      { tag: "fr", label: "Français", flag: "🇫🇷" },
      { tag: "es", label: "Español", flag: "🇪🇸" },
      { tag: "de", label: "Deutsch", flag: "🇩🇪" },
      { tag: "zh", label: "中文", flag: "🇨🇳" },
      { tag: "ja", label: "日本語", flag: "🇯🇵" },
      { tag: "ko", label: "한국어", flag: "🇰🇷" },
      { tag: "pt", label: "Português", flag: "🇵🇹" },
      { tag: "ru", label: "Русский", flag: "🇷🇺" },
      { tag: "tr", label: "Türkçe", flag: "🇹🇷" },
      { tag: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
    ],
    [],
  );

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto" data-testid="settings-language-page">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          data-testid="language-back"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          {t("common.back")}
        </Link>

        <h1 className="text-3xl font-display italic mb-2" data-testid="language-title">
          {t("settings.sectionsLanguage")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8" data-testid="language-description">
          {t("settings.sectionsLanguageDescription")}
        </p>

        <div className="bg-card border border-border rounded-2xl overflow-hidden" data-testid="language-options">
          {options.map((opt) => {
            const isSelected = locale === opt.tag;
            return (
              <button
                key={opt.tag}
                onClick={() => setLocale(opt.tag)}
                data-testid={`language-option-${opt.tag}`}
                data-selected={isSelected ? "true" : "false"}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left border-b border-border last:border-b-0"
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {opt.flag}
                </span>
                <span className="flex-1 text-sm font-medium">{opt.label}</span>
                <span
                  className="text-xs uppercase tracking-widest text-muted-foreground mr-2 font-semibold"
                >
                  {opt.tag}
                </span>
                {isSelected && (
                  <Check className="size-5 text-accent" strokeWidth={2.2} data-testid={`language-check-${opt.tag}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </WebShell>
  );
}
