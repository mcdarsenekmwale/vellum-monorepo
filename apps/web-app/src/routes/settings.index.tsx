import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import {
  Bell,
  Moon,
  Globe,
  Heart,
  HelpCircle,
  Info,
  Shield,
  Volume2,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useAuthState } from "@/hooks/useApi";
import { SettingRow } from "@/components/settings/SettingRow";
import { RowSwitch } from "@/components/settings/RowSwitch";
import { AppearanceSheet } from "@/components/settings/AppearanceSheet";
import { NotificationsSheet } from "@/components/settings/NotificationsSheet";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettingsStore } from "@/components/providers/SettingsStore";

export const Route = createFileRoute("/settings/")({
  component: SettingsIndexPage,
  head: () => ({
    meta: [{ title: "Settings — Vellbase" }],
  }),
});

function AppearanceBadge() {
  const { mode, resolved } = useTheme();
  const { t } = useI18n();
  const label =
    mode === "light"
      ? t("settings.appearanceLight")
      : mode === "dark"
        ? t("settings.appearanceDark")
        : resolved === "dark"
          ? `${t("settings.appearanceSystem")} · ${t("settings.appearanceDark")}`
          : `${t("settings.appearanceSystem")} · ${t("settings.appearanceLight")}`;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full bg-muted text-foreground">
      {mode === "dark" || (mode === "system" && resolved === "dark") ? (
        <Moon className="size-3.5" strokeWidth={2} />
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      )}
      {label}
    </span>
  );
}

function SettingsIndexPage() {
  const { logout } = useAuthState();
  const { t, locale } = useI18n();
  const { mode, resolved } = useTheme();
  const { soundEnabled, setSoundEnabled, notifications } = useSettingsStore();

  const [openAppearance, setOpenAppearance] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    window.location.href = "/";
  };

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto" data-testid="settings-page">
        <h1 className="text-3xl font-display italic mb-8" data-testid="settings-title">
          {t("settings.title")}
        </h1>

        {/* Preferences */}
        <section className="mb-8" data-testid="section-preferences">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
            {t("settings.preferences")}
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden" data-testid="card-preferences">
            <SettingRow
              icon={Moon}
              label={t("settings.sectionsAppearance")}
              description={t("settings.sectionsAppearanceDescription")}
              onClick={() => setOpenAppearance(true)}
              right={<AppearanceBadge />}
              dataTestId="row-appearance"
            />
            <SettingRow
              icon={Globe}
              label={t("settings.sectionsLanguage")}
              description={t("settings.sectionsLanguageDescription")}
              to="/settings/language"
              right={
                <span className="inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full bg-muted text-foreground uppercase tracking-wider">
                  {locale}
                </span>
              }
              dataTestId="row-language"
            />
            <SettingRow
              icon={Volume2}
              label={t("settings.sectionsSound")}
              description={t("settings.sectionsSoundDescription")}
              right={
                <RowSwitch
                  checked={soundEnabled}
                  onChange={setSoundEnabled}
                  dataTestId="sound-toggle"
                />
              }
              onClick={() => setSoundEnabled(!soundEnabled)}
              dataTestId="row-sound"
            />
            <SettingRow
              icon={Bell}
              label={t("settings.sectionsNotifications")}
              description={t("settings.sectionsNotificationsDescription")}
              onClick={() => setOpenNotifications(true)}
              right={
                <span className={notifications.pushNotifications ? "" : "opacity-70"} data-testid="notifications-push-summary">
                  {notifications.pushNotifications ? "ON" : "OFF"}
                </span>
              }
              dataTestId="row-notifications"
            />
          </div>
        </section>

        {/* Account */}
        <section className="mb-8" data-testid="section-account">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
            {t("settings.account")}
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden" data-testid="card-account">
            <SettingRow
              icon={Shield}
              label={t("settings.sectionsPrivacy")}
              description={t("settings.sectionsPrivacyDescription")}
              to="/settings/privacy"
              dataTestId="row-privacy"
            />
            <SettingRow
              icon={Heart}
              label={t("settings.sectionsSubscription")}
              description={t("settings.sectionsSubscriptionDescription")}
              to="/settings/subscription"
              dataTestId="row-subscription"
            />
            <SettingRow
              icon={HelpCircle}
              label={t("settings.sectionsHelpCenter")}
              description={t("settings.sectionsHelpCenterDescription")}
              to="/settings/help"
              dataTestId="row-help"
            />
            <SettingRow
              icon={Info}
              label={t("settings.sectionsAbout")}
              description={t("settings.sectionsAboutDescription")}
              to="/settings/about"
              dataTestId="row-about"
            />
          </div>
        </section>

        {/* Sign out */}
        <section className="mb-8">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 text-accent hover:bg-accent/5 transition-colors font-semibold"
              data-testid="row-signout"
            >
              <LogOut className="size-5" strokeWidth={1.8} />
              {t("settings.sectionsSignOut")}
            </button>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          © 2026 Vellbase ·{" "}
          <Link to="/settings/privacy" className="hover:underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/settings/about" className="hover:underline">
            Terms
          </Link>
        </p>

        {/* Hidden snapshot spans for quick DOM assertions in QA */}
        <span data-testid="snap-theme-mode" className="hidden">{mode}</span>
        <span data-testid="snap-theme-resolved" className="hidden">{resolved}</span>
        <span data-testid="snap-locale" className="hidden">{locale}</span>
        <span data-testid="snap-sound" className="hidden">{soundEnabled ? "on" : "off"}</span>
        <span data-testid="snap-push" className="hidden">{notifications.pushNotifications ? "on" : "off"}</span>
        <span data-testid="snap-email" className="hidden">{notifications.emailNotifications ? "on" : "off"}</span>
      </div>

      <AppearanceSheet open={openAppearance} onClose={() => setOpenAppearance(false)} />
      <NotificationsSheet open={openNotifications} onClose={() => setOpenNotifications(false)} />
    </WebShell>
  );
}
