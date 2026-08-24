// routes/_app/dashboard.tsx
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { usePermissions } from "@/lib/auth/hooks";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { CreatorDashboard } from "@/components/dashboard/CreatorDashboard";
import { ModeratorDashboard } from "@/components/dashboard/ModeratorDashboard";
import { Shimmer } from "@/components/dashboard/skeletons";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  LayoutDashboard,
  Users,
  Shield,
  PenTool,
  Sparkles,
  TrendingUp,
  BookOpen,
  MessageSquare,
  Heart,
  Eye,
  ArrowRight,
  Settings,
  Bell,
  ChevronRight,
  BarChart3,
  FileText,
  Video,
  Bookmark,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/lib/api/hooks";
import { SupportAdminDashboard } from "@/components/dashboard/SupportAdminDashboard";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · Vellum" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { role: rawRole, isReady, isAuthenticated, user } = usePermissions();
  const role = rawRole ?? null;
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isReady) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    return <UnauthenticatedState />;
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <RoleBadge role={role} />
          <span className="text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{user?.name || "User"}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link to="/notifications">
              <Bell className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link to="/settings">
              <Settings className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {renderDashboard(role)}
    </div>
  );
}

function renderDashboard(role: string | null) {
  switch (role) {
    case "Admin":
    case "SuperAdmin":
      return <AdminDashboard />;
    case "SupportAdmin":
      return <SupportAdminDashboard />;
    case "Moderator":
      return <ModeratorDashboard />;
    case "Creator":
      return <CreatorDashboard />;
    case "Editor":
      return <EditorDashboard />;
    default:
      return <UserDashboard />;
  }
}

/* ----------------- Unauthenticated State ----------------- */

function UnauthenticatedState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <div className="rounded-full bg-muted p-4 mx-auto w-fit">
          <LayoutDashboard className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Please log in</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          You need to be logged in to access the dashboard.
        </p>
        <Button asChild>
          <Link to="/login">Log in</Link>
        </Button>
      </div>
    </div>
  );
}

/* ----------------- Role Badge ----------------- */

