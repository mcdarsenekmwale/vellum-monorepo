import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings/language")({
  head: () => ({
    meta: [
      { title: "Language — Vellum" },
      { name: "description", content: "Choose your preferred language for Vellum." },
    ],
  }),
  component: LanguagePage,
});

const languages = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "zh", name: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
];

function LanguagePage() {
  const [selected, setSelected] = useState("en");

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          Back to settings
        </Link>

        <h1 className="text-3xl font-display italic mb-2">Language</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Choose your preferred language for the Vellum interface.
        </p>

        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {languages.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setSelected(lang.code)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left"
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {lang.flag}
                </span>
                <span className="flex-1 text-sm font-medium">{lang.name}</span>
                {isSelected && (
                  <Check className="size-5 text-accent" strokeWidth={2.2} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </WebShell>
  );
}
