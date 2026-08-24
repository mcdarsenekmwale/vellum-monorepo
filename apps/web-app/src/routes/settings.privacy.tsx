import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { ArrowLeft, Lock, Eye, EyeOff, Users, Globe, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettingsStore } from "@/components/providers/SettingsStore";
import { RowSwitch } from "@/components/settings/RowSwitch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings/privacy")({
  head: () => ({
    meta: [{ title: "Privacy — Vellum" }],
  }),
  component: PrivacyPage,
});

type Visibility = "public" | "followers" | "private";

function PrivacyPage() {
  const { t } = useI18n();
  const { privacy, setPrivacy, isBackendLoading } = useSettingsStore();

  const [visibility, setVisibilityState] = useState<Visibility>("public");

  // Hydrate visibility from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vellum.web.settings.v1");
      const v = raw ? JSON.parse(raw) : {};
      if (v.profileVisibility === "followers" || v.profileVisibility === "private") {
        setVisibilityState(v.profileVisibility);
      }
    } catch {}
  }, []);

  const setVisibility = (v: Visibility) => {
    setVisibilityState(v);
    try {
      const raw = localStorage.getItem("vellum.web.settings.v1");
      const cur = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        "vellum.web.settings.v1",
        JSON.stringify({ ...cur, profileVisibility: v }),
      );
    } catch {}
  };

  const visibilityOptions: { value: Visibility; labelKey: string; icon: typeof Globe; desc: string }[] = [
    { value: "public", labelKey: "privacyPublic", icon: Globe, desc: "Anyone can see your profile and articles." },
    { value: "followers", labelKey: "privacyFollowers", icon: Users, desc: "Only people who follow you can see updates." },
    { value: "private", labelKey: "privacyPrivate", icon: Lock, desc: "Only people you approve can see your content." },
  ];

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto" data-testid="settings-privacy-page">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          data-testid="privacy-back"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          {t("common.back")}
        </Link>

        <h1 className="text-3xl font-display italic mb-2" data-testid="privacy-title">
          {t("settings.privacyTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8" data-testid="privacy-description">
          {t("settings.privacyDescription")}
        </p>

        {/* Profile visibility */}
        <section className="mb-6" data-testid="privacy-profile-visibility">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
            {t("settings.privacyProfileVisibility")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {visibilityOptions.map((opt) => {
              const selected = visibility === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  data-testid={`privacy-visibility-${opt.value}`}
                  data-selected={selected ? "true" : "false"}
                  className={cn(
                    "text-left rounded-2xl border p-4 transition-all",
                    selected
                      ? "border-accent bg-accent/5 ring-1 ring-accent"
                      : "border-border hover:border-accent/50 hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={cn(
                        "size-10 grid place-items-center rounded-xl",
                        selected ? "bg-accent/15 text-accent" : "bg-muted text-foreground",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="font-semibold text-foreground text-[15px]">
                      {t(`settings.${opt.labelKey}`)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Toggles */}
        <section data-testid="privacy-toggles-section">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div className="flex items-center gap-4">
                <span className="size-10 grid place-items-center rounded-xl bg-muted text-foreground shrink-0">
                  <Shield className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <div className="text-sm font-semibold">{t("settings.privacyAllowComments")}</div>
                </div>
              </div>
              <RowSwitch
                checked={privacy.allowComments}
                onChange={(v) => setPrivacy({ allowComments: v })}
                dataTestId="privacy-allow-comments"
              />
            </div>

            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div className="flex items-center gap-4">
                <span className="size-10 grid place-items-center rounded-xl bg-muted text-foreground shrink-0">
                  <Eye className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <div className="text-sm font-semibold">{t("settings.privacyShowLikesCount")}</div>
                </div>
              </div>
              <RowSwitch
                checked={privacy.allowLikes}
                onChange={(v) => setPrivacy({ allowLikes: v })}
                dataTestId="privacy-show-likes-count"
              />
            </div>

            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-4">
                <span className="size-10 grid place-items-center rounded-xl bg-muted text-foreground shrink-0">
                  <EyeOff className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <div className="text-sm font-semibold">{t("settings.privacyShowOnline")}</div>
                </div>
              </div>
              <RowSwitch
                checked={privacy.showOnlineStatus}
                onChange={(v) => setPrivacy({ showOnlineStatus: v })}
                dataTestId="privacy-show-online"
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-end gap-2">
            {isBackendLoading && <span className="animate-pulse">Syncing with server…</span>}
            {!isBackendLoading && <span>Changes are saved automatically.</span>}
          </div>
        </section>
      </div>
    </WebShell>
  );
}
