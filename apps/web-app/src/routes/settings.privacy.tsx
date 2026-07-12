import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { ArrowLeft, Lock, Activity, Eye, Share2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Vellum" },
      { name: "description", content: "Manage your privacy and visibility on Vellum." },
    ],
  }),
  component: PrivacyPage,
});

const privacyItems = [
  {
    key: "privateAccount",
    icon: Lock,
    label: "Private Account",
    description: "Only approved followers can see your stories",
    default: false,
  },
  {
    key: "activityStatus",
    icon: Activity,
    label: "Activity Status",
    description: "Show when you are active on Vellum",
    default: true,
  },
  {
    key: "readReceipts",
    icon: Eye,
    label: "Read Receipts",
    description: "Let others know when you have read their messages",
    default: true,
  },
  {
    key: "storySharing",
    icon: Share2,
    label: "Story Sharing",
    description: "Allow your stories to be shared by others",
    default: true,
  },
];

function PrivacyPage() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    privacyItems.reduce(
      (acc, item) => ({ ...acc, [item.key]: item.default }),
      {} as Record<string, boolean>,
    ),
  );

  const toggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

        <h1 className="text-3xl font-display italic mb-2">Privacy</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Control who can see your activity and content on Vellum.
        </p>

        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {privacyItems.map((item) => {
            const Icon = item.icon;
            const value = toggles[item.key];
            return (
              <div
                key={item.key}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left"
              >
                <div className="size-10 rounded-full bg-muted grid place-items-center shrink-0">
                  <Icon className="size-5" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value}
                  onClick={() => toggle(item.key)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    value ? "bg-accent" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                      value ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </WebShell>
  );
}