function RoleBadge({ role }: { role: string | null }) {
  const config = {
    SuperAdmin: { icon: Shield, class: "bg-primary/10 text-primary", label: "Super Admin" },
    Admin: { icon: Shield, class: "bg-primary/10 text-primary", label: "Admin" },
    Moderator: { icon: Users, class: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Moderator" },
    Creator: { icon: PenTool, class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: "Creator" },
    Editor: { icon: FileText, class: "bg-sky-500/10 text-sky-600 dark:text-sky-400", label: "Editor" },
  };

  const { icon: Icon, class: badgeClass, label } = config[role as keyof typeof config] || {
    icon: Users,
    class: "bg-muted text-muted-foreground",
    label: role || "User",
  };

  return (
    <div className={cn("rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5", badgeClass)}>
      <Icon className="size-3" />
      {label}
    </div>
  );
}

/* ----------------- User Dashboard ----------------- */

function UserDashboard() {
  const { user } = usePermissions();
  const { data: stats } = useDashboardStats();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const quickStats = [
    {
      label: "Highlights",
      value: stats?.totalHighlights ?? 0,
      icon: Video,
      href: "/highlights",
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Articles",
      value: stats?.totalArticles ?? 0,
      icon: BookOpen,
      href: "/articles",
      color: "text-sky-500",
      bg: "bg-sky-500/10",
    },
    {
      label: "Comments",
      value: stats?.totalComments ?? 0,
      icon: MessageSquare,
      href: "/comments",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Engagement",
      value: stats?.totalLikes ?? 0,
      icon: Heart,
      href: "/analytics",
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
  ];

  const quickLinks = [
    { label: "Explore Highlights", description: "Discover new content", icon: Sparkles, href: "/highlights", color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "My Profile", description: "View your activity", icon: Users, href: "/profile", color: "text-primary", bg: "bg-primary/10" },
    { label: "Articles", description: "Browse articles", icon: BookOpen, href: "/articles", color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Settings", description: "Manage preferences", icon: Settings, href: "/settings", color: "text-muted-foreground", bg: "bg-muted" },
  ];

  const recentActivity = [
    { action: "Read", target: "The Quiet Return of Physical Objects", time: "2h ago", icon: BookOpen },
    { action: "Liked", target: "Solar Windows: The Transparent Future", time: "5h ago", icon: Heart },
    { action: "Commented on", target: "Why Serif Fonts are Dominating", time: "1d ago", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Welcome */}
      <PageHeader
        eyebrow={greeting()}
        title={`${user?.name ?? "User"}`}
        description="Here's what's happening across the platform today."
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.href}
            className="group relative overflow-hidden rounded-lg border bg-card p-5 py-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
          >
            <div className="flex items-start justify-between">
              <div className={cn("rounded-lg p-2.5", stat.bg)}>
                <stat.icon className={cn("size-5", stat.color)} />
              </div>
              <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight">{stat.value.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Links */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Links</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/20"
              >
                <div className={cn("rounded-lg p-2.5 shrink-0", link.bg)}>
                  <link.icon className={cn("size-5", link.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{link.label}</div>
                  <div className="text-sm text-muted-foreground">{link.description}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h3>
            <Button variant="ghost" size="sm" className="h-auto py-1 text-xs" asChild>
              <Link to="/notifications">View all</Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-card divide-y divide-border">
            {recentActivity.map((activity, i) => (
              <Link
                key={i}
                to="/articles"
                className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
                  <activity.icon className="size-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.action}</span>{" "}
                    <span className="text-muted-foreground truncate">{activity.target}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Reading Streak */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Reading Streak</div>
                <div className="text-sm text-muted-foreground">3 days in a row</div>
              </div>
            </div>
            <div className="mt-4 flex gap-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <div
                  key={day + i}
                  className={cn(
                    "flex-1 rounded-md py-2 text-center text-xs font-medium",
                    i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------- Editor Dashboard ----------------- */

function EditorDashboard() {
  const { user } = usePermissions();

  const editorStats = [
    { label: "Published", value: 24, icon: FileText, href: "/posts", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "In Review", value: 3, icon: Clock, href: "/posts?status=draft", color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Total Views", value: "12.4K", icon: Eye, href: "/analytics", color: "text-sky-500", bg: "bg-sky-500/10" },
    { label: "Engagement", value: "8.2%", icon: TrendingUp, href: "/analytics", color: "text-violet-500", bg: "bg-violet-500/10" },
  ];

  const drafts = [
    { title: "The Future of Sustainable Design", updated: "2h ago", progress: 75 },
    { title: "Understanding Modern Typography", updated: "1d ago", progress: 40 },
    { title: "Color Theory in Digital Spaces", updated: "3d ago", progress: 90 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Editor"
        title={`${user?.name ?? "Editor"}`}
        description="Manage your content and track performance."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {editorStats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.href}
            className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20"
          >
            <div className="flex items-start justify-between">
              <div className={cn("rounded-lg p-2.5", stat.bg)}>
                <stat.icon className={cn("size-5", stat.color)} />
              </div>
              <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Drafts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Drafts</h3>
            <Button size="sm" className="gap-1.5" asChild>
              <Link to="/articles">
                <PenTool className="size-4" /> Manage Articles
              </Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-card divide-y divide-border">
            {drafts.map((draft) => (
              <Link
                key={draft.title}
                to="/articles"
                className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{draft.title}</div>
                  <div className="text-sm text-muted-foreground">Last edited {draft.updated}</div>
                </div>
                <div className="w-24">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${draft.progress}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-muted-foreground mt-1">{draft.progress}%</div>
                </div>
                <Button variant="ghost" size="icon" className="size-8 shrink-0">
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: "Manage Articles", icon: PenTool, href: "/articles" },
              { label: "Manage Posts", icon: FileText, href: "/posts" },
              { label: "View Analytics", icon: BarChart3, href: "/analytics" },
              { label: "Media Library", icon: Video, href: "/media" },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:bg-muted/50 hover:border-primary/20"
              >
                <action.icon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{action.label}</span>
                <ChevronRight className="size-4 text-muted-foreground ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------- Skeleton ----------------- */

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-8 w-64" />
          <Shimmer className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-9 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Shimmer className="h-6 w-32" />
          <Shimmer className="h-48 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Shimmer className="h-6 w-32" />
          <Shimmer className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* ----------------- Default Exports ----------------- */

export default DashboardPage;