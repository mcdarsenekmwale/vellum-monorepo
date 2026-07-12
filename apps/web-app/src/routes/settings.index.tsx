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
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useAuthState, useUserSettings } from "@/hooks/useApi";
import type { LucideIcon } from "lucide-react";

type SettingItem = {
  icon: LucideIcon;
  label: string;
  description: string;
  toggle?: boolean;
  default?: boolean;
  link?: boolean;
  to?: string;
  params?: Record<string, string>;
};

const settingGroups: { title: string; items: SettingItem[] }[] = [
  {
    title: "Preferences",
    items: [
      {
        icon: Bell,
        label: "Notifications",
        description: "Manage push notifications",
        toggle: true,
        default: true,
      },
      {
        icon: Moon,
        label: "Appearance",
        description: "Light, dark, or system",
        toggle: true,
        default: false,
      },
      {
        icon: Volume2,
        label: "Sound",
        description: "Enable audio effects",
        toggle: true,
        default: true,
      },
      {
        icon: Globe,
        label: "Language",
        description: "English",
        link: true,
        to: "/settings/language",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        icon: Shield,
        label: "Privacy",
        description: "Manage data and permissions",
        link: true,
        to: "/settings/privacy",
      },
      {
        icon: Heart,
        label: "Subscription",
        description: "Vellum Pro — $4.99/month",
        link: true,
        to: "/settings/about",
      },
      {
        icon: Info,
        label: "About",
        description: "Version 1.0.0",
        link: true,
        to: "/settings/about",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        icon: HelpCircle,
        label: "Help Center",
        description: "FAQs and contact",
        link: true,
        to: "/settings/help",
      },
    ],
  },
];

export const Route = createFileRoute("/settings/")({
  component: SettingsIndexPage,
});

function SettingsIndexPage() {
  const { logout } = useAuthState();
  const { data: userSettings } = useUserSettings();
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    Notifications: userSettings?.pushNotifications ?? true,
    Appearance: false,
    Sound: true,
  });

  const toggleSetting = (label: string) => {
    setToggles((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto">
        <h1 className="text-3xl font-display italic mb-8">Settings</h1>

        {settingGroups.map((group) => (
          <section key={group.title} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
              {group.title}
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                const isToggle = item.toggle;
                const value = isToggle
                  ? toggles[item.label] ?? item.default
                  : false;

                const content = (
                  <>
                    <div className="size-10 rounded-full bg-muted grid place-items-center shrink-0">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    {isToggle ? (
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          value ? "bg-accent" : "bg-muted-foreground/30"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                            value ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </div>
                    ) : (
                      <ChevronRight className="size-5 text-muted-foreground" />
                    )}
                  </>
                );

                if (isToggle) {
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleSetting(item.label)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left"
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    key={idx}
                    to={item.to!}
                    params={item.params}
                    className="w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <section className="mb-8">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-4 text-accent hover:bg-accent/5 transition-colors font-semibold"
            >
              <LogOut className="size-5" strokeWidth={1.8} />
              Sign out
            </button>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          © 2026 Vellum ·{" "}
          <Link to="/settings/privacy" className="hover:underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/settings/about" className="hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </WebShell>
  );
}
