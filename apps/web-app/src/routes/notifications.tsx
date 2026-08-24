import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { Avatar } from "@/components/Avatar";
import { useNotifications } from "@/hooks/useApi";
import { requireAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { Heart, MessageCircle, UserPlus, Bookmark } from "lucide-react";
import type { ComponentType } from "react";
import { useI18n } from "@/components/providers/I18nProvider";

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return date.toLocaleDateString();
}

const iconFor: Record<string, ComponentType<{ className?: string }>> = {
  LIKE: Heart,
  COMMENT: MessageCircle,
  REPLY: MessageCircle,
  FOLLOW: UserPlus,
  BOOKMARK: Bookmark,
  MENTION: MessageCircle,
  SYSTEM: MessageCircle,
};

const verbFor: Record<string, string> = {
  LIKE: "liked your story",
  COMMENT: "commented on your story",
  REPLY: "replied to you",
  FOLLOW: "started following you",
  BOOKMARK: "saved your story",
  MENTION: "mentioned you",
  SYSTEM: "sent a notification",
};

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Vellum" },
      { name: "description", content: "Recent activity on your stories and profile." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data, isLoading, error, refetch } = useNotifications(1, 50);
  const { t } = useI18n();
  const notifications = data?.data || [];

  const unreadCount = notifications.filter((a) => !a.read).length;

  const markAllRead = async () => {
    try {
      await apiClient.markNotificationsRead();
      refetch();
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  if (isLoading) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto animate-pulse space-y-4">
          <div className="flex justify-between mb-6">
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="size-12 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </WebShell>
    );
  }

  if (error) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto py-20 text-center">
          <p className="text-muted-foreground">Failed to load notifications. Please try again later.</p>
        </div>
      </WebShell>
    );
  }

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto">
        <section className="mb-6 flex items-baseline justify-between">
          <h1 className="text-3xl font-display italic">Activity</h1>
          <button
            onClick={markAllRead}
            className="text-sm font-semibold text-accent hover:opacity-70"
          >
            {t("notifications.markAllRead")}
          </button>
        </section>

        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-4">
          {unreadCount} new · this week
        </p>

        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {notifications.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">{t("notifications.empty")}</p>
          )}
          {notifications.map((n) => {
            const actor = n.actor;
            const Icon = iconFor[n.kind] || MessageCircle;

            return (
              <div
                key={n.id}
                className={`flex items-center gap-4 p-4 hover:bg-muted transition-colors ${
                  !n.read ? "bg-accent/[0.04]" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar src={actor?.avatar} name={actor?.name} handle={actor?.handle} size="lg" />
                  <span className="absolute -bottom-1 -right-1 size-6 rounded-full bg-background grid place-items-center border border-border">
                    <Icon className={`size-3.5 ${n.kind === "LIKE" ? "text-accent fill-accent" : "text-foreground"}`} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold">{actor?.name || "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{verbFor[n.kind] || "interacted with you"}</span>
                    {n.body && (
                      <span className="text-foreground/80"> "{n.body}"</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-semibold">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WebShell>
  );
}
